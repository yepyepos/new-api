package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Checkin 签到记录
type Checkin struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_user_checkin_date"`
	CheckinDate  string `json:"checkin_date" gorm:"type:varchar(10);not null;index:idx_checkin_date;uniqueIndex:idx_user_checkin_date"` // 格式: YYYY-MM-DD
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

// CheckinResult is one completed check-in together with the standings the
// success dialog shows. The place and streak are read inside the check-in
// transaction so they describe the same moment as the award.
type CheckinResult struct {
	Checkin
	// RankToday is the order this check-in took among today's check-ins.
	RankToday int `json:"rank_today"`
	// TotalToday is how many users had checked in today, this one included.
	TotalToday int `json:"total_today"`
	// StreakDays counts consecutive site days ending today.
	StreakDays int `json:"streak_days"`
	// QuotaRankToday is this award's place when today's awards are ordered by
	// size, so first place is the largest reward of the day.
	QuotaRankToday int `json:"quota_rank_today"`
	// QuotaRankTied reports that another user received exactly today's award.
	QuotaRankTied bool `json:"quota_rank_tied"`
	// BeatsPercent is the share of today's check-ins this award is larger than.
	BeatsPercent int `json:"beats_percent"`
}

// CheckinRecord 用于API返回的签到记录（不包含敏感字段）
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
}

func (Checkin) TableName() string {
	return "checkins"
}

// GetUserCheckinRecords 获取用户在指定日期范围内的签到记录
func GetUserCheckinRecords(userId int, startDate, endDate string) ([]Checkin, error) {
	var records []Checkin
	err := DB.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userId, startDate, endDate).
		Order("checkin_date DESC").
		Find(&records).Error
	return records, err
}

// HasCheckedInToday 检查用户今天是否已签到
func HasCheckedInToday(userId int) (bool, error) {
	today, err := operation_setting.CheckinSettingsSnapshot().Today()
	if err != nil {
		return false, err
	}
	var count int64
	err = DB.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date = ?", userId, today).
		Count(&count).Error
	return count > 0, err
}

// previousSiteDate returns the calendar day before the given YYYY-MM-DD date in
// the given location. Calendar arithmetic keeps it correct across month, year
// and daylight-saving boundaries.
func previousSiteDate(date string, location *time.Location) (string, error) {
	parsed, err := time.ParseInLocation("2006-01-02", date, location)
	if err != nil {
		return "", err
	}
	return parsed.AddDate(0, 0, -1).Format("2006-01-02"), nil
}

// checkinStreak counts the consecutive site days ending on today that the user
// has checked in, so a gap of one day restarts the count at 1. It walks the
// dates backwards in chunks so a long streak is never truncated by a row cap.
func checkinStreak(tx *gorm.DB, userId int, today string, location *time.Location) (int, error) {
	const chunk = 400
	streak := 0
	expected := today
	for {
		var dates []string
		err := tx.Model(&Checkin{}).
			Where("user_id = ? AND checkin_date <= ?", userId, expected).
			Order("checkin_date DESC").
			Limit(chunk).
			Pluck("checkin_date", &dates).Error
		if err != nil {
			return 0, err
		}
		for _, date := range dates {
			if date != expected {
				return streak, nil
			}
			streak++
			expected, err = previousSiteDate(expected, location)
			if err != nil {
				return 0, err
			}
		}
		if len(dates) < chunk {
			return streak, nil
		}
	}
}

// checkinStandings fills in where the just-recorded check-in sits among today's
// check-ins. It runs inside the check-in transaction so the numbers describe
// the same moment as the award.
func checkinStandings(tx *gorm.DB, result *CheckinResult, location *time.Location) error {
	var scheduled int64
	if err := tx.Model(&Checkin{}).
		Where("checkin_date = ? AND id <= ?", result.CheckinDate, result.Id).
		Count(&scheduled).Error; err != nil {
		return err
	}
	result.RankToday = int(scheduled)
	var total int64
	if err := tx.Model(&Checkin{}).Where("checkin_date = ?", result.CheckinDate).Count(&total).Error; err != nil {
		return err
	}
	result.TotalToday = int(total)
	var ahead int64
	if err := tx.Model(&Checkin{}).
		Where("checkin_date = ? AND quota_awarded > ?", result.CheckinDate, result.QuotaAwarded).
		Count(&ahead).Error; err != nil {
		return err
	}
	result.QuotaRankToday = int(ahead) + 1
	var tied int64
	if err := tx.Model(&Checkin{}).
		Where("checkin_date = ? AND quota_awarded = ? AND user_id <> ?", result.CheckinDate, result.QuotaAwarded, result.UserId).
		Count(&tied).Error; err != nil {
		return err
	}
	result.QuotaRankTied = tied > 0
	if result.TotalToday > 0 {
		result.BeatsPercent = (result.TotalToday - result.QuotaRankToday) * 100 / result.TotalToday
	}
	streak, err := checkinStreak(tx, result.UserId, result.CheckinDate, location)
	if err != nil {
		return err
	}
	result.StreakDays = streak
	return nil
}

