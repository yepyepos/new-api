package model

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestCommunityAdmissionDatabaseMatrix(t *testing.T) {
	previousDB, previousType := DB, common.MainDatabaseType()
	previousRegister, previousRedis := common.RegisterEnabled, common.RedisEnabled
	previousCheckin := *operation_setting.GetCheckinSetting()
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.RegisterEnabled, common.RedisEnabled = previousRegister, previousRedis
		*operation_setting.GetCheckinSetting() = previousCheckin
	})
	common.RegisterEnabled, common.RedisEnabled = true, false
	for _, dialect := range []common.DatabaseType{common.DatabaseTypeSQLite, common.DatabaseTypeMySQL, common.DatabaseTypePostgreSQL} {
		t.Run(string(dialect), func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case common.DatabaseTypeSQLite:
				driver = sqlite.Open(filepath.Join(t.TempDir(), "community.db"))
			case common.DatabaseTypeMySQL:
				if os.Getenv("TEST_MYSQL_DSN") == "" {
					t.Skip("TEST_MYSQL_DSN not configured")
				}
				driver = mysql.Open(os.Getenv("TEST_MYSQL_DSN"))
			case common.DatabaseTypePostgreSQL:
				if os.Getenv("TEST_POSTGRES_DSN") == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(os.Getenv("TEST_POSTGRES_DSN"))
			}
			var err error
			DB, err = gorm.Open(driver, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			require.NoError(t, err)
			common.SetMainDatabaseType(dialect)
			sqlDB, err := DB.DB()
			require.NoError(t, err)
			if dialect == common.DatabaseTypeSQLite {
				sqlDB.SetMaxOpenConns(1)
			}
			defer sqlDB.Close()
			var version string
			query := "select version()"
			if dialect == common.DatabaseTypeSQLite {
				query = "select sqlite_version()"
			}
			require.NoError(t, DB.Raw(query).Scan(&version).Error)
			t.Logf("database version: %s", version)
			models := []any{&RegistrationAdmission{}, &RegistrationInvite{}, &RegistrationBatch{}, &Checkin{}, &User{}, &Log{}}
			for _, upgrade := range []bool{false, true} {
				t.Run(fmt.Sprintf("upgrade=%v", upgrade), func(t *testing.T) {
					require.NoError(t, DB.Migrator().DropTable(models...))
					defer DB.Migrator().DropTable(models...)
					if upgrade {
						// These unchanged models represent the released pre-feature tables.
						require.NoError(t, DB.AutoMigrate(&User{}, &Checkin{}))
						require.NoError(t, DB.Create(&User{Id: 10, Username: "legacy", AffCode: "legacy", Quota: 70}).Error)
						require.NoError(t, DB.Create(&Checkin{UserId: 10, CheckinDate: "2026-01-01", QuotaAwarded: 70}).Error)
					}
					for range 2 {
						require.NoError(t, DB.AutoMigrate(models...))
						require.NoError(t, InitializeRegistrationBatch())
					}
					if upgrade {
						var legacy User
						require.NoError(t, DB.First(&legacy, 10).Error)
						assert.Equal(t, 70, legacy.Quota)
						assert.True(t, DB.Migrator().HasIndex(&Checkin{}, "idx_user_checkin_date"))
						assert.True(t, DB.Migrator().HasIndex(&Checkin{}, "idx_checkin_date"), "the date-only index serves the daily leaderboard")
						assert.Error(t, DB.Create(&Checkin{UserId: 10, CheckinDate: "2026-01-01"}).Error)
					}
					require.NoError(t, DB.Model(&RegistrationBatch{}).Where("id = 1").Updates(map[string]any{"enabled": true, "registration_limit": 1}).Error)
					ordinary := &User{Username: "ordinary", DiscordId: "100", Status: common.UserStatusEnabled}
					require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return ordinary.RegisterWithTx(tx, 0, "") }))
					assert.Error(t, DB.Transaction(func(tx *gorm.DB) error { return (&User{Username: "overflow"}).RegisterWithTx(tx, 0, "") }))
					var batch RegistrationBatch
					require.NoError(t, DB.First(&batch, 1).Error)
					assert.Equal(t, 1, batch.Used)
					invite := &RegistrationInvite{Name: "exempt", MaxUses: 1, Exempt: true}
					code, err := CreateRegistrationInvite(invite, "")
					require.NoError(t, err)
					assert.NotContains(t, invite.CodeHash, code)
					hash := HashRegistrationInvite(code)
					// An operator-chosen code is hashed like a generated one, so the
					// database still keeps nothing usable, and Chinese codes work.
					custom := &RegistrationInvite{Name: "custom", MaxUses: 1}
					customCode, err := CreateRegistrationInvite(custom, "  鼓浪屿-2026  ")
					require.NoError(t, err)
					assert.Equal(t, "鼓浪屿-2026", customCode, "surrounding spaces are trimmed")
					assert.NotContains(t, custom.CodeHash, customCode)
					assert.Equal(t, custom.CodeHash, HashRegistrationInvite("鼓浪屿-2026"), "hashing is normalized")
					_, err = GetRegistrationInvite(HashRegistrationInvite("鼓浪屿-2026"))
					require.NoError(t, err, "a Chinese invitation code can be redeemed")
					_, err = CreateRegistrationInvite(&RegistrationInvite{Name: "again", MaxUses: 1}, "鼓浪屿-2026")
					assert.ErrorContains(t, err, "already in use")
					for _, rejected := range []string{"短码", "ab", "has space", "emoji😀ok", "punct!code"} {
						_, err := CreateRegistrationInvite(&RegistrationInvite{Name: "bad", MaxUses: 1}, rejected)
						assert.Error(t, err, "must reject %q", rejected)
					}
					exempt, err := DiscordAdmissionExempt("101", hash)
					require.NoError(t, err)
					assert.True(t, exempt)
					exempt, err = DiscordAdmissionExempt("100", hash)
					require.NoError(t, err)
					assert.False(t, exempt, "existing users cannot acquire exemption by presenting a code")
					// Failure after capacity consumption rolls the slot back.
					assert.Error(t, DB.Transaction(func(tx *gorm.DB) error { return (&User{Username: "ordinary"}).RegisterWithTx(tx, 0, hash) }))
					require.NoError(t, DB.First(invite, invite.ID).Error)
					assert.Zero(t, invite.Used)
					common.RegisterEnabled = false
					invited := &User{Username: "invited", DiscordId: "101", Status: common.UserStatusEnabled}
					require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return invited.RegisterWithTx(tx, 0, hash) }))
					common.RegisterEnabled = true
					exempt, err = DiscordAdmissionExempt("101", "")
					require.NoError(t, err)
					assert.True(t, exempt, "login retains the account's admission without another code")
					assert.Error(t, DB.Transaction(func(tx *gorm.DB) error { return (&User{Username: "replay"}).RegisterWithTx(tx, 0, hash) }))
					require.NoError(t, DB.First(&batch, 1).Error)
					assert.Equal(t, 1, batch.Used, "invites bypass the ordinary counter")
					require.NoError(t, InitializeRegistrationBatch())
					require.NoError(t, DB.First(&batch, 1).Error)
					assert.Equal(t, 1, batch.Used, "startup must not reopen a full batch")
					for _, invalid := range []RegistrationInvite{
						{Name: "disabled", MaxUses: 1}, {Name: "expired", MaxUses: 1},
					} {
						code, err := CreateRegistrationInvite(&invalid, "")
						require.NoError(t, err)
						changes := map[string]any{"disabled": true}
						if invalid.Name == "expired" {
							changes = map[string]any{"expires_at": time.Now().Unix() - 1}
						}
						require.NoError(t, DB.Model(&invalid).Updates(changes).Error)
						_, err = GetRegistrationInvite(HashRegistrationInvite(code))
						assert.Error(t, err)
					}
					// Two contenders for the last invite slot: exactly one account commits.
					last := &RegistrationInvite{Name: "last", MaxUses: 1}
					lastCode, err := CreateRegistrationInvite(last, "")
					require.NoError(t, err)
					results := make(chan error, 2)
					var group sync.WaitGroup
					for i := range 2 {
						group.Go(func() {
							results <- DB.Transaction(func(tx *gorm.DB) error {
								return (&User{Username: fmt.Sprintf("contender%d", i)}).RegisterWithTx(tx, 0, HashRegistrationInvite(lastCode))
							})
						})
					}
					group.Wait()
					close(results)
					commits := 0
					for err := range results {
						if err == nil {
							commits++
						}
					}
					assert.Equal(t, 1, commits)
					require.NoError(t, DB.First(last, last.ID).Error)
					assert.Equal(t, 1, last.Used)
					// A blocked claim does not consume today's chance; equality grants the full reward.
					*operation_setting.GetCheckinSetting() = operation_setting.CheckinSetting{Enabled: true, Quota: 50, ThresholdEnabled: true, BalanceThreshold: 100, Timezone: "Asia/Hong_Kong"}
					require.NoError(t, DB.Model(invited).Update("quota", 101).Error)
					_, err = UserCheckin(invited.Id)
					assert.ErrorContains(t, err, "above the check-in threshold")
					checked, err := HasCheckedInToday(invited.Id)
					assert.NoError(t, err)
					assert.False(t, checked)
					require.NoError(t, DB.Model(invited).Update("quota", 100).Error)
					claim, err := UserCheckin(invited.Id)
					require.NoError(t, err)
					assert.Equal(t, 50, claim.QuotaAwarded)
					// The standings describe the first check-in of the day.
					assert.Equal(t, 1, claim.RankToday)
					assert.Equal(t, 1, claim.TotalToday)
					assert.Equal(t, 1, claim.QuotaRankToday)
					assert.False(t, claim.QuotaRankTied)
					assert.Equal(t, 1, claim.StreakDays)
					assert.Zero(t, claim.BeatsPercent, "the only check-in of the day beats nobody")
					_, err = UserCheckin(invited.Id)
					assert.ErrorContains(t, err, "Already checked in today")
					require.NoError(t, DB.First(invited, invited.Id).Error)
					assert.Equal(t, 150, invited.Quota)
					// A configured range awards inside it; min == max stays fixed.
					ranged := &User{Username: "ranged", Status: common.UserStatusEnabled, AffCode: "ranged"}
					require.NoError(t, DB.Create(ranged).Error)
					*operation_setting.GetCheckinSetting() = operation_setting.CheckinSetting{Enabled: true, Quota: 50, MinQuota: 40, MaxQuota: 60, Timezone: "Asia/Hong_Kong"}
					for range 5 {
						require.NoError(t, DB.Where("user_id = ?", ranged.Id).Delete(&Checkin{}).Error)
						reward, rewardErr := UserCheckin(ranged.Id)
						require.NoError(t, rewardErr)
						assert.GreaterOrEqual(t, reward.QuotaAwarded, 40)
						assert.LessOrEqual(t, reward.QuotaAwarded, 60)
					}
					*operation_setting.GetCheckinSetting() = operation_setting.CheckinSetting{Enabled: true, Quota: 50, MinQuota: 70, MaxQuota: 70, Timezone: "Asia/Hong_Kong"}
					require.NoError(t, DB.Where("user_id = ?", ranged.Id).Delete(&Checkin{}).Error)
					fixed, fixedErr := UserCheckin(ranged.Id)
					require.NoError(t, fixedErr)
					assert.Equal(t, 70, fixed.QuotaAwarded)
					// The streak counts consecutive site days ending today.
					today, err := operation_setting.CheckinSettingsSnapshot().Today()
					require.NoError(t, err)
					location, err := time.LoadLocation("Asia/Hong_Kong")
					require.NoError(t, err)
					streaker := &User{Username: "streaker", Status: common.UserStatusEnabled, AffCode: "streaker", Quota: 1}
					require.NoError(t, DB.Create(streaker).Error)
					yesterday, err := previousSiteDate(today, location)
					require.NoError(t, err)
					dayBefore, err := previousSiteDate(yesterday, location)
					require.NoError(t, err)
					require.NoError(t, DB.Create(&Checkin{UserId: streaker.Id, CheckinDate: yesterday, QuotaAwarded: 10}).Error)
					require.NoError(t, DB.Create(&Checkin{UserId: streaker.Id, CheckinDate: dayBefore, QuotaAwarded: 10}).Error)
					streakClaim, err := UserCheckin(streaker.Id)
					require.NoError(t, err)
					assert.Equal(t, 3, streakClaim.StreakDays, "today plus the two consecutive days before it")
					// A gap one day back restarts the streak, and the calendar day
					// before the first of a year is the last of the previous year.
					gapped := &User{Username: "gapped", Status: common.UserStatusEnabled, AffCode: "gapped", Quota: 1}
					require.NoError(t, DB.Create(gapped).Error)
					threeDaysAgo, err := previousSiteDate(dayBefore, location)
					require.NoError(t, err)
					require.NoError(t, DB.Create(&Checkin{UserId: gapped.Id, CheckinDate: threeDaysAgo, QuotaAwarded: 10}).Error)
					gapClaim, err := UserCheckin(gapped.Id)
					require.NoError(t, err)
					assert.Equal(t, 1, gapClaim.StreakDays, "a missed day restarts the count")
					crossYear, err := previousSiteDate("2026-01-01", time.UTC)
					require.NoError(t, err)
					assert.Equal(t, "2025-12-31", crossYear)
					crossMonth, err := previousSiteDate("2026-03-01", time.UTC)
					require.NoError(t, err)
					assert.Equal(t, "2026-02-28", crossMonth)
					assert.Error(t, (operation_setting.CheckinSetting{Quota: 50, MinQuota: 70, MaxQuota: 60, Timezone: "UTC"}).Validate(), "an inverted range must be rejected")
					// The console saves each range end in its own request, so a
					// half-configured range must stay valid; only an inverted or
					// out-of-range pair is rejected.
					assert.NoError(t, (operation_setting.CheckinSetting{Quota: 50, MinQuota: 40, MaxQuota: 0, Timezone: "UTC"}).Validate(), "a pending maximum must be accepted")
					assert.NoError(t, (operation_setting.CheckinSetting{Quota: 50, MinQuota: 0, MaxQuota: 60, Timezone: "UTC"}).Validate(), "a pending minimum must be accepted")
					assert.Error(t, (operation_setting.CheckinSetting{Quota: 50, MinQuota: -1, MaxQuota: 60, Timezone: "UTC"}).Validate(), "a negative minimum must be rejected")
					assert.Error(t, (operation_setting.CheckinSetting{Quota: 50, MinQuota: 40, MaxQuota: common.MaxWalletQuota + 1, Timezone: "UTC"}).Validate(), "a maximum above the wallet limit must be rejected")
					*operation_setting.GetCheckinSetting() = operation_setting.CheckinSetting{Enabled: true, Quota: 50, ThresholdEnabled: true, BalanceThreshold: 100, Timezone: "Asia/Hong_Kong"}
					require.NoError(t, DB.Model(ordinary).Update("quota", 1).Error)
					operation_setting.GetCheckinSetting().ThresholdEnabled = false
					operation_setting.GetCheckinSetting().Quota = common.MaxWalletQuota
					_, err = UserCheckin(ordinary.Id)
					assert.ErrorIs(t, err, ErrWalletQuotaLimitExceeded)
					checked, err = HasCheckedInToday(ordinary.Id)
					assert.NoError(t, err)
					assert.False(t, checked)
					// Failure after recording a claim must roll back the record as well.
					operation_setting.GetCheckinSetting().Quota = 50
					require.NoError(t, DB.Callback().Update().Before("gorm:update").Register("community:quota-failure", func(tx *gorm.DB) {
						if tx.Statement.Table == "users" {
							tx.AddError(fmt.Errorf("injected quota failure"))
						}
					}))
					_, err = UserCheckin(ordinary.Id)
					assert.Error(t, err)
					require.NoError(t, DB.Callback().Update().Remove("community:quota-failure"))
					checked, err = HasCheckedInToday(ordinary.Id)
					assert.NoError(t, err)
					assert.False(t, checked)
					require.NoError(t, DB.First(ordinary, ordinary.Id).Error)
					assert.Equal(t, 1, ordinary.Quota)
					claims := make(chan error, 2)
					for range 2 {
						group.Go(func() { _, err := UserCheckin(ordinary.Id); claims <- err })
					}
					group.Wait()
					close(claims)
					commits = 0
					for err := range claims {
						if err == nil {
							commits++
						}
					}
					assert.Equal(t, 1, commits, "parallel check-ins must grant once")
					require.NoError(t, DB.First(ordinary, ordinary.Id).Error)
					assert.Equal(t, 51, ordinary.Quota)
					// Leaderboards rank the check-in reward and the billed usage.
					previousLogDB := LOG_DB
					LOG_DB = DB
					t.Cleanup(func() { LOG_DB = previousLogDB })
					checkinDay, err := operation_setting.CheckinSettingsSnapshot().Today()
					require.NoError(t, err)
					require.NoError(t, DB.Create(&Log{UserId: ordinary.Id, Type: LogTypeConsume, Quota: 30, CreatedAt: time.Now().Unix()}).Error)
					require.NoError(t, DB.Create(&Log{UserId: invited.Id, Type: LogTypeConsume, Quota: 90, CreatedAt: time.Now().Unix()}).Error)
					require.NoError(t, DB.Create(&Log{UserId: invited.Id, Type: LogTypeTopup, Quota: 500, CreatedAt: time.Now().Unix()}).Error)
					usage, err := GetUsageLeaderboard(0, 10)
					require.NoError(t, err)
					require.Len(t, usage.Top, 2, "top-ups are not consumption")
					assert.Equal(t, invited.Id, usage.Top[0].UserId)
					assert.Equal(t, int64(90), usage.Top[0].TotalQuota)
					assert.Equal(t, "invited", usage.Top[0].Username)
					assert.Equal(t, int64(2), usage.Total, "the total counts every consuming user")
					assert.Empty(t, usage.Bottom, "the lightest consumers are never listed")
					capped, err := GetUsageLeaderboard(0, 1)
					require.NoError(t, err)
					assert.Equal(t, int64(2), capped.Total, "limiting the rows must not change the total")
					require.Len(t, capped.Top, 1)
					assert.Empty(t, capped.Bottom, "the collapsed board only keeps its head")
					expandedUsage, expandedUsageTotal, err := GetUsageLeaderboardRows(0, 0)
					require.NoError(t, err)
					require.Len(t, expandedUsage, 2)
					assert.Equal(t, int64(2), expandedUsageTotal)
					assert.Equal(t, 1, expandedUsage[0].Rank)
					assert.Equal(t, 2, expandedUsage[1].Rank, "the expanded ranking is numbered from the top")
					assert.Equal(t, ordinary.Id, expandedUsage[1].UserId)
					checkins, err := GetTodayCheckinLeaderboard(checkinDay, 10)
					require.NoError(t, err)
					require.NotEmpty(t, checkins.Top)
					assert.Equal(t, int64(len(checkins.Top)), checkins.Total)
					for _, row := range checkins.Top {
						assert.GreaterOrEqual(t, row.QuotaAwarded, 1)
					}
					expandedCheckins, expandedCheckinsTotal, err := GetTodayCheckinLeaderboardRows(checkinDay, 0)
					require.NoError(t, err)
					require.Len(t, expandedCheckins, len(checkins.Top))
					assert.Equal(t, checkins.Total, expandedCheckinsTotal)
					for i, row := range expandedCheckins {
						assert.Equal(t, i+1, row.Rank)
					}
					empty, err := GetTodayCheckinLeaderboard("1990-01-01", 10)
					require.NoError(t, err)
					assert.Empty(t, empty.Top, "users who did not check in are omitted")
					assert.Zero(t, empty.Total)
				})
			}
		})
	}
}
