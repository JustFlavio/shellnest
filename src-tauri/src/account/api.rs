//! The blocking HTTP client of the sync server (sync/src/app.ts). Only encrypted data and the
//! login half of the password-derived key ever leave the device.
use super::crypto::{Sealed, SecretBox};
use crate::sync::SyncError;
use reqwest::{Method, StatusCode, Url, blocking::Client};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::time::Duration;
use zeroize::Zeroizing;

pub(crate) struct Api {
    base: Url,
    token: Option<Zeroizing<String>>,
    client: Client,
}

/// The server address the user typed: HTTPS, or HTTP on loopback only; no credentials, query or
/// fragment. A path is kept, for a server behind a reverse proxy under a prefix.
pub(crate) fn server_url(raw: &str) -> Result<Url, SyncError> {
    let url = Url::parse(raw.trim().trim_end_matches('/')).map_err(|_| SyncError::UrlInvalid)?;
    if url.scheme() != "https"
        && !(url.scheme() == "http"
            && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")))
    {
        return Err(SyncError::InsecureUrl);
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(SyncError::UrlParts);
    }
    Ok(url)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AccountKeys {
    pub(crate) password: SecretBox,
    pub(crate) private_key: SecretBox,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AccountReply {
    pub(crate) id: String,
    pub(crate) username: String,
    pub(crate) admin: bool,
    pub(crate) salt: String,
    pub(crate) public_key: String,
    pub(crate) keys: AccountKeys,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Session {
    #[serde(deserialize_with = "zeroizing")]
    pub(crate) token: Zeroizing<String>,
    pub(crate) device_id: String,
    pub(crate) account: AccountReply,
}
fn zeroizing<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Zeroizing<String>, D::Error> {
    String::deserialize(d).map(Zeroizing::new)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NewAccountKeys {
    pub(crate) password: SecretBox,
    pub(crate) recovery: SecretBox,
    pub(crate) private_key: SecretBox,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Register<'a> {
    pub(crate) invite: &'a str,
    pub(crate) username: &'a str,
    pub(crate) salt: String,
    pub(crate) auth_key: String,
    pub(crate) recovery_auth: String,
    pub(crate) public_key: String,
    pub(crate) keys: NewAccountKeys,
    pub(crate) device: &'a str,
}
#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Device {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) created_at: u64,
    pub(crate) last_seen_at: u64,
    pub(crate) current: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserReply {
    pub(crate) id: String,
    pub(crate) public_key: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VaultReply {
    pub(crate) id: String,
    pub(crate) role: Role,
    pub(crate) meta: SecretBox,
    pub(crate) key_epoch: u32,
    pub(crate) sealed_key: Sealed,
    pub(crate) revision: u64,
    pub(crate) members: u32,
    // Only in the reply for one vault.
    #[serde(default)]
    pub(crate) envelope: Option<SecretBox>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Stored {
    pub(crate) revision: u64,
    pub(crate) envelope: SecretBox,
}
#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MemberReply {
    pub(crate) user_id: String,
    pub(crate) username: String,
    pub(crate) public_key: String,
    pub(crate) role: Role,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Role {
    Owner,
    Editor,
    Viewer,
}
#[derive(Deserialize)]
struct Revision {
    revision: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Rotated {
    pub(crate) revision: u64,
    pub(crate) key_epoch: u32,
}

impl Api {
    pub(crate) fn new(server: &str, token: Option<Zeroizing<String>>) -> Result<Self, SyncError> {
        let mut base = server_url(server)?;
        let path = format!("{}/api/", base.path().trim_end_matches('/'));
        base.set_path(&path);
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        Ok(Self {
            base,
            token,
            client,
        })
    }
    fn call<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<&dyn erased::Body>,
    ) -> Result<T, SyncError> {
        let url = self.base.join(path).map_err(|_| SyncError::UrlInvalid)?;
        let mut request = self.client.request(method, url);
        if let Some(token) = &self.token {
            request = request.bearer_auth(token.as_str());
        }
        if let Some(body) = body {
            request = request
                .header("Content-Type", "application/json")
                .body(body.json()?);
        }
        let response = request.send()?;
        let status = response.status();
        if !status.is_success() {
            return Err(match status {
                StatusCode::UNAUTHORIZED => SyncError::Unauthorized,
                StatusCode::FORBIDDEN => SyncError::NotAllowed,
                StatusCode::NOT_FOUND => SyncError::NotFound,
                StatusCode::CONFLICT => SyncError::Conflict,
                StatusCode::TOO_MANY_REQUESTS => SyncError::TooManyAttempts,
                StatusCode::PAYLOAD_TOO_LARGE => SyncError::TooLarge,
                _ => SyncError::Status(status),
            });
        }
        response.json().map_err(|_| SyncError::RemoteInvalid)
    }
    fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, SyncError> {
        self.call(Method::GET, path, None)
    }
    fn send<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: &impl Serialize,
    ) -> Result<T, SyncError> {
        self.call(method, path, Some(&erased::Json(body)))
    }

    pub(crate) fn prelogin(&self, username: &str) -> Result<String, SyncError> {
        #[derive(Deserialize)]
        struct Salt {
            salt: String,
        }
        let reply: Salt = self.send(
            Method::POST,
            "prelogin",
            &serde_json::json!({ "username": username }),
        )?;
        Ok(reply.salt)
    }
    pub(crate) fn login(
        &self,
        username: &str,
        auth_key: &str,
        device: &str,
    ) -> Result<Session, SyncError> {
        self.send(
            Method::POST,
            "login",
            &serde_json::json!({ "username": username, "authKey": auth_key, "device": device }),
        )
        .map_err(|e| match e {
            SyncError::Unauthorized => SyncError::WrongLogin,
            e => e,
        })
    }
    pub(crate) fn register(&self, body: &Register) -> Result<Session, SyncError> {
        self.send(Method::POST, "register", body)
            .map_err(|e| match e {
                SyncError::Conflict => SyncError::UsernameTaken,
                SyncError::NotAllowed => SyncError::InviteInvalid,
                e => e,
            })
    }
    pub(crate) fn recover_start(
        &self,
        username: &str,
        recovery_auth: &str,
    ) -> Result<SecretBox, SyncError> {
        #[derive(Deserialize)]
        struct Start {
            recovery: SecretBox,
        }
        let reply: Start = self
            .send(
                Method::POST,
                "recover/start",
                &serde_json::json!({ "username": username, "recoveryAuth": recovery_auth }),
            )
            .map_err(|e| match e {
                SyncError::Unauthorized => SyncError::RecoveryInvalid,
                e => e,
            })?;
        Ok(reply.recovery)
    }
    pub(crate) fn recover_finish(&self, body: &serde_json::Value) -> Result<Session, SyncError> {
        self.send(Method::POST, "recover/finish", body)
            .map_err(|e| match e {
                SyncError::Unauthorized => SyncError::RecoveryInvalid,
                e => e,
            })
    }
    pub(crate) fn change_password(
        &self,
        body: &serde_json::Value,
    ) -> Result<AccountReply, SyncError> {
        self.send(Method::POST, "account/password", body)
            .map_err(|e| match e {
                SyncError::Unauthorized => SyncError::WrongLogin,
                e => e,
            })
    }
    pub(crate) fn logout(&self) -> Result<(), SyncError> {
        self.send::<serde_json::Value>(Method::POST, "logout", &serde_json::json!({}))
            .map(drop)
    }
    pub(crate) fn devices(&self) -> Result<Vec<Device>, SyncError> {
        self.get("devices")
    }
    pub(crate) fn revoke_device(&self, id: &str) -> Result<(), SyncError> {
        self.call::<serde_json::Value>(Method::DELETE, &format!("devices/{id}"), None)
            .map(drop)
    }
    pub(crate) fn invite(&self, admin: bool) -> Result<String, SyncError> {
        #[derive(Deserialize)]
        struct Code {
            code: String,
        }
        let reply: Code = self.send(
            Method::POST,
            "invites",
            &serde_json::json!({ "admin": admin }),
        )?;
        Ok(reply.code)
    }
    pub(crate) fn user(&self, username: &str) -> Result<UserReply, SyncError> {
        self.get(&format!("users/{username}")).map_err(|e| match e {
            SyncError::NotFound => SyncError::UserNotFound,
            e => e,
        })
    }
    pub(crate) fn vaults(&self) -> Result<Vec<VaultReply>, SyncError> {
        self.get("vaults")
    }
    pub(crate) fn vault(&self, id: &str) -> Result<VaultReply, SyncError> {
        self.get(&format!("vaults/{id}")).map_err(|e| match e {
            SyncError::NotFound => SyncError::AccessRevoked,
            e => e,
        })
    }
    pub(crate) fn create_vault(
        &self,
        id: &str,
        meta: &SecretBox,
        sealed_key: &Sealed,
        envelope: &SecretBox,
    ) -> Result<VaultReply, SyncError> {
        self.send(
            Method::POST,
            "vaults",
            &serde_json::json!({ "id": id, "meta": meta, "sealedKey": sealed_key, "envelope": envelope }),
        )
    }
    pub(crate) fn delete_vault(&self, id: &str) -> Result<(), SyncError> {
        self.call::<serde_json::Value>(Method::DELETE, &format!("vaults/{id}"), None)
            .map(drop)
    }
    pub(crate) fn put_data(
        &self,
        id: &str,
        revision: u64,
        key_epoch: u32,
        envelope: &SecretBox,
    ) -> Result<u64, SyncError> {
        let reply: Revision = self.send(
            Method::PUT,
            &format!("vaults/{id}/data"),
            &serde_json::json!({ "revision": revision, "keyEpoch": key_epoch, "envelope": envelope }),
        )?;
        Ok(reply.revision)
    }
    pub(crate) fn put_meta(
        &self,
        id: &str,
        key_epoch: u32,
        meta: &SecretBox,
    ) -> Result<(), SyncError> {
        self.send::<serde_json::Value>(
            Method::PUT,
            &format!("vaults/{id}/meta"),
            &serde_json::json!({ "keyEpoch": key_epoch, "meta": meta }),
        )
        .map(drop)
    }
    pub(crate) fn private(&self, id: &str) -> Result<Option<Stored>, SyncError> {
        self.get(&format!("vaults/{id}/private")).map_err(revoked)
    }
    pub(crate) fn put_private(
        &self,
        id: &str,
        revision: u64,
        envelope: &SecretBox,
    ) -> Result<u64, SyncError> {
        let reply: Revision = self.send(
            Method::PUT,
            &format!("vaults/{id}/private"),
            &serde_json::json!({ "revision": revision, "envelope": envelope }),
        )?;
        Ok(reply.revision)
    }
    pub(crate) fn members(&self, id: &str) -> Result<Vec<MemberReply>, SyncError> {
        self.get(&format!("vaults/{id}/members"))
    }
    pub(crate) fn put_member(
        &self,
        id: &str,
        user_id: &str,
        role: Role,
        key: Option<(u32, &Sealed)>,
    ) -> Result<(), SyncError> {
        let mut body = serde_json::json!({ "role": role });
        if let Some((epoch, sealed)) = key {
            body["keyEpoch"] = epoch.into();
            body["sealedKey"] =
                serde_json::to_value(sealed).map_err(|_| SyncError::RemoteInvalid)?;
        }
        self.send::<serde_json::Value>(
            Method::PUT,
            &format!("vaults/{id}/members/{user_id}"),
            &body,
        )
        .map(drop)
        .map_err(|e| match e {
            SyncError::Conflict => SyncError::LastOwner,
            e => e,
        })
    }
    pub(crate) fn leave(&self, id: &str) -> Result<(), SyncError> {
        self.call::<serde_json::Value>(Method::DELETE, &format!("vaults/{id}/members/me"), None)
            .map(drop)
            .map_err(|e| match e {
                SyncError::Conflict => SyncError::LastOwner,
                e => e,
            })
    }
    pub(crate) fn rotate(&self, id: &str, body: &serde_json::Value) -> Result<Rotated, SyncError> {
        self.send(Method::POST, &format!("vaults/{id}/rotate"), body)
    }
}

// A vault that answers 404 to a member was deleted or the member removed.
fn revoked(e: SyncError) -> SyncError {
    match e {
        SyncError::NotFound => SyncError::AccessRevoked,
        e => e,
    }
}

// `call` takes any serializable body without being generic over it.
mod erased {
    use crate::sync::SyncError;
    pub(super) trait Body {
        fn json(&self) -> Result<Vec<u8>, SyncError>;
    }
    pub(super) struct Json<'a, T>(pub(super) &'a T);
    impl<T: serde::Serialize> Body for Json<'_, T> {
        fn json(&self) -> Result<Vec<u8>, SyncError> {
            serde_json::to_vec(self.0).map_err(|_| SyncError::RemoteInvalid)
        }
    }
}
