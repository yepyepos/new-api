package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// RevokeAllTokensExcept 软删除（失效）全部未删除的 Token，可排除管理员账号与指定用户。
// 返回被失效的 Token 数量。
//
// Token 带 gorm.DeletedAt，Delete 是软删除：行还在，但后续 GetTokenByKey 查不到，
// 于是持有旧 Key 的客户端会收到 401，必须回后台重新创建。
func RevokeAllTokensExcept(exemptUserIds []int, skipAdmins bool) (int64, error) {
	// 先给一个恒真条件，避免 GORM 在没有任何条件时拒绝删除（ErrMissingWhereClause）。
	query := DB.Session(&gorm.Session{}).Where("1 = 1")
	if skipAdmins {
		query = query.Where(
			"user_id NOT IN (SELECT id FROM users WHERE role >= ?)",
			common.RoleAdminUser,
		)
	}
	if len(exemptUserIds) > 0 {
		query = query.Where("user_id NOT IN ?", exemptUserIds)
	}
	result := query.Delete(&Token{})
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

// CountActiveTokens 统计当前有效（未软删）的 Token 数量。
func CountActiveTokens() (int64, error) {
	var total int64
	err := DB.Model(&Token{}).Count(&total).Error
	return total, err
}
