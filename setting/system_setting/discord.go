package system_setting

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type DiscordSettings struct {
	Enabled         bool   `json:"enabled"`
	ClientId        string `json:"client_id"`
	ClientSecret    string `json:"client_secret"`
	GuildID         string `json:"guild_id"`
	RoleIDs         string `json:"role_ids"`
	RoleMatchMode   string `json:"role_match_mode"`
	OnlyLogin       bool   `json:"only_login"`
	BlockedGuildIDs string `json:"blocked_guild_ids"`
}

var ErrDiscordCommunitySettings = errors.New("Invalid Discord community settings. Use numeric IDs and specify a server before roles.")
var ErrDiscordLoginNotConfigured = errors.New("Enable Discord OAuth and configure its Client ID and Client Secret before requiring Discord login.")
var ErrDiscordRoleMatchMode = errors.New("Invalid Discord role matching mode. Choose any or all.")

func DiscordSettingsSnapshot() DiscordSettings {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return defaultDiscordSettings
}

// RequiredRoles accepts comma-separated role IDs; RoleMatchMode controls admission.
func (s DiscordSettings) RequiredRoles() []string {
	roles := []string{}
	for role := range strings.SplitSeq(s.RoleIDs, ",") {
		if role = strings.TrimSpace(role); role != "" {
			roles = append(roles, role)
		}
	}
	return roles
}

func (s DiscordSettings) BlockedGuilds() []string {
	return strings.FieldsFunc(s.BlockedGuildIDs, func(r rune) bool { return r == ',' || r == '\n' || r == '\r' || r == ' ' })
}

func (s DiscordSettings) Validate() error {
	if s.RoleMatchMode != "" && s.RoleMatchMode != "any" && s.RoleMatchMode != "all" {
		return ErrDiscordRoleMatchMode
	}
	if s.GuildID != "" && !validDiscordID(s.GuildID) {
		return ErrDiscordCommunitySettings
	}
	for _, role := range s.RequiredRoles() {
		if s.GuildID == "" || !validDiscordID(role) {
			return ErrDiscordCommunitySettings
		}
	}
	for _, guild := range s.BlockedGuilds() {
		if !validDiscordID(guild) {
			return ErrDiscordCommunitySettings
		}
	}
	if s.OnlyLogin && (!s.Enabled || strings.TrimSpace(s.ClientId) == "" || strings.TrimSpace(s.ClientSecret) == "") {
		return ErrDiscordLoginNotConfigured
	}
	return nil
}

func validDiscordID(value string) bool {
	id, err := strconv.ParseUint(value, 10, 64)
	return err == nil && id > 0 && strconv.FormatUint(id, 10) == value
}

// 默认配置
var defaultDiscordSettings = DiscordSettings{RoleMatchMode: "any"}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("discord", &defaultDiscordSettings)
}

func GetDiscordSettings() *DiscordSettings {
	return &defaultDiscordSettings
}
