//! The account on a sync server: who the user is there and the keys that open its vaults.
//!
//! `account.json` beside the vaults keeps the server, the user and the account key wrapped by the
//! password-derived key. The private key and the device token are wrapped by the account key, so
//! the file opens only with the password (or the account key from the keychain).
pub(crate) mod api;
pub(crate) mod crypto;

use crate::{sync::SyncError, vault};
use api::{Api, NewAccountKeys, Register, Session};
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use crypto::{
    Key, SecretBox, decode32, login_keys, open_box, public_key, random, seal_box, subkey,
    unwrap_key, wrap_key,
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, path::Path};
use zeroize::Zeroizing;

const ACCOUNT_KEY: &[u8] = b"shellnest:account-key:1";
const RECOVERY_KEY: &[u8] = b"shellnest:recovery-key:1";
const PRIVATE_KEY: &[u8] = b"shellnest:private-key:1";
const TOKEN: &[u8] = b"shellnest:token:1";
pub(crate) const MIN_PASSWORD: usize = 12;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AccountFile {
    pub(crate) server: String,
    pub(crate) username: String,
    pub(crate) user_id: String,
    pub(crate) admin: bool,
    pub(crate) salt: String,
    pub(crate) account_key: SecretBox,
    pub(crate) public_key: String,
    pub(crate) private_key: SecretBox,
    pub(crate) device_id: String,
    pub(crate) token: SecretBox,
    /// Public keys of the people this device has shared a vault with, as first seen.
    #[serde(default)]
    pub(crate) pins: BTreeMap<String, String>,
}
pub(crate) struct OpenAccount {
    pub(crate) file: AccountFile,
    pub(crate) key: Key,
    pub(crate) secret: Key,
    pub(crate) token: Zeroizing<String>,
}
impl std::fmt::Debug for OpenAccount {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OpenAccount")
            .field("username", &self.file.username)
            .finish_non_exhaustive()
    }
}

pub(crate) fn path(vaults: &Path) -> std::path::PathBuf {
    vaults.with_file_name("account.json")
}
pub(crate) fn load(vaults: &Path) -> Result<Option<AccountFile>, SyncError> {
    match std::fs::read(path(vaults)) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|_| SyncError::AccountInvalid),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(SyncError::Io(e)),
    }
}
pub(crate) fn save(vaults: &Path, file: &AccountFile) -> Result<(), SyncError> {
    vault::save(&path(vaults), file).map_err(|_| SyncError::AccountNotSaved)
}
pub(crate) fn remove(vaults: &Path) {
    let account = path(vaults);
    let _ = std::fs::remove_file(account.with_extension("bak"));
    let _ = std::fs::remove_file(account);
}

/// The name the server lists this device under.
pub(crate) fn device_name() -> String {
    std::env::var("COMPUTERNAME")
        .ok()
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| {
            match std::env::consts::OS {
                "macos" => "Mac",
                "windows" => "Windows",
                other => other,
            }
            .into()
        })
        .chars()
        .filter(|c| !c.is_control())
        .take(80)
        .collect()
}

fn check_password(password: &str) -> Result<(), SyncError> {
    if password.chars().count() < MIN_PASSWORD {
        return Err(SyncError::PasswordTooShort);
    }
    Ok(())
}
/// Keys for a new password: a random salt, stored with the current KDF version in front, and the
/// login and wrapping keys derived from its bytes.
fn new_keys(password: &str) -> Result<(String, Key, Key), SyncError> {
    let salt = random::<16>()?;
    let (auth, wrap) = login_keys(password, salt.as_ref())?;
    let text = format!("{}:{}", crypto::KDF_VERSION, B64.encode(salt.as_ref()));
    Ok((text, auth, wrap))
}
/// The login and wrapping keys for a stored salt. A salt of a later KDF version comes from a
/// newer app, which raised the settings.
fn derive(password: &str, salt: &str) -> Result<(Key, Key), SyncError> {
    let (version, salt) = salt.split_once(':').ok_or(SyncError::RemoteInvalid)?;
    if version != crypto::KDF_VERSION {
        return Err(SyncError::UpdateRequired);
    }
    let salt = B64.decode(salt).map_err(|_| SyncError::RemoteInvalid)?;
    Ok(login_keys(password, &salt)?)
}

