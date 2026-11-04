package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// siteClosureNotice is the sentence relay clients receive while the site is
// closed. It is deliberately stable so client operators can match on it, and
// the administrator's own notice is appended after it.
const siteClosureNotice = "The site is temporarily closed by the administrator. API requests are not accepted right now; please try again later."

// siteClosureRetryAfterSeconds tells a well-behaved client how long to wait
// before retrying a closed site.
const siteClosureRetryAfterSeconds = "600"

// SiteClosure rejects relay traffic while the site is closed.
//
// Register it after the group's authentication middleware: the closure decision
// needs the caller's user id so administrators and exempted users keep access,
// and closing the site must never lock the operator out of their own gateway.
func SiteClosure() gin.HandlerFunc {
	return func(c *gin.Context) {
		closure := operation_setting.GetSiteClosureSetting()
		if !closure.Enabled {
			c.Next()
			return
		}
		// Model listing stays available: it reaches no upstream and clients
		// probe it before choosing a model, so answering it keeps their tooling
		// from reporting a broken endpoint config.
		if c.Request.Method == http.MethodGet &&
			(c.Request.URL.Path == "/v1/models" || c.Request.URL.Path == "/v1beta/models") {
			c.Next()
			return
		}
		if !service.SiteClosureDeniesUser(c.GetInt("id")) {
			c.Next()
			return
		}
		writeSiteClosureError(c, closure.Notice)
	}
}

// writeSiteClosureError answers in the envelope the calling protocol expects.
// Claude clients read a different error shape than OpenAI ones.
func writeSiteClosureError(c *gin.Context, notice string) {
	message := siteClosureNotice
	if trimmed := strings.TrimSpace(notice); trimmed != "" {
		message = siteClosureNotice + " " + trimmed
	}
	c.Header("Retry-After", siteClosureRetryAfterSeconds)
	err := types.NewErrorWithStatusCode(errors.New(message), types.ErrorCode("site_closed"), http.StatusServiceUnavailable)
	if strings.HasPrefix(c.Request.URL.Path, "/v1/messages") {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.ToClaudeError()})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.ToOpenAIError()})
	}
	c.Abort()
}
