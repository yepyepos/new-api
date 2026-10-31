package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublicBenefitCommercialAdmission(t *testing.T) {
	original := operation_setting.PublicBenefitModeEnabled
	t.Cleanup(func() { operation_setting.PublicBenefitModeEnabled = original })
	operation_setting.PublicBenefitModeEnabled = true
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	for _, endpoint := range []string{
		"GET /api/user/aff", "POST /api/user/aff_transfer",
		"GET /api/user/topup/info", "POST /api/user/topup", "POST /api/user/pay", "POST /api/user/amount",
		"POST /api/user/stripe/pay", "POST /api/user/stripe/amount", "POST /api/user/creem/pay",
		"POST /api/user/waffo/pay", "POST /api/user/waffo/amount",
		"POST /api/user/waffo-pancake/pay", "POST /api/user/waffo-pancake/amount",
		"GET /api/subscription/plans", "POST /api/subscription/balance/pay",
		"POST /api/subscription/stripe/pay", "POST /api/subscription/epay/pay",
		"POST /api/subscription/creem/pay", "POST /api/subscription/waffo-pancake/pay",
		"POST /api/subscription/admin/plans", "POST /api/subscription/admin/bind",
		"POST /api/redemption/", "PUT /api/redemption/", "GET /api/redemption/",
		"POST /api/option/payment_compliance", "POST /api/option/waffo-pancake/pair",
		"POST /api/option/waffo-pancake/save", "POST /api/option/waffo-pancake/subscription-product",
		"POST /api/user/topup/complete", "POST /api/stripe/webhook",
	} {
		t.Run(endpoint, func(t *testing.T) {
			method, path, ok := strings.Cut(endpoint, " ")
			require.True(t, ok)
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, httptest.NewRequest(method, path, strings.NewReader(`{}`)))
			assert.Equal(t, http.StatusForbidden, recorder.Code)
			assert.Contains(t, recorder.Body.String(), "COMMERCIAL_FEATURES_DISABLED")
		})
	}

	// Public benefit mode overrides even previously accepted commercial settings.
	payment := operation_setting.GetPaymentSetting()
	before := *payment
	t.Cleanup(func() { *payment = before })
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	assert.False(t, operation_setting.IsPaymentComplianceConfirmed())
	id, err := model.GetUserIdByAffCode("previous-referral")
	require.NoError(t, err)
	assert.Zero(t, id)
}

func TestPublicBenefitPreservesCommunityAndHistoryRoutes(t *testing.T) {
	original := operation_setting.PublicBenefitModeEnabled
	t.Cleanup(func() { operation_setting.PublicBenefitModeEnabled = original })
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(middleware.PublicBenefitMode())
	for _, path := range []string{
		"/api/user/checkin", "/api/oauth/state", "/api/user/register",
		"/api/option/registration/invites", "/api/option/registration/batch",
		"/api/user/topup/self", "/api/user/topup", "/api/user/self", "/api/log/self",
	} {
		engine.GET(path, func(c *gin.Context) { c.Status(http.StatusNoContent) })
	}
	engine.POST("/api/user/pay", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	operation_setting.PublicBenefitModeEnabled = true
	for _, path := range []string{
		"/api/user/checkin", "/api/oauth/state", "/api/user/register",
		"/api/option/registration/invites", "/api/option/registration/batch",
		"/api/user/topup/self", "/api/user/topup", "/api/user/self", "/api/log/self",
	} {
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		assert.Equal(t, http.StatusNoContent, recorder.Code, path)
	}
	operation_setting.PublicBenefitModeEnabled = false
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/user/pay", nil))
	assert.Equal(t, http.StatusNoContent, recorder.Code)
}
