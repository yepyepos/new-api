package model

import (
	"slices"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

const (
	// leaderboardHalfLimit is how many rows each end of the check-in board keeps.
	leaderboardHalfLimit = 25
	// leaderboardHeadLimit is how many rows the collapsed usage board keeps.
	leaderboardHeadLimit = 50
	// leaderboardMaxRows caps the expanded view so one click cannot pull an
	// unbounded ranking.
	leaderboardMaxRows = 1000
)

// CheckinLeaderboardRow is one user's check-in reward for a single site day.
// Rank is only filled by the expanded listing, which reads the ranking from the
// first place down; the trimmed ends carry 0 and omit it.
type CheckinLeaderboardRow struct {
	UserId       int    `json:"user_id"`
	Username     string `json:"username"`
	QuotaAwarded int    `json:"quota_awarded"`
	Rank         int    `json:"rank,omitempty"`
}

// UsageLeaderboardRow is one user's billed model consumption over a period.
// Rank follows the same rule as CheckinLeaderboardRow.
type UsageLeaderboardRow struct {
	UserId     int    `json:"user_id"`
	Username   string `json:"username"`
	TotalQuota int64  `json:"total_quota"`
	Rank       int    `json:"rank,omitempty"`
}

// LeaderboardEnds holds both ends of a ranking and how many rows it has in
// total, so a long board stays readable without hiding its real size.
type LeaderboardEnds[T any] struct {
	Top    []T   `json:"top"`
	Bottom []T   `json:"bottom"`
	Total  int64 `json:"total"`
}

// usageAggregate is a per-user consumption total before usernames are resolved.
type usageAggregate struct {
	UserId     int   `json:"user_id"`
	TotalQuota int64 `json:"total_quota"`
}

// newLeaderboardEnds trims the two ends of a ranking so nobody is listed twice
// when the ranking is shorter than both ends together.
func newLeaderboardEnds[T any](top, bottom []T, total int64) LeaderboardEnds[T] {
	ends := LeaderboardEnds[T]{Top: top, Bottom: []T{}, Total: total}
	if ends.Top == nil {
		ends.Top = []T{}
	}
	remaining := int(total) - len(ends.Top)
	if remaining <= 0 {
		return ends
	}
	// The tail is queried from the last rank upwards, so the rows that would
	// repeat the head sit at its end and are dropped by keeping the front.
	if len(bottom) > remaining {
		bottom = bottom[:remaining]
	}
	// The tail query runs in ascending order; reverse it so the rows read from
	// the highest rank of the tail down to the last one.
	slices.Reverse(bottom)
	ends.Bottom = bottom
	return ends
}

// clampLeaderboardLimit keeps an expanded request inside the row cap.
func clampLeaderboardLimit(limit int) int {
	if limit <= 0 || limit > leaderboardMaxRows {
		return leaderboardMaxRows
	}
	return limit
}

// checkinLeaderboardQuery filters the check-ins of one site day to the users
// that still exist.
func checkinLeaderboardQuery(checkinDate string) *gorm.DB {
	return DB.Table("checkins").
		Joins("JOIN users ON users.id = checkins.user_id").
		Where("checkins.checkin_date = ?", checkinDate)
}

// GetTodayCheckinLeaderboard returns the highest and the lowest check-in
// rewards of the given site day. Users who did not check in are omitted.
func GetTodayCheckinLeaderboard(checkinDate string, half int) (LeaderboardEnds[CheckinLeaderboardRow], error) {
	if half <= 0 {
		half = leaderboardHalfLimit
	}
	base := checkinLeaderboardQuery(checkinDate)
	var total int64
	if err := base.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return LeaderboardEnds[CheckinLeaderboardRow]{}, err
	}
	scan := func(order string) ([]CheckinLeaderboardRow, error) {
		var rows []CheckinLeaderboardRow
		err := base.Session(&gorm.Session{}).
			Select("checkins.user_id, users.username, checkins.quota_awarded").
			Order(order).
			Limit(half).
			Scan(&rows).Error
		return rows, err
	}
	top, err := scan("checkins.quota_awarded DESC, checkins.user_id ASC")
	if err != nil {
		return LeaderboardEnds[CheckinLeaderboardRow]{}, err
	}
	bottom, err := scan("checkins.quota_awarded ASC, checkins.user_id DESC")
	if err != nil {
		return LeaderboardEnds[CheckinLeaderboardRow]{}, err
	}
	return newLeaderboardEnds(top, bottom, total), nil
}

