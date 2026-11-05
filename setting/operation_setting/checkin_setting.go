package operation_setting

import (
	"math/rand/v2"
	"time"
	_ "time/tzdata"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// CheckinSetting 签到功能配置
type CheckinSetting struct {
	Enabled          bool   `json:"enabled"`   // 是否启用签到功能
	MinQuota         int    `json:"min_quota"` // 签到最小额度奖励
	MaxQuota         int    `json:"max_quota"` // 签到最大额度奖励
	Quota            int    `json:"quota"`
	ThresholdEnabled bool   `json:"threshold_enabled"`
	BalanceThreshold int    `json:"balance_threshold"`
	Timezone         string `json:"timezone"`
}

// 默认配置
var checkinSetting = CheckinSetting{
	Enabled:  false, // 默认关闭
	MinQuota: 0,     // 未配置区间时沿用 Quota 固定值
	MaxQuota: 0,
	Quota:    1000,
	Timezone: "Asia/Hong_Kong",
}

func CheckinSettingsSnapshot() CheckinSetting {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return checkinSetting
}

func (s CheckinSetting) Validate() error {
	if s.Quota < 1 || s.Quota > common.MaxWalletQuota || s.BalanceThreshold < 0 || s.BalanceThreshold > common.MaxWalletQuota {
		return common.NewMessage("Invalid parameters")
	}
	// The web console saves one option key per request, so the two range ends
	// arrive in separate requests and one of them is still zero in between.
	// AwardQuota falls back to the fixed reward while a range is incomplete.
	if s.MinQuota < 0 || s.MaxQuota < 0 || s.MinQuota > common.MaxWalletQuota || s.MaxQuota > common.MaxWalletQuota {
		return common.NewMessage("Invalid check-in reward range")
	}
	if s.MinQuota > 0 && s.MaxQuota > 0 && s.MaxQuota < s.MinQuota {
		return common.NewMessage("Invalid check-in reward range")
	}
	if _, err := time.LoadLocation(s.Timezone); err != nil {
		return common.NewMessage("Invalid check-in timezone.")
	}
	return nil
}

func (s CheckinSetting) Today() (string, error) {
	location, err := time.LoadLocation(s.Timezone)
	if err != nil {
		return "", err
	}
	return time.Now().In(location).Format("2006-01-02"), nil
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("checkin_setting", &checkinSetting)
}

// GetCheckinSetting 获取签到配置
func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}

// IsCheckinEnabled 是否启用签到功能
func IsCheckinEnabled() bool {
	return checkinSetting.Enabled
}

// GetCheckinQuotaRange 获取签到额度范围
func GetCheckinQuotaRange() (min, max int) {
	return checkinSetting.MinQuota, checkinSetting.MaxQuota
}

// AwardQuota draws the daily check-in reward. When the operator has not set a
// range (MinQuota or MaxQuota is zero), the legacy fixed quota is returned so
// existing sites keep their configured amount until the range is configured.
func (s CheckinSetting) AwardQuota() int {
	minQuota, maxQuota := s.MinQuota, s.MaxQuota
	if minQuota <= 0 || maxQuota < minQuota {
		return s.Quota
	}
	return rand.IntN(maxQuota-minQuota+1) + minQuota
}
