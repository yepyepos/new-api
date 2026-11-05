package model

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// CheckinLeaderboardRow is one user's check-in reward for a single site day.
type CheckinLeaderboardRow struct {
	UserId       int    `json:"user_id"`
	Username     string `json:"username"`
	QuotaAwarded int    `json:"quota_awarded"`
}

// UsageLeaderboardRow is one user's billed model consumption over a period.
type UsageLeaderboardRow struct {
	UserId     int    `json:"user_id"`
	Username   string `json:"username"`
	TotalQuota int64  `json:"total_quota"`
}

// GetTodayCheckinLeaderboard returns every user who checked in on the given
// site day, ordered by the random reward they received. Users who did not
// check in are intentionally omitted. The second result is how many users
// checked in in total, which can exceed the returned rows.
func GetTodayCheckinLeaderboard(checkinDate string, limit int) ([]CheckinLeaderboardRow, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	var total int64
	if err := DB.Table("checkins").
		Joins("JOIN users ON users.id = checkins.user_id").
		Where("checkins.checkin_date = ?", checkinDate).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []CheckinLeaderboardRow
	err := DB.Table("checkins").
		Select("checkins.user_id, users.username, checkins.quota_awarded").
		Joins("JOIN users ON users.id = checkins.user_id").
		Where("checkins.checkin_date = ?", checkinDate).
		Order("checkins.quota_awarded DESC, checkins.user_id ASC").
		Limit(limit).
		Scan(&rows).Error
	return rows, total, err
}

// GetUsageLeaderboard aggregates billed consumption (logs.quota, which already
// includes ratios and failed-request charges) per user since startTime. A zero
// startTime means all time. Only users with positive consumption are returned,
// and the second result counts them, which can exceed the returned rows.
func GetUsageLeaderboard(startTime int64, limit int) ([]UsageLeaderboardRow, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	// The users table always lives on the main database, which may differ from
	// the log database. When they differ we cannot join across connections, so
	// aggregate on the log database first and resolve usernames from the main
	// database afterwards.
	if LOG_DB != DB {
		return usageLeaderboardSplitQuery(startTime, limit)
	}

	base := LOG_DB.Table("logs").
		Joins("JOIN users ON users.id = logs.user_id").
		Where("logs.type = ?", LogTypeConsume)
	if startTime > 0 {
		base = base.Where("logs.created_at >= ?", startTime)
	}
	// Chained GORM calls mutate the statement in place, so each query starts
	// from its own session clone of the shared filters.
	// Counting the grouped rows keeps the total in step with the filters and
	// the positive-consumption constraint the rows themselves use.
	var total int64
	err := LOG_DB.Table("(?) as consuming", base.Session(&gorm.Session{}).
		Select("logs.user_id").
		Group("logs.user_id").
		Having("SUM(logs.quota) > 0")).
		Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	var rows []UsageLeaderboardRow
	err = base.Session(&gorm.Session{}).
		Select("logs.user_id, users.username, SUM(logs.quota) AS total_quota").
		Group("logs.user_id, users.username").
		Having("SUM(logs.quota) > 0").
		Order("total_quota DESC, logs.user_id ASC").
		Limit(limit).
		Scan(&rows).Error
	return rows, total, err
}

func usageLeaderboardSplitQuery(startTime int64, limit int) ([]UsageLeaderboardRow, int64, error) {
	type usageAggregate struct {
		UserId     int   `json:"user_id"`
		TotalQuota int64 `json:"total_quota"`
	}
	base := LOG_DB.Table("logs").
		Where("logs.type = ?", LogTypeConsume)
	if startTime > 0 {
		base = base.Where("logs.created_at >= ?", startTime)
	}
	var total int64
	err := LOG_DB.Table("(?) as consuming", base.Session(&gorm.Session{}).
		Select("logs.user_id").
		Group("logs.user_id").
		Having("SUM(logs.quota) > 0")).
		Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	var aggregates []usageAggregate
	err = base.Session(&gorm.Session{}).
		Select("logs.user_id, SUM(logs.quota) AS total_quota").
		Group("logs.user_id").
		Having("SUM(logs.quota) > 0").
		Order("total_quota DESC, logs.user_id ASC").
		Limit(limit).
		Scan(&aggregates).Error
	if err != nil {
		return nil, 0, err
	}
	if len(aggregates) == 0 {
		return []UsageLeaderboardRow{}, total, nil
	}
	ids := make([]int, 0, len(aggregates))
	for _, item := range aggregates {
		ids = append(ids, item.UserId)
	}
	usernames := map[int]string{}
	var users []User
	if err := DB.Select("id", "username").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	for _, user := range users {
		usernames[user.Id] = user.Username
	}
	rows := make([]UsageLeaderboardRow, 0, len(aggregates))
	for _, item := range aggregates {
		rows = append(rows, UsageLeaderboardRow{
			UserId:     item.UserId,
			Username:   usernames[item.UserId],
			TotalQuota: item.TotalQuota,
		})
	}
	return rows, total, nil
}

// CommunityLeaderboardCheckinDate returns today's date in the check-in
// timezone so the check-in leaderboard matches the check-in calendar day.
func CommunityLeaderboardCheckinDate() (string, error) {
	return operation_setting.CheckinSettingsSnapshot().Today()
}
