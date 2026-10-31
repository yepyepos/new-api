package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetRegistrationAdmission(c *gin.Context) {
	setAuthNoStore(c)
	var batch model.RegistrationBatch
	if err := model.DB.First(&batch, 1).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var invites []model.RegistrationInvite
	if err := model.DB.Order("id DESC").Limit(200).Find(&invites).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"batch": batch, "invites": invites, "ordinary_open": common.RegisterEnabled && (!batch.Enabled || batch.Used < batch.Limit)})
}

func StartRegistrationBatch(c *gin.Context) {
	var request struct {
		Enabled bool `json:"enabled"`
		Limit   int  `json:"limit"`
		Reset   bool `json:"reset"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || request.Limit < 1 || request.Limit > 1000000000 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	values := map[string]any{"enabled": request.Enabled, "registration_limit": request.Limit}
	if request.Reset {
		values["used"] = 0
	}
	result := model.DB.Model(&model.RegistrationBatch{}).Where("id = 1").Updates(values)
	if result.Error != nil {
		common.ApiError(c, result.Error)
		return
	}
	recordManageAudit(c, "option.update", map[string]any{"key": "registration_batch", "reset": request.Reset})
	common.ApiSuccess(c, nil)
}

func CreateRegistrationInvitation(c *gin.Context) {
	setAuthNoStore(c)
	var request struct {
		Name      string `json:"name"`
		MaxUses   int    `json:"max_uses"`
		Exempt    bool   `json:"exempt"`
		ExpiresAt int64  `json:"expires_at"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	invite := model.RegistrationInvite{Name: request.Name, MaxUses: request.MaxUses, Exempt: request.Exempt, ExpiresAt: request.ExpiresAt}
	code, err := model.CreateRegistrationInvite(&invite)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "option.update", map[string]any{"key": "registration_invite.create", "invite_id": invite.ID})
	common.ApiSuccess(c, gin.H{"invite": invite, "code": code})
}

func DisableRegistrationInvitation(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id < 1 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := model.DB.Model(&model.RegistrationInvite{}).Where("id = ?", id).Update("disabled", true).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "option.update", map[string]any{"key": "registration_invite.disable", "invite_id": id})
	common.ApiSuccess(c, nil)
}
