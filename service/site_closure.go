package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// SiteClosureDeniesRole reports whether the site closure forbids this user from
// using the gateway or the console.
//
// Administrators, root, and explicitly exempted user ids always pass: closing
// the site must never lock the operator out of their own deployment, because the
// only other way back in would be the database or an environment variable.
func SiteClosureDeniesRole(userID int, role int) bool {
	if !operation_setting.IsSiteClosed() {
		return false
	}
	if userID <= 0 {
		return true
	}
	for _, exempt := range operation_setting.GetSiteClosureSetting().ExemptUserIds {
		if exempt == userID {
			return false
		}
	}
	return role < common.RoleAdminUser
}

// SiteClosureDeniesUser is SiteClosureDeniesRole for callers that only hold a
// user id, such as the relay middleware. An unknown user is denied, so a
// deleted account cannot slip through the closure.
func SiteClosureDeniesUser(userID int) bool {
	if !operation_setting.IsSiteClosed() {
		return false
	}
	if userID <= 0 {
		return true
	}
	for _, exempt := range operation_setting.GetSiteClosureSetting().ExemptUserIds {
		if exempt == userID {
			return false
		}
	}
	user, err := model.GetUserCache(userID)
	if err != nil {
		return true
	}
	return SiteClosureDeniesRole(userID, user.Role)
}
