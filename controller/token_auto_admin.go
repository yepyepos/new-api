package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// AdminGetUserTokens 管理员查看指定用户创建的全部 API 令牌。
// 密钥一律打码返回，管理员无法直接读到明文 Key。
func AdminGetUserTokens(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil || userId <= 0 {
		common.ApiErrorT(c, "Invalid user ID")
		return
	}
	if _, err := model.GetUserById(userId, false); err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo := common.GetPageQuery(c)
	tokens, err := model.GetAllUserTokens(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total, err := model.CountUserTokens(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildMaskedTokenResponses(tokens))
	common.ApiSuccess(c, pageInfo)
}

// AdminDeleteUserToken 管理员删除指定用户的单个 API 令牌（软删除，可用于恢复）。
func AdminDeleteUserToken(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil || userId <= 0 {
		common.ApiErrorT(c, "Invalid user ID")
		return
	}
	tokenId, err := strconv.Atoi(c.Param("token_id"))
	if err != nil || tokenId <= 0 {
		common.ApiErrorT(c, "Invalid token ID")
		return
	}

	token, err := model.GetTokenByIds(tokenId, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	name := token.Name
	if name == "" {
		name = "#" + strconv.Itoa(tokenId)
	}
	if err := token.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}

	recordManageAuditFor(c, userId, "user.token_delete", map[string]any{
		"id":   tokenId,
		"name": name,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// AdminDeleteUserTokensBatch 管理员批量删除指定用户的 API 令牌。
func AdminDeleteUserTokensBatch(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil || userId <= 0 {
		common.ApiErrorT(c, "Invalid user ID")
		return
	}

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

	count, err := model.BatchDeleteTokens(request.Ids, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	params := map[string]any{"count": count}
	if len(request.Ids) <= 100 {
		params["requested_ids"] = request.Ids
	} else {
		params["requested_ids"] = request.Ids[:100]
		params["requested_ids_truncated"] = true
	}
	recordManageAuditFor(c, userId, "user.token_delete_batch", params)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
}
