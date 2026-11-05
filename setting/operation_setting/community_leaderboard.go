package operation_setting

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// CommunityLeaderboardSetting controls the user-facing check-in and usage
// leaderboards. They stay admin-only until the operator flips PublicEnabled.
type CommunityLeaderboardSetting struct {
	PublicEnabled bool `json:"public_enabled"`
}

// 默认配置
var communityLeaderboardSetting = CommunityLeaderboardSetting{
	PublicEnabled: false, // 默认关闭，管理员始终可见
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("community_leaderboard", &communityLeaderboardSetting)
}

func CommunityLeaderboardSettingsSnapshot() CommunityLeaderboardSetting {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return communityLeaderboardSetting
}

func GetCommunityLeaderboardSetting() *CommunityLeaderboardSetting {
	return &communityLeaderboardSetting
}

// IsCommunityLeaderboardPublic reports whether non-admin users may read the
// community leaderboards.
func IsCommunityLeaderboardPublic() bool {
	return communityLeaderboardSetting.PublicEnabled
}

// PeriodStart returns the Unix timestamp that starts the given leaderboard
// period, measured in the check-in timezone so "today" and "week" match the
// check-in calendar. Period "all" returns 0.
func (s CommunityLeaderboardSetting) PeriodStart(period string) (int64, error) {
	location, err := time.LoadLocation(checkinSetting.Timezone)
	if err != nil {
		location = time.Local
	}
	now := time.Now().In(location)
	switch period {
	case "today":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
		return start.Unix(), nil
	case "week":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, location)
		return start.Unix(), nil
	case "all":
		return 0, nil
	default:
		return 0, common.NewMessage("Invalid leaderboard period")
	}
}
