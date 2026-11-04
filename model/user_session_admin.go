package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// RevokeAllActiveUserSessions revokes every active login session on the
// deployment, regardless of user.
//
// It backs the "sign everyone out" control: the site owner needs one action that
// ends every dashboard session at once, for example after a credential leak.
// Rows are kept — the status becomes revoked, which is what makes the refresh
// cookie unusable — so this stays consistent with the per-user revoke path and
// is recoverable in the database.
func RevokeAllActiveUserSessions(reason string, now int64) (int64, error) {
	if now <= 0 {
		now = time.Now().Unix()
	}
	var totalAffected int64
	for {
		var candidates []UserSession
		if err := DB.Where("status = ? AND expires_at > ?", UserSessionStatusActive, now).
			Order("sid").Limit(userSessionRevokeBatchSize).Find(&candidates).Error; err != nil {
			return totalAffected, err
		}
		if len(candidates) == 0 {
			return totalAffected, nil
		}
		for i := range candidates {
			if err := writeUserSessionDenyFence(&candidates[i], UserSessionStatusRevoking, now, reason); err != nil {
				return totalAffected, err
			}
		}
		sids := make([]string, 0, len(candidates))
		for i := range candidates {
			sids = append(sids, candidates[i].SID)
		}
		var affected int64
		var revoked []UserSession
		err := DB.Transaction(func(tx *gorm.DB) error {
			if err := lockForUpdate(tx).Where("sid IN ? AND status = ?", sids, UserSessionStatusActive).Find(&revoked).Error; err != nil {
				return err
			}
			if len(revoked) == 0 {
				return nil
			}
			lockedSIDs := make([]string, 0, len(revoked))
			for i := range revoked {
				lockedSIDs = append(lockedSIDs, revoked[i].SID)
			}
			result := tx.Model(&UserSession{}).Where("sid IN ? AND status = ?", lockedSIDs, UserSessionStatusActive).Updates(map[string]any{
				"status":         UserSessionStatusRevoked,
				"revoked_at":     now,
				"revoked_reason": reason,
			})
			affected = result.RowsAffected
			return result.Error
		})
		if err != nil {
			return totalAffected, err
		}
		totalAffected += affected
		for i := range revoked {
			revoked[i].Status = UserSessionStatusRevoked
			revoked[i].RevokedAt = now
			revoked[i].RevokedReason = reason
			if err := writeUserSessionCache(revoked[i].cacheEntry(), time.Time{}); err != nil {
				common.SysLog(common.LogText("failed to finalize global session revoke tombstone: %s", err.Error()))
			}
		}
	}
}

// BumpAuthVersionsForUsers advances the authentication version of every given
// user in one transaction and republishes their cached snapshot afterwards.
//
// A revoked session only stops the next refresh; an access token already issued
// stays valid until it expires. Matching on the auth version is what makes an
// immediate sign-out actually immediate.
func BumpAuthVersionsForUsers(userIDs []int) (int, error) {
	if len(userIDs) == 0 {
		return 0, nil
	}
	affected := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		for _, userID := range userIDs {
			if userID <= 0 {
				continue
			}
			if _, err := IncrementUserAuthVersionWithTx(tx, userID); err != nil {
				return err
			}
			affected++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	for _, userID := range userIDs {
		if userID <= 0 {
			continue
		}
		if err := PublishUserAuthCache(userID); err != nil {
			common.SysLog(common.LogText("failed to publish auth version for user %d: %s", userID, err.Error()))
		}
	}
	return affected, nil
}

// ActiveUserSessionUserIDs lists the users who currently hold a live session, so
// a global sign-out can advance exactly those auth versions.
func ActiveUserSessionUserIDs(now int64) ([]int, error) {
	if now <= 0 {
		now = time.Now().Unix()
	}
	var userIDs []int
	err := DB.Model(&UserSession{}).
		Where("status = ? AND expires_at > ?", UserSessionStatusActive, now).
		Distinct().Order("user_id").Pluck("user_id", &userIDs).Error
	return userIDs, err
}