impl OpenAccount {
    fn from_session(server: &str, session: Session, key: Key) -> Result<Self, SyncError> {
        let secret = unwrap_key(&key, &session.account.keys.private_key, PRIVATE_KEY)?;
        if B64.encode(public_key(&secret)) != session.account.public_key {
            return Err(SyncError::RemoteInvalid);
        }
        let file = AccountFile {
            server: api::server_url(server)?
                .to_string()
                .trim_end_matches('/')
                .into(),
            username: session.account.username,
            user_id: session.account.id,
            admin: session.account.admin,
            salt: session.account.salt,
            account_key: SecretBox {
                nonce: String::new(),
                ciphertext: String::new(),
            },
            public_key: session.account.public_key,
            private_key: session.account.keys.private_key,
            device_id: session.device_id,
            token: seal_box(&key, session.token.as_bytes(), TOKEN)?,
            pins: BTreeMap::new(),
        };
        Ok(Self {
            file,
            key,
            secret,
            token: session.token,
        })
    }
    /// Opens the account file with the password: the same derivation as the login.
    pub(crate) fn unlock(file: AccountFile, password: &str) -> Result<Self, SyncError> {
        let (_, wrap) = derive(password, &file.salt)?;
        let key = unwrap_key(&wrap, &file.account_key, ACCOUNT_KEY)
            .map_err(|_| SyncError::WrongPassword)?;
        Self::unlock_with_key(file, key)
    }
    /// The password changed on another device while this one was away: the server's salt and
    /// wrapping open the account with the new password. Out of reach of the server, the password
    /// is just wrong.
    pub(crate) fn unlock_changed(mut file: AccountFile, password: &str) -> Result<Self, SyncError> {
        let api = Api::new(&file.server, None)?;
        let salt = api
            .prelogin(&file.username)
            .map_err(|_| SyncError::WrongPassword)?;
        if salt == file.salt {
            return Err(SyncError::WrongPassword);
        }
        let (auth, wrap) = derive(password, &salt)?;
        let reply = api
            .login_keys(&file.username, &B64.encode(*auth))
            .map_err(|e| match e {
                SyncError::TooManyAttempts => e,
                _ => SyncError::WrongPassword,
            })?;
        if reply.id != file.user_id {
            return Err(SyncError::RemoteInvalid);
        }
        let key = unwrap_key(&wrap, &reply.keys.password, ACCOUNT_KEY)
            .map_err(|_| SyncError::WrongPassword)?;
        file.salt = reply.salt;
        file.account_key = reply.keys.password;
        Self::unlock_with_key(file, key)
    }
    /// Takes the server's password wrapping after a change on another device. The account key is
    /// the same, so only the password that opens this file changes. Returns whether it did.
    pub(crate) fn adopt(&mut self, reply: api::AccountReply) -> Result<bool, SyncError> {
        if reply.id != self.file.user_id {
            return Err(SyncError::RemoteInvalid);
        }
        // Every password change picks a new salt.
        if reply.salt == self.file.salt {
            return Ok(false);
        }
        self.file.salt = reply.salt;
        self.file.account_key = reply.keys.password;
        Ok(true)
    }
    pub(crate) fn unlock_with_key(file: AccountFile, key: Key) -> Result<Self, SyncError> {
        let secret = unwrap_key(&key, &file.private_key, PRIVATE_KEY)
            .map_err(|_| SyncError::WrongPassword)?;
        let token = open_box(&key, &file.token, TOKEN).map_err(|_| SyncError::WrongPassword)?;
        let token = Zeroizing::new(
            String::from_utf8(token.to_vec()).map_err(|_| SyncError::AccountInvalid)?,
        );
        Ok(Self {
            file,
            key,
            secret,
            token,
        })
    }
    pub(crate) fn api(&self) -> Result<Api, SyncError> {
        Api::new(&self.file.server, Some(self.token.clone()))
    }
    pub(crate) fn public(&self) -> Result<[u8; 32], SyncError> {
        Ok(decode32(&self.file.public_key)?)
    }