// GetTodayCheckinLeaderboardRows returns the whole day's ranking from first
// place down, for the expanded view, together with how many rows the ranking
// really has. The reported rows stop at the cap, which the caller detects by
// comparing the two.
func GetTodayCheckinLeaderboardRows(checkinDate string, limit int) ([]CheckinLeaderboardRow, int64, error) {
	limit = clampLeaderboardLimit(limit)
	base := checkinLeaderboardQuery(checkinDate)
	var total int64
	if err := base.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []CheckinLeaderboardRow
	err := base.Session(&gorm.Session{}).
		Select("checkins.user_id, users.username, checkins.quota_awarded").
		Order("checkins.quota_awarded DESC, checkins.user_id ASC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	// The rows arrive in rank order, so the position is the rank.
	for i := range rows {
		rows[i].Rank = i + 1
	}
	return rows, total, nil
}

// usageTotalQuery counts the users with positive consumption in the period.
func usageTotalQuery(startTime int64) *gorm.DB {
	return LOG_DB.Table("(?) as consuming", usageConsumptionQuery(startTime).
		Select("logs.user_id").
		Group("logs.user_id").
		Having("SUM(logs.quota) > 0"))
}

// usageConsumptionQuery filters the billed consumption logs since startTime.
// A zero startTime means all time.
func usageConsumptionQuery(startTime int64) *gorm.DB {
	query := LOG_DB.Table("logs").Where("logs.type = ?", LogTypeConsume)
	if startTime > 0 {
		query = query.Where("logs.created_at >= ?", startTime)
	}
	return query
}

// usagePerUserQuery aggregates the filtered logs into one positive total per
// user, which is the unit both leaderboard shapes read from.
func usagePerUserQuery(startTime int64) *gorm.DB {
	return usageConsumptionQuery(startTime).
		Select("logs.user_id, SUM(logs.quota) AS total_quota").
		Group("logs.user_id").
		Having("SUM(logs.quota) > 0")
}

// usageRowsWithUsernames resolves the usernames of aggregated rows. The users
// table always lives on the main database, which may differ from the log
// database, so the names cannot be joined into the aggregate itself. Rows whose
// account no longer exists are dropped, matching what a join would return.
func usageRowsWithUsernames(aggregates []usageAggregate) ([]UsageLeaderboardRow, error) {
	rows := make([]UsageLeaderboardRow, 0, len(aggregates))
	if len(aggregates) == 0 {
		return rows, nil
	}
	ids := make([]int, 0, len(aggregates))
	for _, item := range aggregates {
		ids = append(ids, item.UserId)
	}
	var users []User
	if err := DB.Select("id", "username").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	usernames := make(map[int]string, len(users))
	for _, user := range users {
		usernames[user.Id] = user.Username
	}
	for _, item := range aggregates {
		username, ok := usernames[item.UserId]
		if !ok {
			continue
		}
		rows = append(rows, UsageLeaderboardRow{
			UserId:     item.UserId,
			Username:   username,
			TotalQuota: item.TotalQuota,
		})
	}
	return rows, nil
}

// GetUsageLeaderboard returns the heaviest consumers of the period, ordered by
// the final billed quota (logs.quota, which already includes ratios and
// failed-request charges). The lightest consumers are not listed because they
// carry no information for the reader; an empty Bottom keeps the response
// shape shared with the check-in board.
func GetUsageLeaderboard(startTime int64, head int) (LeaderboardEnds[UsageLeaderboardRow], error) {
	if head <= 0 {
		head = leaderboardHeadLimit
	}
	var total int64
	if err := usageTotalQuery(startTime).Count(&total).Error; err != nil {
		return LeaderboardEnds[UsageLeaderboardRow]{}, err
	}
	var aggregates []usageAggregate
	if err := usagePerUserQuery(startTime).
		Order("total_quota DESC, logs.user_id ASC").
		Limit(head).
		Scan(&aggregates).Error; err != nil {
		return LeaderboardEnds[UsageLeaderboardRow]{}, err
	}
	rows, err := usageRowsWithUsernames(aggregates)
	if err != nil {
		return LeaderboardEnds[UsageLeaderboardRow]{}, err
	}
	return LeaderboardEnds[UsageLeaderboardRow]{Top: rows, Bottom: []UsageLeaderboardRow{}, Total: total}, nil
}

// GetUsageLeaderboardRows returns the whole period's ranking from the heaviest
// consumer down, for the expanded view, together with how many users the
// ranking really has. The reported rows stop at the cap, which the caller
// detects by comparing the two.
func GetUsageLeaderboardRows(startTime int64, limit int) ([]UsageLeaderboardRow, int64, error) {
	limit = clampLeaderboardLimit(limit)
	var total int64
	if err := usageTotalQuery(startTime).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var aggregates []usageAggregate
	if err := usagePerUserQuery(startTime).
		Order("total_quota DESC, logs.user_id ASC").
		Limit(limit).
		Scan(&aggregates).Error; err != nil {
		return nil, 0, err
	}
	rows, err := usageRowsWithUsernames(aggregates)
	if err != nil {
		return nil, 0, err
	}
	for i := range rows {
		rows[i].Rank = i + 1
	}
	return rows, total, nil
}

// CommunityLeaderboardCheckinDate returns today's date in the check-in
// timezone so the check-in leaderboard matches the check-in calendar day.
func CommunityLeaderboardCheckinDate() (string, error) {
	return operation_setting.CheckinSettingsSnapshot().Today()
}