// UserCheckin 执行用户签到
func UserCheckin(userId int) (*CheckinResult, error) {
	setting := operation_setting.CheckinSettingsSnapshot()
	if !setting.Enabled {
		return nil, common.NewMessage("Check-in feature is not enabled")
	}

	if err := setting.Validate(); err != nil {
		return nil, err
	}
	today, err := setting.Today()
	if err != nil {
		return nil, err
	}
	location, err := time.LoadLocation(setting.Timezone)
	if err != nil {
		return nil, err
	}
	awarded := setting.AwardQuota()
	result := &CheckinResult{Checkin: Checkin{
		UserId:       userId,
		CheckinDate:  today,
		QuotaAwarded: awarded,
		CreatedAt:    time.Now().Unix(),
	}}

	err = DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userId).Error; err != nil {
			return err
		}
		if user.Status != common.UserStatusEnabled {
			return common.NewMessage("User has been banned")
		}
		var count int64
		if err := tx.Model(&Checkin{}).Where("user_id = ? AND checkin_date = ?", userId, today).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return common.NewMessage("Already checked in today")
		}
		if setting.ThresholdEnabled && user.Quota > setting.BalanceThreshold {
			return common.NewMessage("Your balance is above the check-in threshold. Try again after using some quota.")
		}
		if user.Quota < -common.MaxWalletQuota || user.Quota > common.MaxWalletQuota {
			return ErrWalletQuotaLimitExceeded
		}
		if _, err := common.WalletQuotaFromDecimalStrict(decimal.NewFromInt(int64(user.Quota)).Add(decimal.NewFromInt(int64(awarded)))); err != nil {
			return ErrWalletQuotaLimitExceeded
		}
		// The record and full reward commit together, including on SQLite.
		if err := tx.Create(&result.Checkin).Error; err != nil {
			return common.NewMessage("Check-in failed, please try again later")
		}
		// The standings describe this commit, so a failure here rolls the
		// check-in back rather than reporting numbers nobody can reproduce.
		if err := checkinStandings(tx, result, location); err != nil {
			return err
		}
		update := tx.Model(&User{}).Where("id = ? AND quota = ? AND status = ?", userId, user.Quota, common.UserStatusEnabled).
			Update("quota", gorm.Expr("quota + ?", awarded))
		if update.Error != nil {
			return common.NewMessage("Check-in failed: quota update error")
		}
		if update.RowsAffected != 1 {
			return common.NewMessage("Check-in failed, please try again later")
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	if err := cacheIncrUserQuota(userId, int64(awarded)); err != nil {
		common.SysError(common.LogText("failed to sync check-in quota for user %d: %s", userId, err))
	}

	return result, nil
}

// GetUserCheckinStats 获取用户签到统计信息
func GetUserCheckinStats(userId int, month string) (map[string]any, error) {
	// 获取指定月份的所有签到记录
	startDate := month + "-01"
	endDate := month + "-31"

	records, err := GetUserCheckinRecords(userId, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 转换为不包含敏感字段的记录
	checkinRecords := make([]CheckinRecord, len(records))
	for i, r := range records {
		checkinRecords[i] = CheckinRecord{
			CheckinDate:  r.CheckinDate,
			QuotaAwarded: r.QuotaAwarded,
		}
	}

	// 检查今天是否已签到
	hasCheckedToday, err := HasCheckedInToday(userId)
	if err != nil {
		return nil, err
	}

	// 获取用户所有时间的签到统计
	var totalCheckins int64
	var totalQuota int64
	if err := DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&Checkin{}).Where("user_id = ?", userId).Select("COALESCE(SUM(quota_awarded), 0)").Scan(&totalQuota).Error; err != nil {
		return nil, err
	}

	return map[string]any{
		"total_quota":      totalQuota,      // 所有时间累计获得的额度
		"total_checkins":   totalCheckins,   // 所有时间累计签到次数
		"checkin_count":    len(records),    // 本月签到次数
		"checked_in_today": hasCheckedToday, // 今天是否已签到
		"records":          checkinRecords,  // 本月签到记录详情（不含id和user_id）
	}, nil
}
