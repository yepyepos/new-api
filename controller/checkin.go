package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.CheckinSettingsSnapshot()
	if !setting.Enabled {
		common.ApiErrorT(c, "Check-in feature is not enabled")
		return
	}
	userId := c.GetInt("id")
	// 获取月份参数，默认为当前月份
	today, err := setting.Today()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	month := c.DefaultQuery("month", today[:7])

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":           setting.Enabled,
			"min_quota":         setting.MinQuota,
			"max_quota":         setting.MaxQuota,
			"quota":             setting.Quota,
			"threshold_enabled": setting.ThresholdEnabled,
			"balance_threshold": setting.BalanceThreshold,
			"timezone":          setting.Timezone,
			"today":             today,
			"stats":             stats,
		},
	})
}

// DoCheckin 执行用户签到
func DoCheckin(c *gin.Context) {
	setting := operation_setting.CheckinSettingsSnapshot()
	if !setting.Enabled {
		common.ApiErrorT(c, "Check-in feature is not enabled")
		return
	}

	userId := c.GetInt("id")

	checkin, err := model.UserCheckin(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLog(userId, model.LogTypeSystem, common.NewMessage("Daily check-in, received {{quota}}", map[string]any{"quota": logger.FormatQuota(checkin.QuotaAwarded)}))
	common.ApiSuccessT(c, "Check-in successful", gin.H{
		"quota_awarded": checkin.QuotaAwarded,
		"checkin_date":  checkin.CheckinDate,
	})
}
