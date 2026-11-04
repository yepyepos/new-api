package controller

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// siteClosureNoticeMaxRunes bounds the closure announcement. The notice is
// stored as an option value and sent to every client that polls the closure
// endpoint, so an unbounded value would be re-sent forever.
const siteClosureNoticeMaxRunes = 4000

// GetSiteClosure serves the closure state to the dashboard, which polls it while
// a page is open. It is deliberately separate from /api/status: that query is
// cached for minutes, and a closure is an emergency action that must reach open
// tabs long before the next cache refresh.
func GetSiteClosure(c *gin.Context) {
	closure := operation_setting.GetSiteClosureSetting()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"closed": closure.Enabled,
			"since":  closure.Since,
			"notice": closure.Notice,
		},
	})
}

// writeSiteClosureLoginError refuses a dashboard sign-in while the site is
// closed. The code is stable so the frontend can render the closure page
// instead of a generic authentication error.
func writeSiteClosureLoginError(c *gin.Context) {
	setAuthNoStore(c)
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"success": false,
		"code":    "SITE_CLOSED",
		"message": "The site is temporarily closed by the administrator.",
	})
}

// SetSiteClosure opens or closes the site in one request.
//
// The switch is a single action rather than separate option writes because a
// closure has to be atomic: writing "enabled" and "notice" as two ordinary
// option updates leaves a window where clients see the new state with the old
// announcement, and it would also stamp "since" only sometimes.
func SetSiteClosure(c *gin.Context) {
	var request struct {
		Enabled bool   `json:"enabled"`
		Notice  string `json:"notice"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	notice := strings.TrimSpace(request.Notice)
	if len([]rune(notice)) > siteClosureNoticeMaxRunes {
		common.ApiErrorT(c, "Site closure notice is too long")
		return
	}

	current := operation_setting.GetSiteClosureSetting()
	// The timestamp marks the start of *this* closure and survives a notice
	// edit; re-stamping on every save would make the page report a closure that
	// began whenever the text was last touched.
	since := current.Since
	if !request.Enabled {
		since = 0
	} else if !current.Enabled {
		since = time.Now().Unix()
	}

	values := map[string]string{
		"site_closure_setting.enabled": strconv.FormatBool(request.Enabled),
		"site_closure_setting.notice":  notice,
		"site_closure_setting.since":   strconv.FormatInt(since, 10),
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "option.site_closure", map[string]any{"enabled": request.Enabled})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"closed": request.Enabled,
			"since":  since,
			"notice": notice,
		},
	})
}
