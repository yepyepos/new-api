package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// SiteClosureSetting 全站闭站配置。闭站期间 Relay 入口统一返回 503，控制台由
// 前端全屏公告页接管，非管理员无法完成登录。
type SiteClosureSetting struct {
	// Enabled 是否处于闭站状态
	Enabled bool `json:"enabled"`
	// Notice 闭站公告正文，Markdown，展示在首页与 API 错误消息中
	Notice string `json:"notice"`
	// Since 最近一次开启闭站的时间戳（秒），由服务端写入，仅用于展示
	Since int64 `json:"since"`
	// ExemptUserIds 闭站期间仍可调用 Relay 的用户 ID 白名单
	ExemptUserIds []int `json:"exempt_user_ids"`
}

// 默认配置
var siteClosureSetting = SiteClosureSetting{
	Enabled:       false,
	Notice:        "",
	Since:         0,
	ExemptUserIds: []int{},
}

func init() {
	config.GlobalConfig.Register("site_closure_setting", &siteClosureSetting)
}

// GetSiteClosureSetting 获取闭站配置
func GetSiteClosureSetting() *SiteClosureSetting {
	return &siteClosureSetting
}

// IsSiteClosed 站点当前是否处于闭站状态
func IsSiteClosed() bool {
	return siteClosureSetting.Enabled
}
