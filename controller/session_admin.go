package controller

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// RevokeAllLoginSessions signs every user out of the dashboard at once.
//
// Two things happen, because either alone leaves a hole: sessions are revoked
// (the refresh cookie stops working) and each affected user's auth version is
// advanced (access tokens already issued stop being accepted). Without the
// second step a stolen access token would keep working until it expired.
func RevokeAllLoginSessions(c *gin.Context) {
	now := time.Now().Unix()
	userIDs, err := model.ActiveUserSessionUserIDs(now)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	revoked, err := model.RevokeAllActiveUserSessions("admin_revoked_all", now)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// The caller is signed out too: leaving one session alive would let an
	// operator assume the action covered everyone when it did not.
	bumped, err := model.BumpAuthVersionsForUsers(userIDs)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "user.sessions_revoked_all", map[string]any{
		"revoked": revoked,
		"users":   bumped,
	})
	common.ApiSuccess(c, gin.H{
		"revoked": revoked,
		"users":   bumped,
	})
}
