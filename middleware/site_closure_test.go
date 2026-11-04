package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withSiteClosure puts the deployment into the state the middleware reads,
// restores the previous one afterwards, and returns nothing: the tests assert on
// the responses, not on the option.
func withSiteClosure(t *testing.T, enabled bool, notice string) {
	t.Helper()

	closure := operation_setting.GetSiteClosureSetting()
	previous := *closure
	t.Cleanup(func() { *closure = previous })

	closure.Enabled = enabled
	closure.Notice = notice
}

// relayClosureResponse runs one relay request through the closure middleware
// already authenticated as userId, and returns the recorded response.
func relayClosureResponse(t *testing.T, method, path string, userId int) *httptest.ResponseRecorder {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if userId > 0 {
			c.Set("id", userId)
		}
	})
	router.Handle(method, path, SiteClosure(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
	return recorder
}

func TestSiteClosurePassesTrafficWhileOpen(t *testing.T) {
	withSiteClosure(t, false, "")

	response := relayClosureResponse(t, http.MethodPost, "/v1/chat/completions", 12)

	assert.Equal(t, http.StatusOK, response.Code)
}

func TestSiteClosureRejectsRelayTrafficWithRetryHint(t *testing.T) {
	withSiteClosure(t, true, "We are back at 20:00.")
	setupSiteClosureUser(t, 12, common.RoleCommonUser)

	response := relayClosureResponse(t, http.MethodPost, "/v1/chat/completions", 12)

	require.Equal(t, http.StatusServiceUnavailable, response.Code)
	assert.Equal(t, siteClosureRetryAfterSeconds, response.Header().Get("Retry-After"))

	var body struct {
		Error struct {
			Message string `json:"message"`
			Code    string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	assert.Contains(t, body.Error.Message, "temporarily closed")
	assert.Contains(t, body.Error.Message, "We are back at 20:00.")
	assert.Equal(t, "site_closed", body.Error.Code)
}

func TestSiteClosureKeepsAdministratorsServing(t *testing.T) {
	withSiteClosure(t, true, "")
	setupSiteClosureUser(t, 12, common.RoleAdminUser)

	response := relayClosureResponse(t, http.MethodPost, "/v1/chat/completions", 12)

	assert.Equal(t, http.StatusOK, response.Code)
}

// A closed site must still answer model discovery: clients probe it before
// choosing a model, and a rejected probe reads as a broken endpoint config.
func TestSiteClosureAllowsModelListing(t *testing.T) {
	withSiteClosure(t, true, "")
	setupSiteClosureUser(t, 12, common.RoleCommonUser)

	assert.Equal(t, http.StatusOK, relayClosureResponse(t, http.MethodGet, "/v1/models", 12).Code)
	assert.Equal(t, http.StatusOK, relayClosureResponse(t, http.MethodGet, "/v1beta/models", 12).Code)
}

// A deleted or unknown caller has no role to read, so the closure refuses it
// rather than treating the missing lookup as permission.
func TestSiteClosureRejectsCallersWithNoResolvableUser(t *testing.T) {
	withSiteClosure(t, true, "")
	setupSiteClosureUser(t, 12, common.RoleCommonUser)

	response := relayClosureResponse(t, http.MethodPost, "/v1/chat/completions", 404)

	assert.Equal(t, http.StatusServiceUnavailable, response.Code)
}

func TestSiteClosureExemptionKeepsListedUserServing(t *testing.T) {
	withSiteClosure(t, true, "")
	setupSiteClosureUser(t, 12, common.RoleCommonUser)
	closure := operation_setting.GetSiteClosureSetting()
	closure.ExemptUserIds = []int{12}

	response := relayClosureResponse(t, http.MethodPost, "/v1/chat/completions", 12)

	assert.Equal(t, http.StatusOK, response.Code)
}

// setupSiteClosureUser gives the database the account the middleware resolves a
// caller's role from, so the closure decision runs against a real row.
func setupSiteClosureUser(t *testing.T, userId int, role int) {
	t.Helper()
	setupDashboardAuthMiddlewareTest(t)
	user := model.User{
		Id:          userId,
		Username:    "closure-caller",
		Password:    "{{SECRET_8ehfvap8}}",
		Role:        role,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, model.DB.Create(&user).Error)
}

// The closure helper above is the only place that reads the option; assert that
// going through it actually reaches service.SiteClosureDeniesUser, so a test
// cannot pass on a stale flag.
func TestSiteClosureDenialFollowsTheSetting(t *testing.T) {
	withSiteClosure(t, true, "notice")
	setupSiteClosureUser(t, 12, common.RoleCommonUser)

	assert.True(t, service.SiteClosureDeniesUser(12))
	// An unknown account has no role that could exempt it.
	assert.True(t, service.SiteClosureDeniesUser(404))

	withSiteClosure(t, false, "")
	assert.False(t, service.SiteClosureDeniesUser(12))
}
