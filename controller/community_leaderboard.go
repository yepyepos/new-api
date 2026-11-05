package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const communityLeaderboardLimit = 50

// ensureCommunityLeaderboardVisible keeps the leaderboards admin-only until the
// operator flips the public switch. Admins always pass.
func ensureCommunityLeaderboardVisible(c *gin.Context) bool {
	if c.GetInt("role") >= common.RoleAdminUser {
		return true
	}
	if operation_setting.IsCommunityLeaderboardPublic() {
		return true
	}
	common.ApiErrorT(c, "Leaderboard is not available")
	return false
}

// GetCheckinLeaderboard returns today's check-in rewards, ordered by amount.
// Users who have not checked in today are omitted.
func GetCheckinLeaderboard(c *gin.Context) {
	if !ensureCommunityLeaderboardVisible(c) {
		return
	}
	today, err := model.CommunityLeaderboardCheckinDate()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rows, total, err := model.GetTodayCheckinLeaderboard(today, communityLeaderboardLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"date":  today,
			"rows":  rows,
			"total": total,
		},
	})
}

// GetUsageLeaderboard returns billed model consumption per user for the given
// period (today, week or all), ordered by the final billed quota.
func GetUsageLeaderboard(c *gin.Context) {
	if !ensureCommunityLeaderboardVisible(c) {
		return
	}
	period := c.DefaultQuery("period", "today")
	startTime, err := operation_setting.CommunityLeaderboardSettingsSnapshot().PeriodStart(period)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rows, total, err := model.GetUsageLeaderboard(startTime, communityLeaderboardLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"period": period,
			"rows":   rows,
			"total":  total,
		},
	})
}
