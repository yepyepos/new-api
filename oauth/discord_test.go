package oauth

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

type discordTestTransport func(*http.Request) (*http.Response, error)

func (f discordTestTransport) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestDiscordCommunityAdmission(t *testing.T) {
	for _, test := range []struct {
		name       string
		guild      string
		roles      string
		matchMode  string
		status     int
		body       string
		networkErr bool
		want       string
	}{
		{name: "identity only without community settings"},
		{name: "member without role restrictions", guild: "123", status: 200, body: `{"user":{"id":"456"},"roles":[]}`},
		{name: "any configured role matches", guild: "123", roles: "789, 987", status: 200, body: `{"user":{"id":"456"},"roles":["987"]}`},
		{name: "explicit any role matches", guild: "123", roles: "789, 987", matchMode: "any", status: 200, body: `{"user":{"id":"456"},"roles":["789"]}`},
		{name: "all configured roles match", guild: "123", roles: "789, 987", matchMode: "all", status: 200, body: `{"user":{"id":"456"},"roles":["789","987","654"]}`},
		{name: "all mode rejects missing second role", guild: "123", roles: "789, 987", matchMode: "all", status: 200, body: `{"user":{"id":"456"},"roles":["789"]}`, want: "You do not have all required Discord roles."},
		{name: "all mode rejects missing first role", guild: "123", roles: "789, 987", matchMode: "all", status: 200, body: `{"user":{"id":"456"},"roles":["987"]}`, want: "You do not have all required Discord roles."},
		{name: "all mode rejects no matching roles", guild: "123", roles: "789, 987", matchMode: "all", status: 200, body: `{"user":{"id":"456"},"roles":[]}`, want: "You do not have all required Discord roles."},
		{name: "all mode without role restrictions", guild: "123", matchMode: "all", status: 200, body: `{"user":{"id":"456"},"roles":[]}`},
		{name: "all mode includes implicit everyone role", guild: "123", roles: "123,789", matchMode: "all", status: 200, body: `{"user":{"id":"456"},"roles":["789"]}`},
		{name: "everyone does not bypass other roles in all mode", guild: "123", roles: "123,789", matchMode: "all", status: 200, body: `{"user":{"id":"456"},"roles":[]}`, want: "You do not have all required Discord roles."},
		{name: "everyone role is implicit", guild: "123", roles: "123", status: 200, body: `{"user":{"id":"456"},"roles":[]}`},
		{name: "wrong role", guild: "123", roles: "789", status: 200, body: `{"user":{"id":"456"},"roles":["987"]}`, want: "You do not have a required Discord role."},
		{name: "not a member", guild: "123", status: 404, want: "Join the required Discord server before signing in."},
		{name: "permission missing", guild: "123", status: 403, want: "Discord membership permission is missing or expired. Please authorize again."},
		{name: "authorization expired", guild: "123", status: 401, want: "Discord membership permission is missing or expired. Please authorize again."},
		{name: "rules not accepted", guild: "123", status: 200, body: `{"user":{"id":"456"},"roles":[],"pending":true}`, want: "Complete the Discord server rules screening before signing in."},
		{name: "rate limited", guild: "123", status: 429, want: "Unable to verify Discord membership. Please try again later."},
		{name: "Discord outage", guild: "123", status: 503, want: "Unable to verify Discord membership. Please try again later."},
		{name: "network failure", guild: "123", networkErr: true, want: "Unable to verify Discord membership. Please try again later."},
		{name: "malformed member", guild: "123", status: 200, body: `{`, want: "Unable to verify Discord membership. Please try again later."},
		{name: "missing member identity", guild: "123", status: 200, body: `{}`, want: "Unable to verify Discord membership. Please try again later."},
		{name: "different member identity", guild: "123", status: 200, body: `{"user":{"id":"999"}}`, want: "Unable to verify Discord membership. Please try again later."},
	} {
		t.Run(test.name, func(t *testing.T) {
			settings := system_setting.GetDiscordSettings()
			previous, transport := *settings, http.DefaultTransport
			*settings = system_setting.DiscordSettings{GuildID: test.guild, RoleIDs: test.roles, RoleMatchMode: test.matchMode}
			t.Cleanup(func() { *settings, http.DefaultTransport = previous, transport })
			paths := []string{}
			http.DefaultTransport = discordTestTransport(func(req *http.Request) (*http.Response, error) {
				assert.Equal(t, "discord.com", req.URL.Host)
				assert.Equal(t, "https", req.URL.Scheme)
				assert.Equal(t, "GET", req.Method)
				assert.Equal(t, "Bearer test-access-token", req.Header.Get("Authorization"))
				paths = append(paths, req.URL.Path)
				if req.URL.Path == "/api/v10/users/@me" {
					return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"id":"456","username":"member"}`)), Header: http.Header{}}, nil
				}
				assert.Equal(t, "/api/v10/users/@me/guilds/123/member", req.URL.Path)
				if test.networkErr {
					return nil, errors.New("network unavailable")
				}
				return &http.Response{StatusCode: test.status, Body: io.NopCloser(strings.NewReader(test.body)), Header: http.Header{}}, nil
			})
			user, err := (&DiscordProvider{}).GetUserInfo(context.Background(), &OAuthToken{AccessToken: "test-access-token"})
			if test.want == "" {
				require.NoError(t, err)
				assert.Equal(t, "456", user.ProviderUserID)
			} else {
				require.EqualError(t, err, test.want)
				assert.Nil(t, user, "failed verification must not return an identity for registration or login")
			}
			if test.guild == "" {
				assert.Equal(t, []string{"/api/v10/users/@me"}, paths)
			} else {
				assert.Equal(t, []string{"/api/v10/users/@me", "/api/v10/users/@me/guilds/123/member"}, paths)
			}
		})
	}
}

func TestDiscordSettingsRejectInvalidAdmissionConfiguration(t *testing.T) {
	for _, test := range []struct {
		name     string
		settings system_setting.DiscordSettings
		want     error
	}{
		{name: "default unchanged"},
		{name: "server only", settings: system_setting.DiscordSettings{GuildID: "123"}},
		{name: "optional roles", settings: system_setting.DiscordSettings{GuildID: "123", RoleIDs: "456, 789"}},
		{name: "explicit any matching", settings: system_setting.DiscordSettings{RoleMatchMode: "any"}},
		{name: "all matching", settings: system_setting.DiscordSettings{RoleMatchMode: "all"}},
		{name: "invalid matching mode", settings: system_setting.DiscordSettings{RoleMatchMode: "either"}, want: system_setting.ErrDiscordRoleMatchMode},
		{name: "roles need server", settings: system_setting.DiscordSettings{RoleIDs: "456"}, want: system_setting.ErrDiscordCommunitySettings},
		{name: "server must be ID not invite", settings: system_setting.DiscordSettings{GuildID: "https://discord.gg/example"}, want: system_setting.ErrDiscordCommunitySettings},
		{name: "role names not accepted", settings: system_setting.DiscordSettings{GuildID: "123", RoleIDs: "member"}, want: system_setting.ErrDiscordCommunitySettings},
		{name: "overflow ID", settings: system_setting.DiscordSettings{GuildID: "18446744073709551616"}, want: system_setting.ErrDiscordCommunitySettings},
		{name: "noncanonical ID", settings: system_setting.DiscordSettings{GuildID: "00123"}, want: system_setting.ErrDiscordCommunitySettings},
		{name: "cannot require disabled login", settings: system_setting.DiscordSettings{OnlyLogin: true}, want: system_setting.ErrDiscordLoginNotConfigured},
		{name: "client credentials required", settings: system_setting.DiscordSettings{OnlyLogin: true, Enabled: true, ClientId: "client"}, want: system_setting.ErrDiscordLoginNotConfigured},
		{name: "configured Discord only", settings: system_setting.DiscordSettings{OnlyLogin: true, Enabled: true, ClientId: "client", ClientSecret: "secret"}},
		{name: "valid exempt user IDs", settings: system_setting.DiscordSettings{ExemptUserIDs: "456, 654"}},
		{name: "invalid exempt user ID", settings: system_setting.DiscordSettings{ExemptUserIDs: "member"}, want: system_setting.ErrDiscordCommunitySettings},
	} {
		t.Run(test.name, func(t *testing.T) { assert.ErrorIs(t, test.settings.Validate(), test.want) })
	}
}

func TestDiscordCodeExchangeRequiresBrowserBoundPKCE(t *testing.T) {
	settings := system_setting.GetDiscordSettings()
	previous, transport := *settings, http.DefaultTransport
	*settings = system_setting.DiscordSettings{ClientId: "test-client", ClientSecret: "test-secret"}
	t.Cleanup(func() { *settings, http.DefaultTransport = previous, transport })
	verifier := oauth2.GenerateVerifier()
	http.DefaultTransport = discordTestTransport(func(req *http.Request) (*http.Response, error) {
		assert.Equal(t, "https://discord.com/api/v10/oauth2/token", req.URL.String())
		require.NoError(t, req.ParseForm())
		assert.Equal(t, verifier, req.Form.Get("code_verifier"))
		assert.Equal(t, "test-client", req.Form.Get("client_id"))
		assert.Equal(t, "authorization-code", req.Form.Get("code"))
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"access_token":"test-access","token_type":"Bearer"}`)), Header: http.Header{}}, nil
	})
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	_, err := (&DiscordProvider{}).ExchangeToken(context.Background(), "authorization-code", c)
	require.Error(t, err, "a callback without its server-validated browser binding cannot exchange the code")
	c.Set(DiscordCodeVerifierContextKey, verifier)
	token, err := (&DiscordProvider{}).ExchangeToken(context.Background(), "authorization-code", c)
	require.NoError(t, err)
	assert.Equal(t, "test-access", token.AccessToken)
}

