package service

import (
	"context"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const tokenAutoRevokeTickInterval = 30 * time.Second

// tokenAutoRevokeLastRun stores the yyyy-mm-dd that the revocation last ran on,
// so a restart inside the same minute cannot fire the job twice.
var tokenAutoRevokeLastRun atomic.Value

func tokenAutoRevokeDayKey(t time.Time) string {
	return t.Format("2006-01-02")
}

// StartTokenAutoRevokeTask 启动每日定时失效 API Key 的后台任务。
// 只有 master 节点执行，与其它维护任务保持一致。
func StartTokenAutoRevokeTask() {
	if !common.IsMasterNode {
		return
	}
	tokenAutoRevokeLastRun.Store("")
	go func() {
		ctx := context.Background()
		ticker := time.NewTicker(tokenAutoRevokeTickInterval)
		defer ticker.Stop()
		logger.LogInfo(ctx, common.LogText("token auto-revoke task started: tick=%s", tokenAutoRevokeTickInterval))
		for range ticker.C {
			runTokenAutoRevokeIfDue(ctx, time.Now())
		}
	}()
}

// runTokenAutoRevokeIfDue 在到达配置的每日时刻时执行一次失效。
// 抽出来便于单元测试，不含任何阻塞逻辑。
func runTokenAutoRevokeIfDue(ctx context.Context, now time.Time) {
	setting := operation_setting.GetTokenSetting()
	if setting == nil || !setting.AutoRevokeEnabled {
		return
	}

	hour, minute, ok := parseAutoRevokeTime(setting.AutoRevokeTime)
	if !ok {
		return
	}

	// 匹配到 HH:MM 才开始干活；窗口最多一分钟，配合 30 秒的 tick，
	// 正常情况下只会命中一次或两次，用 lastRun 去重。
	if now.Hour() != hour || now.Minute() != minute {
		return
	}
	today := tokenAutoRevokeDayKey(now)
	if last, _ := tokenAutoRevokeLastRun.Load().(string); last == today {
		return
	}

	total, err := model.CountActiveTokens()
	if err != nil {
		logger.LogError(ctx, common.LogText("token auto-revoke: count active tokens failed: %s", err.Error()))
		return
	}

	affected, err := model.RevokeAllTokensExcept(setting.AutoRevokeExemptUserIds, setting.AutoRevokeSkipAdmins)
	if err != nil {
		logger.LogError(ctx, common.LogText("token auto-revoke: revoke failed: %s", err.Error()))
		return
	}

	tokenAutoRevokeLastRun.Store(today)
	logger.LogInfo(ctx, common.LogText(
		"token auto-revoke done: date=%s time=%02d:%02d revoked=%d active_before=%d skip_admins=%t exempt_users=%d",
		today, hour, minute, affected, total, setting.AutoRevokeSkipAdmins, len(setting.AutoRevokeExemptUserIds),
	))
}

// parseAutoRevokeTime 解析 "HH:MM" 形式的每日执行时刻。
func parseAutoRevokeTime(value string) (hour int, minute int, ok bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, 0, false
	}
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		return 0, 0, false
	}
	return parsed.Hour(), parsed.Minute(), true
}
