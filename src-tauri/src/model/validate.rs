use super::{
    Data, MAX_GROUP_DEPTH, ModelError,
    workspaces::{MAX_LAYOUT_LEAVES, check_layout},
};
use std::collections::HashSet;

impl Data {
    pub(crate) fn validate(&self) -> Result<(), ModelError> {
        for ids in [
            self.hosts.iter().map(|h| &h.id).collect::<Vec<_>>(),
            self.identities.iter().map(|i| &i.id).collect(),
            self.keys.iter().map(|k| &k.id).collect(),
            self.groups.iter().map(|g| &g.id).collect(),
            self.workspaces.iter().map(|w| &w.id).collect(),
        ] {
            let mut seen = HashSet::new();
            for id in ids {
                if id.is_empty() || id.len() > 80 || !seen.insert(id) {
                    return Err(ModelError::InvalidIds);
                }
            }
        }
        for i in &self.identities {
            if i.name.trim().is_empty() {
                return Err(ModelError::IdentityIncomplete);
            }
            if i.username.trim().is_empty() {
                return Err(ModelError::UsernameMissing);
            }
            match i.auth.as_str() {
                "key" if self.keys.iter().any(|k| k.id == i.key_id) && i.password.is_empty() => {}
                "password" if i.key_id.is_empty() => {}
                _ => return Err(ModelError::IdentityKeyInvalid),
            }
        }
        for g in &self.groups {
            let mut depth = 1;
            let mut cursor = g;
            while !cursor.parent_id.is_empty() {
                depth += 1;
                cursor = self
                    .groups
                    .iter()
                    .find(|p| p.id == cursor.parent_id)
                    .ok_or(ModelError::GroupParentMissing)?;
                if depth > MAX_GROUP_DEPTH {
                    return Err(ModelError::GroupTooDeep(MAX_GROUP_DEPTH));
                }
            }
            let name = g.name.trim();
            if name.is_empty()
                || name.len() > 80
                || name != g.name
                || name.chars().any(|c| c == '/' || c.is_control())
            {
                return Err(ModelError::GroupNameInvalid);
            }
            if g.port == Some(0) {
                return Err(ModelError::PortInvalid);
            }
            if !g.identity_id.is_empty() && !self.identities.iter().any(|i| i.id == g.identity_id) {
                return Err(ModelError::GroupSettingsInvalid(g.name.clone()));
            }
            if self.groups.iter().any(|o| {
                o.id != g.id
                    && o.parent_id == g.parent_id
                    && o.name.to_lowercase() == g.name.to_lowercase()
            }) {
                return Err(ModelError::GroupNameTaken(g.name.clone()));
            }
        }
        for h in &self.hosts {
            if h.tags.len() > 32
                || h.tags.iter().any(|tag| {
                    tag.trim().is_empty()
                        || tag.chars().count() > 64
                        || tag.chars().any(char::is_control)
                })
            {
                return Err(ModelError::HostTagsInvalid);
            }
            if h.port == Some(0) {
                return Err(ModelError::PortInvalid);
            }
            if !h.group_id.is_empty() && !self.groups.iter().any(|g| g.id == h.group_id) {
                return Err(ModelError::HostPlacementInvalid(h.name.clone()));
            }
            if let Some(credentials) = &h.credentials {
                if !h.identity_id.is_empty()
                    || credentials.username.trim().is_empty()
                    || credentials
                        .username
                        .chars()
                        .any(|c| c.is_control() || c.is_whitespace())
                    || if credentials.key_id.is_empty() {
                        credentials.password.is_empty()
                    } else {
                        !credentials.password.is_empty()
                            || !self.keys.iter().any(|k| k.id == credentials.key_id)
                    }
                {
                    return Err(ModelError::HostCredentialsInvalid);
                }
            } else if h.identity_id.is_empty() {
                if self.inherited_identity(h).is_none() {
                    return Err(ModelError::HostWithoutIdentity(h.name.clone()));
                }
            } else if !self.identities.iter().any(|i| i.id == h.identity_id) {
                return Err(ModelError::HostIdentityMissing(h.name.clone()));
            }
        }
        let host_ids: HashSet<&str> = self.hosts.iter().map(|h| h.id.as_str()).collect();
        for w in &self.workspaces {
            let mut leaves = 0;
            if w.name.trim().is_empty()
                || w.name.len() > 80
                || !check_layout(&w.layout, &host_ids, 0, &mut leaves)
                || leaves > MAX_LAYOUT_LEAVES
            {
                return Err(ModelError::WorkspaceInvalid(w.name.clone()));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
    #[test]
    fn duplicate_import_and_dangling_references_are_rejected() {
        let mut data = Data::default();
        let key = key("first");
        let mut duplicate = key.clone();
        duplicate.id = "second".into();
        data.upsert_key(key).unwrap();
        assert!(data.upsert_key(duplicate).is_err());
        assert_eq!(data.keys.len(), 1);
        assert!(
            data.upsert_identity(identity("invalid", "missing", "root"))
                .is_err()
        );
        let mut data = Data::default();
        assert!(
            data.assign_identity(&["missing".into()], "missing")
                .is_err()
        );
        let future = serde_json::json!({"schema_version":7,"hosts":[],"keys":[],"identities":[],"sync_url":"","sync_token":""});
        assert!(serde_json::from_value::<Data>(future).is_err());
    }
    #[test]
    fn each_refusal_points_at_one_field() {
        let mut data = Data::default();
        data.upsert_key(key("k")).unwrap();
        let mut nameless = identity("i", "k", "root");
        nameless.name = " ".into();
        let error = data.upsert_identity(nameless).unwrap_err();
        assert!(matches!(error, ModelError::IdentityIncomplete));
        assert_eq!(error.field(), Some("name"));
        let mut userless = identity("i", "k", "root");
        userless.username = String::new();
        let error = data.upsert_identity(userless).unwrap_err();
        assert!(matches!(error, ModelError::UsernameMissing));
        assert_eq!(error.field(), Some("username"));
        data.upsert_identity(identity("i", "k", "root")).unwrap();
        let mut portless = host("h", "i");
        portless.port = Some(0);
        let error = data.upsert_host(portless).unwrap_err();
        assert!(matches!(error, ModelError::PortInvalid));
        assert_eq!(error.field(), Some("port"));
        let mut misplaced = host("h", "i");
        misplaced.group_id = "missing".into();
        let error = data.upsert_host(misplaced).unwrap_err();
        assert!(matches!(error, ModelError::HostPlacementInvalid(_)));
        assert_eq!(error.field(), Some("group"));
        let mut zero = group("g", "Web", "");
        zero.port = Some(0);
        let error = data.upsert_group(zero).unwrap_err();
        assert!(matches!(error, ModelError::PortInvalid));
    }
    #[test]
    fn a_password_identity_needs_a_password_only_when_none_is_saved() {
        let mut data = Data::default();
        let mut by_password = identity("p", "", "root");
        by_password.auth = "password".into();
        let error = data.upsert_identity(by_password.clone()).unwrap_err();
        assert!(matches!(error, ModelError::PasswordRequired));
        assert_eq!(error.field(), Some("password"));
        assert!(data.identities.is_empty());
        by_password.password = "secret".into();
        data.upsert_identity(by_password.clone()).unwrap();
        // An empty password on edit keeps the saved one.
        by_password.password = String::new();
        by_password.name = "Ops".into();
        data.upsert_identity(by_password).unwrap();
        assert_eq!(data.identities[0].password, "secret");
        // A key identity never asks for a password.
        data.upsert_key(key("k")).unwrap();
        data.upsert_identity(identity("k-id", "k", "deploy"))
            .unwrap();
    }
}