func TestDiscordExemptUsersSkipMembership(t *testing.T) {
	settings := system_setting.GetDiscordSettings()
	previous, transport := *settings, http.DefaultTransport
	t.Cleanup(func() { *settings, http.DefaultTransport = previous, transport })
	*settings = system_setting.DiscordSettings{GuildID: "123", RoleIDs: "789", RoleMatchMode: "all", BlockedGuildIDs: "999", ExemptUserIDs: "456, 654"}
	for _, test := range []struct {
		name   string
		uid    string
		guilds string
		member string
		status int
		want   string
	}{
		{name: "exempt user skips membership", uid: "456", guilds: `[]`, status: 200},
		{name: "exempt user listed with whitespace", uid: "654", guilds: `[]`, status: 200},
		{name: "non-exempt user still denied", uid: "111", guilds: `[]`, member: `{"user":{"id":"111"},"roles":[]}`, status: 200, want: "You do not have all required Discord roles."},
		{name: "blocked guild beats exemption", uid: "456", guilds: `[{"id":"999"}]`, status: 200, want: "not permitted"},
	} {
		t.Run(test.name, func(t *testing.T) {
			*settings = system_setting.DiscordSettings{GuildID: "123", RoleIDs: "789", RoleMatchMode: "all", BlockedGuildIDs: "999", ExemptUserIDs: "456, 654"}
			memberCalled := false
			http.DefaultTransport = discordTestTransport(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/v10/users/@me":
					return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"id":"` + test.uid + `","username":"member"}`)), Header: http.Header{}}, nil
				case "/api/v10/users/@me/guilds":
					return &http.Response{StatusCode: test.status, Body: io.NopCloser(strings.NewReader(test.guilds)), Header: http.Header{}}, nil
				case "/api/v10/users/@me/guilds/123/member":
					memberCalled = true
					return &http.Response{StatusCode: test.status, Body: io.NopCloser(strings.NewReader(test.member)), Header: http.Header{}}, nil
				}
				t.Fatalf("unexpected path: %s", req.URL.Path)
				return nil, nil
			})
			user, err := (&DiscordProvider{}).GetUserInfo(context.Background(), &OAuthToken{AccessToken: "test-access"})
			if test.want == "" {
				require.NoError(t, err)
				require.NotNil(t, user)
				assert.Equal(t, test.uid, user.ProviderUserID)
				assert.False(t, memberCalled, "exempt users must not hit the membership endpoint")
			} else {
				require.ErrorContains(t, err, test.want)
				assert.Nil(t, user)
			}
		})
	}
}

func TestDiscordInviteExemptionCannotBypassBlacklist(t *testing.T) {
	previousDB, previousSettings, transport := model.DB, *system_setting.GetDiscordSettings(), http.DefaultTransport
	t.Cleanup(func() {
		model.DB = previousDB
		*system_setting.GetDiscordSettings() = previousSettings
		http.DefaultTransport = transport
	})
	var err error
	model.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := model.DB.DB()
	require.NoError(t, err)
	defer sqlDB.Close()
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.RegistrationInvite{}, &model.RegistrationAdmission{}))
	invite := &model.RegistrationInvite{Name: "exempt", MaxUses: 1, Exempt: true}
	code, err := model.CreateRegistrationInvite(invite)
	require.NoError(t, err)
	for _, test := range []struct {
		name, body string
		status     int
		want       string
	}{
		{"exempt skips positive roles", `[{"id":"111"}]`, 200, ""},
		{"blacklist beats exemption", `[{"id":"999"}]`, 200, "not permitted"},
		{"empty list allowed", `[]`, 200, ""},
		{"scope denied", `{}`, 403, "Unable to verify"},
		{"rate limited", `[]`, 429, "Unable to verify"},
		{"malformed guilds", `{}`, 200, "Unable to verify"},
		{"missing guild identity", `[{}]`, 200, "Unable to verify"},
		{"null response", `null`, 200, "Unable to verify"},
	} {
		t.Run(test.name, func(t *testing.T) {
			*system_setting.GetDiscordSettings() = system_setting.DiscordSettings{GuildID: "123", RoleIDs: "789", BlockedGuildIDs: "999"}
			http.DefaultTransport = discordTestTransport(func(req *http.Request) (*http.Response, error) {
				body, status := test.body, test.status
				if req.URL.Path == "/api/v10/users/@me" {
					body, status = `{"id":"456","username":"member"}`, 200
				} else {
					assert.Equal(t, "/api/v10/users/@me/guilds", req.URL.Path, "exempt users must not need the positive membership endpoint")
				}
				return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
			})
			ctx := WithDiscordRegistrationInvite(context.Background(), model.HashRegistrationInvite(code))
			user, err := (&DiscordProvider{}).GetUserInfo(ctx, &OAuthToken{AccessToken: "test-access"})
			if test.want == "" {
				require.NoError(t, err)
				require.NotNil(t, user)
			} else {
				require.ErrorContains(t, err, test.want)
				assert.Nil(t, user)
			}
		})
	}
	t.Run("blocked guild on subsequent page", func(t *testing.T) {
		pages := 0
		http.DefaultTransport = discordTestTransport(func(req *http.Request) (*http.Response, error) {
			pages++
			body := `[{"id":"999"}]`
			if pages == 1 {
				guilds := make([]map[string]string, 200)
				for i := range guilds {
					guilds[i] = map[string]string{"id": "111"}
				}
				data, err := common.Marshal(guilds)
				require.NoError(t, err)
				body = string(data)
			} else {
				assert.Equal(t, "111", req.URL.Query().Get("after"))
			}
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
		})
		err := (&DiscordProvider{}).verifyGuildBlacklist(context.Background(), "test-access", []string{"999"})
		require.ErrorContains(t, err, "not permitted")
		assert.Equal(t, 2, pages)
	})
}
