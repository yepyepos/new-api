package model

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
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
// check in are intentionally omitted.
func GetTodayCheckinLeaderboard(checkinDate string, limit int) ([]CheckinLeaderboardRow, error) {
	if limit <= 0 {
		limit = 50
	}
	var rows []CheckinLeaderboardRow
	err := DB.Table("checkins").
		Select("checkins.user_id, users.username, checkins.quota_awarded").
		Joins("JOIN users ON users.id = checkins.user_id").
		Where("checkins.checkin_date = ?", checkinDate).
		Order("checkins.quota_awarded DESC, checkins.user_id ASC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

// GetUsageLeaderboard aggregates billed consumption (logs.quota, which already
// includes ratios and failed-request charges) per user since startTime. A zero
// startTime means all time. Only users with positive consumption are returned.
func GetUsageLeaderboard(startTime int64, limit int) ([]UsageLeaderboardRow, error) {
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

	query := LOG_DB.Table("logs").
		Select("logs.user_id, users.username, SUM(logs.quota) AS total_quota").
		Joins("JOIN users ON users.id = logs.user_id").
		Where("logs.type = ?", LogTypeConsume)
	if startTime > 0 {
		query = query.Where("logs.created_at >= ?", startTime)
	}
	var rows []UsageLeaderboardRow
	err := query.
		Group("logs.user_id, users.username").
		Having("SUM(logs.quota) > 0").
		Order("total_quota DESC, logs.user_id ASC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func usageLeaderboardSplitQuery(startTime int64, limit int) ([]UsageLeaderboardRow, error) {
	type usageAggregate struct {
		UserId     int   `json:"user_id"`
		TotalQuota int64 `json:"total_quota"`
	}
	var aggregates []usageAggregate
	query := LOG_DB.Table("logs").
		Select("logs.user_id, SUM(logs.quota) AS total_quota").
		Where("logs.type = ?", LogTypeConsume)
	if startTime > 0 {
		query = query.Where("logs.created_at >= ?", startTime)
	}
	err := query.Group("logs.user_id").
		Having("SUM(logs.quota) > 0").
		Order("total_quota DESC, logs.user_id ASC").
		Limit(limit).
		Scan(&aggregates).Error
	if err != nil {
		return nil, err
	}
	if len(aggregates) == 0 {
		return []UsageLeaderboardRow{}, nil
	}
	ids := make([]int, 0, len(aggregates))
	for _, item := range aggregates {
		ids = append(ids, item.UserId)
	}
	usernames := map[int]string{}
	var users []User
	if err := DB.Select("id", "username").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
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
	return rows, nil
}

// CommunityLeaderboardCheckinDate returns today's date in the check-in
// timezone so the check-in leaderboard matches the check-in calendar day.
func CommunityLeaderboardCheckinDate() (string, error) {
	return operation_setting.CheckinSettingsSnapshot().Today()
}
