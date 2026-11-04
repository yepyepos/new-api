package model

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
)

// AdminTokenRow 管理员视角的一条令牌记录：令牌本体 + 所属用户信息。
type AdminTokenRow struct {
	Token           *Token
	Username        string
	UserDisplayName string
}

// adminTokenSearchHardLimit 单次查询返回的最大条数，防止误查全表。
const adminTokenSearchHardLimit = 100

// AdminSearchTokens 跨用户检索令牌。keyword 为空时按 id 倒序分页返回全部；
// 否则匹配令牌名称、令牌 ID、所属用户名 / 显示名。
func AdminSearchTokens(keyword string, startIdx int, pageSize int) ([]*AdminTokenRow, int64, error) {
	if pageSize <= 0 || pageSize > adminTokenSearchHardLimit {
		pageSize = adminTokenSearchHardLimit
	}
	if startIdx < 0 {
		startIdx = 0
	}

	query := DB.Model(&Token{})
	if keyword != "" {
		like := "%" + keyword + "%"
		userSubQuery := "user_id IN (SELECT id FROM users WHERE username LIKE ? OR display_name LIKE ?)"
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where(
				"id = ? OR name LIKE ? OR "+userSubQuery,
				id, like, like, like,
			)
		} else {
			query = query.Where(
				"name LIKE ? OR "+userSubQuery,
				like, like, like,
			)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.SysError(common.LogText("failed to count admin tokens: %v", err))
		return nil, 0, common.NewMessage("Failed to load tokens")
	}

	var tokens []*Token
	if err := query.Order("id desc").Offset(startIdx).Limit(pageSize).Find(&tokens).Error; err != nil {
		common.SysError(common.LogText("failed to list admin tokens: %v", err))
		return nil, 0, common.NewMessage("Failed to load tokens")
	}

	if len(tokens) == 0 {
		return []*AdminTokenRow{}, total, nil
	}

	userIdSet := make(map[int]struct{}, len(tokens))
	for _, token := range tokens {
		userIdSet[token.UserId] = struct{}{}
	}
	userIds := make([]int, 0, len(userIdSet))
	for userId := range userIdSet {
		userIds = append(userIds, userId)
	}

	type userBrief struct {
		Id          int
		Username    string
		DisplayName string
	}
	var users []userBrief
	if err := DB.Model(&User{}).
		Select("id", "username", "display_name").
		Where("id IN ?", userIds).
		Find(&users).Error; err != nil {
		common.SysError(common.LogText("failed to load token owners: %v", err))
	}

	userMap := make(map[int]userBrief, len(users))
	for _, user := range users {
		userMap[user.Id] = user
	}

	rows := make([]*AdminTokenRow, 0, len(tokens))
	for _, token := range tokens {
		owner, ok := userMap[token.UserId]
		row := &AdminTokenRow{Token: token}
		if ok {
			row.Username = owner.Username
			row.UserDisplayName = owner.DisplayName
		}
		rows = append(rows, row)
	}
	return rows, total, nil
}

// AdminBatchDeleteTokens 跨用户批量软删除令牌（不限定 user_id）。
// 返回实际删除条数与受影响的用户 ID 列表。
func AdminBatchDeleteTokens(ids []int) (int, []int, error) {
	if len(ids) == 0 {
		return 0, nil, common.NewMessage("Token IDs cannot be empty")
	}

	tx := DB.Begin()
	if tx.Error != nil {
		return 0, nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var tokens []Token
	if err := tx.Where("id IN ?", ids).Find(&tokens).Error; err != nil {
		tx.Rollback()
		return 0, nil, err
	}
	if err := invalidateTokensCache(tokens); err != nil {
		common.SysLog(common.LogText("failed to invalidate token cache before admin batch delete: %s", err.Error()))
	}

	if err := tx.Where("id IN ?", ids).Delete(&Token{}).Error; err != nil {
		tx.Rollback()
		return 0, nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return 0, nil, err
	}

	affectedUsers := make([]int, 0, len(tokens))
	seen := make(map[int]struct{}, len(tokens))
	for _, token := range tokens {
		if _, ok := seen[token.UserId]; ok {
			continue
		}
		seen[token.UserId] = struct{}{}
		affectedUsers = append(affectedUsers, token.UserId)
	}
	return len(tokens), affectedUsers, nil
}

// CountAllActiveTokens 统计全部未删除令牌数量（用于首次进入页面时的提示）。
func CountAllActiveTokens() (int64, error) {
	var total int64
	err := DB.Model(&Token{}).Count(&total).Error
	return total, err
}
