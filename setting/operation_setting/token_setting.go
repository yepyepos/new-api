package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// TokenSetting 令牌相关配置
type TokenSetting struct {
	MaxUserTokens int `json:"max_user_tokens"` // 每用户最大令牌数量

	// AutoRevokeEnabled 每天定时失效全部 API Key，用户需要自行重新创建
	AutoRevokeEnabled bool `json:"auto_revoke_enabled"`
	// AutoRevokeTime 每日失效时间，24 小时制 HH:MM，按服务器本地时区解释
	AutoRevokeTime string `json:"auto_revoke_time"`
	// AutoRevokeSkipAdmins 跳过管理员账号（role >= RoleAdminUser）
	AutoRevokeSkipAdmins bool `json:"auto_revoke_skip_admins"`
	// AutoRevokeExemptUserIds 不受影响的用户 ID 白名单
	AutoRevokeExemptUserIds []int `json:"auto_revoke_exempt_user_ids"`
}

// 默认配置
var tokenSetting = TokenSetting{
	MaxUserTokens:           1000,  // 默认每用户最多 1000 个令牌
	AutoRevokeEnabled:       false, // 默认关闭，避免升级后意外清空全部 Key
	AutoRevokeTime:          "04:00",
	AutoRevokeSkipAdmins:    true,
	AutoRevokeExemptUserIds: []int{},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("token_setting", &tokenSetting)
}

// GetTokenSetting 获取令牌配置
func GetTokenSetting() *TokenSetting {
	return &tokenSetting
}

// GetMaxUserTokens 获取每用户最大令牌数量
func GetMaxUserTokens() int {
	return GetTokenSetting().MaxUserTokens
}
