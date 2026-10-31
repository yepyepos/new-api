package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrRegistrationInvitationInvalid = common.NewMessage("Registration invitation is invalid, expired, disabled, or fully used.")
var ErrOrdinaryRegistrationFull = common.NewMessage("Ordinary registration is full. Use a registration invitation or contact the administrator.")

// RegistrationInvite is an admission credential, not an affiliate referral code.
// Only a hash is retained; the usable code is returned once at creation.
type RegistrationInvite struct {
	ID        int    `json:"id" gorm:"primaryKey"`
	Name      string `json:"name" gorm:"type:varchar(80);not null"`
	CodeHash  string `json:"-" gorm:"type:varchar(64);not null;uniqueIndex"`
	MaxUses   int    `json:"max_uses" gorm:"not null"`
	Used      int    `json:"used" gorm:"not null"`
	Exempt    bool   `json:"exempt" gorm:"not null"`
	Disabled  bool   `json:"disabled" gorm:"not null"`
	ExpiresAt int64  `json:"expires_at" gorm:"bigint;not null"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;not null"`
}

type RegistrationAdmission struct {
	UserID   int  `json:"user_id" gorm:"primaryKey;autoIncrement:false"`
	InviteID int  `json:"invite_id" gorm:"not null"`
	Exempt   bool `json:"exempt" gorm:"not null"`
}

// A batch counts successful ordinary registrations since an explicit reset.
type RegistrationBatch struct {
	ID      int  `json:"-" gorm:"primaryKey;autoIncrement:false"`
	Enabled bool `json:"enabled" gorm:"not null"`
	Limit   int  `json:"limit" gorm:"column:registration_limit;not null"`
	Used    int  `json:"used" gorm:"not null"`
}

func InitializeRegistrationBatch() error {
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&RegistrationBatch{ID: 1}).Error
}

func HashRegistrationInvite(code string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(strings.TrimSpace(code))))
}

func CreateRegistrationInvite(invite *RegistrationInvite) (string, error) {
	invite.Name = strings.TrimSpace(invite.Name)
	if invite.Name == "" || utf8.RuneCountInString(invite.Name) > 80 || invite.MaxUses < 1 || invite.MaxUses > 1000000000 || invite.ExpiresAt > 253402300799 ||
		(invite.ExpiresAt != 0 && invite.ExpiresAt <= time.Now().Unix()) {
		return "", common.NewMessage("Invalid parameters")
	}
	code, err := common.GenerateRandomCharsKey(32)
	if err != nil {
		return "", err
	}
	invite.ID, invite.Used, invite.Disabled = 0, 0, false
	invite.CodeHash, invite.CreatedAt = HashRegistrationInvite(code), time.Now().Unix()
	if err := DB.Create(invite).Error; err != nil {
		return "", err
	}
	return code, nil
}

func GetRegistrationInvite(hash string) (*RegistrationInvite, error) {
	var invite RegistrationInvite
	if hash == "" {
		return nil, ErrRegistrationInvitationInvalid
	}
	err := DB.Where("code_hash = ? AND disabled = ? AND used < max_uses AND (expires_at = 0 OR expires_at > ?)", hash, false, time.Now().Unix()).First(&invite).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrRegistrationInvitationInvalid
		}
		return nil, err
	}
	return &invite, nil
}

// Existing accounts never acquire an exemption by supplying another invite.
func DiscordAdmissionExempt(discordID, inviteHash string) (bool, error) {
	var user User
	err := DB.Select("id").Where("discord_id = ?", discordID).First(&user).Error
	if err == nil {
		var admission RegistrationAdmission
		err = DB.Where("user_id = ?", user.Id).First(&admission).Error
		if err == gorm.ErrRecordNotFound {
			return false, nil
		}
		return admission.Exempt, err
	}
	if err != gorm.ErrRecordNotFound {
		return false, err
	}
	if inviteHash == "" {
		return false, nil
	}
	invite, err := GetRegistrationInvite(inviteHash)
	if err != nil {
		return false, err
	}
	return invite.Exempt, nil
}

// RegisterWithTx consumes capacity and creates the account in the same commit.
// Admin-created accounts intentionally use InsertWithTx instead.
func (user *User) RegisterWithTx(tx *gorm.DB, inviterID int, inviteHash string) error {
	var invite RegistrationInvite
	if inviteHash != "" {
		if err := tx.Where("code_hash = ?", inviteHash).First(&invite).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRegistrationInvitationInvalid
			}
			return err
		}
		result := tx.Model(&RegistrationInvite{}).Where("id = ? AND disabled = ? AND used < max_uses AND (expires_at = 0 OR expires_at > ?)", invite.ID, false, time.Now().Unix()).Update("used", gorm.Expr("used + 1"))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrRegistrationInvitationInvalid
		}
	} else {
		if !common.RegisterEnabled {
			return common.NewMessage("New user registration has been disabled by administrator")
		}
		// The conditional update serializes the last slot on all three databases.
		// Initialization happens at startup, never on a public signup request.
		var batch RegistrationBatch
		if err := lockForUpdate(tx).First(&batch, 1).Error; err != nil {
			return err
		}
		if batch.Enabled {
			result := tx.Model(&RegistrationBatch{}).Where("id = 1 AND used < registration_limit").Update("used", gorm.Expr("used + 1"))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrOrdinaryRegistrationFull
			}
		}
	}
	if err := user.InsertWithTx(tx, inviterID); err != nil {
		return err
	}
	if inviteHash != "" {
		return tx.Create(&RegistrationAdmission{UserID: user.Id, InviteID: invite.ID, Exempt: invite.Exempt}).Error
	}
	return nil
}

func (user *User) Register(inviterID int) error {
	if err := DB.Transaction(func(tx *gorm.DB) error { return user.RegisterWithTx(tx, inviterID, "") }); err != nil {
		return err
	}
	user.finishInsert(inviterID)
	return nil
}
