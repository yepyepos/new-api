package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// adminTokenItem 管理员令牌列表的一行：令牌（Key 已打码）+ 所属用户。
type adminTokenItem struct {
	*tokenResponse
	UserId      int    `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

// AdminListTokens 全站令牌列表 / 检索。支持 keyword 匹配令牌名、令牌 ID、
// 所属用户名或显示名。Key 一律打码返回。
func AdminListTokens(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	pageInfo := common.GetPageQuery(c)

	rows, total, err := model.AdminSearchTokens(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]*adminTokenItem, 0, len(rows))
	for _, row := range rows {
		if row == nil || row.Token == nil {
			continue
		}
		items = append(items, &adminTokenItem{
			tokenResponse: buildMaskedTokenResponse(row.Token),
			UserId:        row.Token.UserId,
			Username:      row.Username,
			DisplayName:   row.UserDisplayName,
		})
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// AdminDeleteTokensBatch 跨用户批量删除令牌（软删除，可按 deleted_at 恢复）。
func AdminDeleteTokensBatch(c *gin.Context) {
	var request struct {
		Ids []int `json:"ids"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if len(request.Ids) == 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	// 防止误传超大数组造成长事务。
	const maxBatchSize = 200
	if len(request.Ids) > maxBatchSize {
		common.ApiErrorT(c, "At most {{max}} tokens can be deleted at once", map[string]any{"max": maxBatchSize})
		return
	}

	count, affectedUsers, err := model.AdminBatchDeleteTokens(request.Ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	params := map[string]any{
		"count":    count,
		"user_ids": affectedUsers,
	}
	if len(request.Ids) <= 100 {
		params["requested_ids"] = request.Ids
	} else {
		params["requested_ids"] = request.Ids[:100]
		params["requested_ids_truncated"] = true
	}
	recordManageAudit(c, "token.admin_batch_delete", params)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
}

// AdminDeleteTokenById 跨用户删除单个令牌（软删除）。
func AdminDeleteTokenById(c *gin.Context) {
	tokenId, err := strconv.Atoi(c.Param("id"))
	if err != nil || tokenId <= 0 {
		common.ApiErrorT(c, "Invalid token ID")
		return
	}

	token, err := model.GetTokenById(tokenId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	name := token.Name
	if name == "" {
		name = "#" + strconv.Itoa(tokenId)
	}
	ownerId := token.UserId
	if err := token.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}

	recordManageAudit(c, "token.admin_delete", map[string]any{
		"id":             tokenId,
		"name":           name,
		"target_user_id": ownerId,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
