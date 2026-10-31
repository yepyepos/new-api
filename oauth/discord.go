package oauth

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

const DiscordCodeVerifierContextKey = "discord_code_verifier"

type discordAdmissionContextKey struct{}

// Only the server's validated OAuth flow may apply persisted admission rules.
// The blacklist is still enforced before this policy is considered.
func WithDiscordRegistrationInvite(ctx context.Context, hash string) context.Context {
	return context.WithValue(ctx, discordAdmissionContextKey{}, hash)
}

func init() {
	Register("discord", &DiscordProvider{})
}

// DiscordProvider implements OAuth for Discord
type DiscordProvider struct{}

type discordOAuthResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type discordUser struct {
	UID  string `json:"id"`
	ID   string `json:"username"`
	Name string `json:"global_name"`
}

func (p *DiscordProvider) GetName() string {
	return "Discord"
}

func (p *DiscordProvider) IsEnabled() bool {
	return system_setting.DiscordSettingsSnapshot().Enabled
}

func (p *DiscordProvider) AuthorizationURL(state, verifier string) string {
	settings := system_setting.DiscordSettingsSnapshot()
	scope := "identify"
	if settings.GuildID != "" {
		scope += " guilds.members.read"
	}
	if len(settings.BlockedGuilds()) > 0 {
		scope += " guilds"
	}
	values := url.Values{
		"client_id":             {settings.ClientId},
		"redirect_uri":          {strings.TrimRight(system_setting.ServerAddress, "/") + "/oauth/discord"},
		"response_type":         {"code"},
		"scope":                 {scope},
		"state":                 {state},
		"code_challenge":        {oauth2.S256ChallengeFromVerifier(verifier)},
		"code_challenge_method": {"S256"},
	}
	return "https://discord.com/oauth2/authorize?" + values.Encode()
}

func (p *DiscordProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" || c == nil || c.GetString(DiscordCodeVerifierContextKey) == "" {
		return nil, NewOAuthError(common.NewMessage(msgInvalidCode))
	}

	settings := system_setting.DiscordSettingsSnapshot()
	redirectUri := strings.TrimRight(system_setting.ServerAddress, "/") + "/oauth/discord"
	values := url.Values{}
	values.Set("client_id", settings.ClientId)
	values.Set("client_secret", settings.ClientSecret)
	values.Set("code", code)
	values.Set("grant_type", "authorization_code")
	values.Set("redirect_uri", redirectUri)
	values.Set("code_verifier", c.GetString(DiscordCodeVerifierContextKey))

	logger.LogDebug(ctx, "[OAuth-Discord] ExchangeToken: redirect_uri=%s", redirectUri)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://discord.com/api/v10/oauth2/token", strings.NewReader(values.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := http.Client{
		Timeout: 5 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, common.LogText("[OAuth-Discord] ExchangeToken error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(common.NewMessage(msgConnectFailed, map[string]any{"provider": "Discord"}), err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-Discord] ExchangeToken response status: %d", res.StatusCode)
	if res.StatusCode != http.StatusOK {
		return nil, NewOAuthError(common.NewMessage(msgTokenFailed, map[string]any{"provider": "Discord"}))
	}

	var discordResponse discordOAuthResponse
	err = common.DecodeJson(io.LimitReader(res.Body, 1<<20), &discordResponse)
	if err != nil {
		logger.LogError(ctx, common.LogText("[OAuth-Discord] ExchangeToken decode error: %s", err.Error()))
		return nil, err
	}

	if discordResponse.AccessToken == "" {
		logger.LogError(ctx, common.LogText("[OAuth-Discord] ExchangeToken failed: empty access token"))
		return nil, NewOAuthError(common.NewMessage(msgTokenFailed, map[string]any{"provider": "Discord"}))
	}

	logger.LogDebug(ctx, "[OAuth-Discord] ExchangeToken success: scope=%s", discordResponse.Scope)

	return &OAuthToken{
		AccessToken:  discordResponse.AccessToken,
		TokenType:    discordResponse.TokenType,
		RefreshToken: discordResponse.RefreshToken,
		ExpiresIn:    discordResponse.ExpiresIn,
		Scope:        discordResponse.Scope,
		IDToken:      discordResponse.IDToken,
	}, nil
}

