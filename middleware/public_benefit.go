package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// PublicBenefitMode blocks commercial entry points before any handler can mutate
// a wallet or contact a payment provider. Quota usage and history remain available.
func PublicBenefitMode() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !operation_setting.PublicBenefitModeEnabled {
			c.Next()
			return
		}
		path := c.FullPath()
		blocked := strings.HasPrefix(path, "/api/subscription/") ||
			strings.HasPrefix(path, "/api/redemption/") ||
			strings.HasPrefix(path, "/api/option/waffo-pancake/") ||
			strings.HasPrefix(path, "/api/user/stripe/") ||
			strings.HasPrefix(path, "/api/user/creem/") ||
			strings.HasPrefix(path, "/api/user/waffo/") ||
			strings.HasPrefix(path, "/api/user/waffo-pancake/") ||
			strings.HasPrefix(path, "/api/user/epay/")
		switch path {
		case "/api/user/aff", "/api/user/aff_transfer", "/api/user/pay", "/api/user/amount",
			"/api/user/topup/info", "/api/user/topup/complete", "/api/option/payment_compliance",
			"/api/stripe/webhook", "/api/creem/webhook", "/api/waffo/webhook", "/api/waffo-pancake/webhook/:env":
			blocked = true
		case "/api/user/topup":
			blocked = c.Request.Method != http.MethodGet
		}
		if blocked {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"code":    "COMMERCIAL_FEATURES_DISABLED",
				"message": "Paid and referral features are disabled on this community site.",
			})
			return
		}
		c.Next()
	}
}
