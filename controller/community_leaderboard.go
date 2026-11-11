package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const (
	// communityCheckinLeaderboardHalf is how many rows each end of the check-in
	// board keeps while collapsed.
	communityCheckinLeaderboardHalf = 25
	// communityUsageLeaderboardHead is how many rows the collapsed usage board
	// keeps.
	communityUsageLeaderboardHead = 50
)

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

// wantsExpandedLeaderboard reports whether the caller asked for the whole
// ranking instead of the trimmed ends.
func wantsExpandedLeaderboard(c *gin.Context) bool {
	value, err := strconv.ParseBool(c.DefaultQuery("expanded", "false"))
	return err == nil && value
}

// GetCheckinLeaderboard returns the highest and lowest check-in rewards of the
// day, or the whole ranking when expanded=true. Users who have not checked in
// today are omitted either way.
func GetCheckinLeaderboard(c *gin.Context) {
	if !ensureCommunityLeaderboardVisible(c) {
		return
	}
	today, err := model.CommunityLeaderboardCheckinDate()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	data := gin.H{"date": today}
	if wantsExpandedLeaderboard(c) {
		rows, total, err := model.GetTodayCheckinLeaderboardRows(today, 0)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		data["rows"], data["total"] = rows, total
		data["truncated"] = int64(len(rows)) < total
		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
		return
	}
	board, err := model.GetTodayCheckinLeaderboard(today, communityCheckinLeaderboardHalf)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	data["top"], data["bottom"], data["total"] = board.Top, board.Bottom, board.Total
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

// GetUsageLeaderboard returns the heaviest consumers of the given period
// (today, week or all), ordered by the final billed quota, or the whole ranking
// when expanded=true.
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
	data := gin.H{"period": period}
	if wantsExpandedLeaderboard(c) {
		rows, total, err := model.GetUsageLeaderboardRows(startTime, 0)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		data["rows"], data["total"] = rows, total
		data["truncated"] = int64(len(rows)) < total
		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
		return
	}
	board, err := model.GetUsageLeaderboard(startTime, communityUsageLeaderboardHead)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	data["top"], data["bottom"], data["total"] = board.Top, board.Bottom, board.Total
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}