func (p *DiscordProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	settings := system_setting.DiscordSettingsSnapshot()
	if err := settings.Validate(); err != nil {
		return nil, NewOAuthError(common.NewMessage(err.Error()))
	}
	logger.LogDebug(ctx, "[OAuth-Discord] GetUserInfo: fetching user info")

	req, err := http.NewRequestWithContext(ctx, "GET", "https://discord.com/api/v10/users/@me", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	client := http.Client{
		Timeout: 5 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, common.LogText("[OAuth-Discord] GetUserInfo error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(common.NewMessage(msgConnectFailed, map[string]any{"provider": "Discord"}), err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-Discord] GetUserInfo response status: %d", res.StatusCode)

	if res.StatusCode != http.StatusOK {
		logger.LogError(ctx, common.LogText("[OAuth-Discord] GetUserInfo failed: status=%d", res.StatusCode))
		return nil, NewOAuthError(common.NewMessage(msgGetUserFailed))
	}

	var discordUser discordUser
	err = common.DecodeJson(io.LimitReader(res.Body, 1<<20), &discordUser)
	if err != nil {
		logger.LogError(ctx, common.LogText("[OAuth-Discord] GetUserInfo decode error: %s", err.Error()))
		return nil, err
	}

	if discordUser.UID == "" || discordUser.ID == "" {
		logger.LogError(ctx, common.LogText("[OAuth-Discord] GetUserInfo failed: empty user fields"))
		return nil, NewOAuthError(common.NewMessage(msgUserInfoEmpty, map[string]any{"provider": "Discord"}))
	}
	if err := p.verifyGuildBlacklist(ctx, token.AccessToken, settings.BlockedGuilds()); err != nil {
		return nil, err
	}
	exempt := false
	if inviteHash, loginFlow := ctx.Value(discordAdmissionContextKey{}).(string); loginFlow {
		var err error
		exempt, err = model.DiscordAdmissionExempt(discordUser.UID, inviteHash)
		if err != nil {
			return nil, err
		}
	}
	if settings.GuildID != "" && !exempt {
		if err := p.verifyMembership(ctx, token.AccessToken, discordUser.UID, settings); err != nil {
			return nil, err
		}
	}

	logger.LogDebug(ctx, "[OAuth-Discord] GetUserInfo success: uid=%s, username=%s, name=%s", discordUser.UID, discordUser.ID, discordUser.Name)

	return &OAuthUser{
		ProviderUserID: discordUser.UID,
		Username:       discordUser.ID,
		DisplayName:    discordUser.Name,
	}, nil
}

// Discord's guild listing is paginated. A failed or malformed page must never
// be interpreted as proof that the user belongs to no prohibited server.
func (p *DiscordProvider) verifyGuildBlacklist(ctx context.Context, accessToken string, blocked []string) error {
	if len(blocked) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	after := ""
	for range 10 {
		values := url.Values{"limit": {"200"}}
		if after != "" {
			values.Set("after", after)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://discord.com/api/v10/users/@me/guilds?"+values.Encode(), nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		res, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
		if err != nil {
			return NewOAuthError(common.NewMessage("Unable to verify Discord server restrictions. Please authorize again or try later."))
		}
		var guilds []struct {
			ID string `json:"id"`
		}
		decodeErr := common.DecodeJson(io.LimitReader(res.Body, 2<<20), &guilds)
		res.Body.Close()
		if res.StatusCode != http.StatusOK || decodeErr != nil || guilds == nil {
			return NewOAuthError(common.NewMessage("Unable to verify Discord server restrictions. Please authorize again or try later."))
		}
		for _, guild := range guilds {
			if guild.ID == "" {
				return NewOAuthError(common.NewMessage("Unable to verify Discord server restrictions. Please authorize again or try later."))
			}
			if slices.Contains(blocked, guild.ID) {
				return NewOAuthError(common.NewMessage("Your Discord account belongs to a server that is not permitted here."))
			}
		}
		if len(guilds) < 200 {
			return nil
		}
		last := guilds[len(guilds)-1].ID
		if last == after {
			break
		}
		after = last
	}
	return NewOAuthError(common.NewMessage("Unable to verify Discord server restrictions. Please authorize again or try later."))
}

// verifyMembership runs before registration, login, binding, or OAuth step-up.
// Credentials are used only for this request; no Discord tokens are persisted.
func (p *DiscordProvider) verifyMembership(ctx context.Context, accessToken, userID string, settings system_setting.DiscordSettings) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://discord.com/api/v10/users/@me/guilds/"+settings.GuildID+"/member", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	client := http.Client{Timeout: 5 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return NewOAuthError(common.NewMessage("Unable to verify Discord membership. Please try again later."))
	}
	defer res.Body.Close()
	switch res.StatusCode {
	case http.StatusOK:
	case http.StatusNotFound:
		return NewOAuthError(common.NewMessage("Join the required Discord server before signing in."))
	case http.StatusUnauthorized, http.StatusForbidden:
		return NewOAuthError(common.NewMessage("Discord membership permission is missing or expired. Please authorize again."))
	default:
		return NewOAuthError(common.NewMessage("Unable to verify Discord membership. Please try again later."))
	}
	var member struct {
		User *struct {
			ID string `json:"id"`
		} `json:"user"`
		Roles   []string `json:"roles"`
		Pending bool     `json:"pending"`
	}
	if err := common.DecodeJson(io.LimitReader(res.Body, 1<<20), &member); err != nil || member.User == nil || member.User.ID != userID {
		return NewOAuthError(common.NewMessage("Unable to verify Discord membership. Please try again later."))
	}
	if member.Pending {
		return NewOAuthError(common.NewMessage("Complete the Discord server rules screening before signing in."))
	}
	roles := settings.RequiredRoles()
	matchedRoles := 0
	for _, role := range roles {
		if role == settings.GuildID || slices.Contains(member.Roles, role) {
			matchedRoles++
		}
	}
	if settings.RoleMatchMode == "all" && matchedRoles != len(roles) {
		return NewOAuthError(common.NewMessage("You do not have all required Discord roles."))
	}
	if len(roles) > 0 && matchedRoles == 0 {
		return NewOAuthError(common.NewMessage("You do not have a required Discord role."))
	}
	return nil
}

func (p *DiscordProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsDiscordIdAlreadyTaken(providerUserID)
}

func (p *DiscordProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.DiscordId = providerUserID
	return user.FillUserByDiscordId()
}

func (p *DiscordProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.DiscordId = providerUserID
}

func (p *DiscordProvider) GetProviderPrefix() string {
	return "discord_"
}

// ProviderUserIDColumn returns the users-table column storing this provider's user ID.
func (p *DiscordProvider) ProviderUserIDColumn() string {
	return "discord_id"
}
