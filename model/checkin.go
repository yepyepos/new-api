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
	CheckinDate  string `json:"checkin_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_user_checkin_date"` // 格式: YYYY-MM-DD
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
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

// UserCheckin 执行用户签到
func UserCheckin(userId int) (*Checkin, error) {
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
	awarded := setting.AwardQuota()
	checkin := &Checkin{
		UserId:       userId,
		CheckinDate:  today,
		QuotaAwarded: awarded,
		CreatedAt:    time.Now().Unix(),
	}

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
		if err := tx.Create(checkin).Error; err != nil {
			return common.NewMessage("Check-in failed, please try again later")
		}
		result := tx.Model(&User{}).Where("id = ? AND quota = ? AND status = ?", userId, user.Quota, common.UserStatusEnabled).
			Update("quota", gorm.Expr("quota + ?", awarded))
		if result.Error != nil {
			return common.NewMessage("Check-in failed: quota update error")
		}
		if result.RowsAffected != 1 {
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

	return checkin, nil
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