    pub(crate) fn login(server: &str, username: &str, password: &str) -> Result<Self, SyncError> {
        let api = Api::new(server, None)?;
        let (auth, wrap) = derive(password, &api.prelogin(username)?)?;
        let session = api.login(username, &B64.encode(*auth), &device_name())?;
        let key = unwrap_key(&wrap, &session.account.keys.password, ACCOUNT_KEY)?;
        let mut account = Self::from_session(server, session, key)?;
        account.file.account_key = wrap_key(&wrap, &account.key, ACCOUNT_KEY)?;
        Ok(account)
    }
    /// Creates the account with a one-time invite. Returns the recovery key, shown once.
    pub(crate) fn register(
        server: &str,
        invite: &str,
        username: &str,
        password: &str,
    ) -> Result<(Self, String), SyncError> {
        check_password(password)?;
        let api = Api::new(server, None)?;
        let (salt, auth, wrap) = new_keys(password)?;
        let key = random::<32>()?;
        let recovery = random::<32>()?;
        let secret = random::<32>()?;
        let body = Register {
            invite: invite.trim(),
            username: username.trim(),
            salt,
            auth_key: B64.encode(*auth),
            recovery_auth: B64.encode(*subkey(&recovery, b"shellnest:recovery-auth")),
            public_key: B64.encode(public_key(&secret)),
            keys: NewAccountKeys {
                password: wrap_key(&wrap, &key, ACCOUNT_KEY)?,
                recovery: wrap_key(
                    &subkey(&recovery, b"shellnest:recovery-wrap"),
                    &key,
                    RECOVERY_KEY,
                )?,
                private_key: wrap_key(&key, &secret, PRIVATE_KEY)?,
            },
            device: &device_name(),
        };
        let session = api.register(&body)?;
        let mut account = Self::from_session(server, session, key)?;
        account.file.account_key = wrap_key(&wrap, &account.key, ACCOUNT_KEY)?;
        Ok((account, crypto::recovery_text(&recovery)))
    }
    /// A forgotten password: the recovery key opens the account key, and a new password wraps it.
    /// Every other device of the account is signed out.
    pub(crate) fn recover(
        server: &str,
        username: &str,
        recovery: &str,
        password: &str,
    ) -> Result<Self, SyncError> {
        check_password(password)?;
        let recovery = crypto::parse_recovery(recovery).map_err(|_| SyncError::RecoveryInvalid)?;
        let recovery_auth = B64.encode(*subkey(&recovery, b"shellnest:recovery-auth"));
        let api = Api::new(server, None)?;
        let wrapped = api.recover_start(username.trim(), &recovery_auth)?;
        let key = unwrap_key(
            &subkey(&recovery, b"shellnest:recovery-wrap"),
            &wrapped,
            RECOVERY_KEY,
        )
        .map_err(|_| SyncError::RecoveryInvalid)?;
        let (salt, auth, wrap) = new_keys(password)?;
        let wrapped = wrap_key(&wrap, &key, ACCOUNT_KEY)?;
        let session = api.recover_finish(&serde_json::json!({
            "username": username.trim(),
            "recoveryAuth": recovery_auth,
            "salt": salt,
            "authKey": B64.encode(*auth),
            "password": wrapped,
            "device": device_name(),
        }))?;
        let mut account = Self::from_session(server, session, key)?;
        account.file.account_key = wrapped;
        Ok(account)
    }
    pub(crate) fn change_password(
        &mut self,
        current: &str,
        password: &str,
    ) -> Result<(), SyncError> {
        check_password(password)?;
        let (current_auth, current_wrap) = derive(current, &self.file.salt)?;
        unwrap_key(&current_wrap, &self.file.account_key, ACCOUNT_KEY)
            .map_err(|_| SyncError::WrongPassword)?;
        let (salt, auth, wrap) = new_keys(password)?;
        let wrapped = wrap_key(&wrap, &self.key, ACCOUNT_KEY)?;
        let reply = self.api()?.change_password(&serde_json::json!({
            "currentAuthKey": B64.encode(*current_auth),
            "salt": salt,
            "authKey": B64.encode(*auth),
            "password": wrapped,
        }))?;
        self.file.salt = reply.salt;
        self.file.account_key = wrapped;
        Ok(())
    }
    /// Remembers a member's public key the first time it is used, and refuses a different one later.
    pub(crate) fn pin(&mut self, user_id: &str, public: &str) -> Result<bool, SyncError> {
        match self.file.pins.get(user_id) {
            Some(pinned) if pinned != public => Err(SyncError::PublicKeyChanged),
            Some(_) => Ok(false),
            None => {
                self.file.pins.insert(user_id.into(), public.into());
                Ok(true)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn the_account_file_opens_with_the_password_or_the_key_only() {
        let key = random::<32>().unwrap();
        let secret = random::<32>().unwrap();
        let salt = [3; 16];
        let (_, wrap) = login_keys("test-only account password", &salt).unwrap();
        let file = AccountFile {
            server: "https://sync.example.com".into(),
            username: "mario".into(),
            user_id: "u".into(),
            admin: false,
            salt: format!("{}:{}", crypto::KDF_VERSION, B64.encode(salt)),
            account_key: wrap_key(&wrap, &key, ACCOUNT_KEY).unwrap(),
            public_key: B64.encode(public_key(&secret)),
            private_key: wrap_key(&key, &secret, PRIVATE_KEY).unwrap(),
            device_id: "d".into(),
            token: seal_box(&key, b"device-token", TOKEN).unwrap(),
            pins: BTreeMap::new(),
        };
        let text = serde_json::to_string(&file).unwrap();
        assert!(!text.contains("device-token"));
        let opened = OpenAccount::unlock(file.clone(), "test-only account password").unwrap();
        assert_eq!(opened.token.as_str(), "device-token");
        assert_eq!(*opened.secret, *secret);
        assert!(matches!(
            OpenAccount::unlock(file.clone(), "wrong password!"),
            Err(SyncError::WrongPassword)
        ));
        assert!(OpenAccount::unlock_with_key(file.clone(), key).is_ok());
        assert!(OpenAccount::unlock_with_key(file, Zeroizing::new([1; 32])).is_err());
    }
    #[test]
    fn pinned_keys_refuse_a_swap() {
        let mut account = OpenAccount {
            file: serde_json::from_value(serde_json::json!({
                "server": "https://s", "username": "a", "userId": "u", "admin": false, "salt": "",
                "accountKey": {"nonce": "", "ciphertext": ""}, "publicKey": "",
                "privateKey": {"nonce": "", "ciphertext": ""}, "deviceId": "",
                "token": {"nonce": "", "ciphertext": ""}
            }))
            .unwrap(),
            key: Zeroizing::new([0; 32]),
            secret: Zeroizing::new([0; 32]),
            token: Zeroizing::new(String::new()),
        };
        assert!(account.pin("anna", "key-1").unwrap());
        assert!(!account.pin("anna", "key-1").unwrap());
        assert!(matches!(
            account.pin("anna", "key-2"),
            Err(SyncError::PublicKeyChanged)
        ));
    }
    #[test]
    fn device_names_have_no_control_characters() {
        let name = device_name();
        assert!(!name.is_empty() && name.chars().count() <= 80);
        assert!(!name.chars().any(char::is_control));
    }
}
