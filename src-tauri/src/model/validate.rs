use super::{
    workspaces::{check_layout, MAX_LAYOUT_LEAVES},
    Data, MAX_GROUP_DEPTH,
};
use std::collections::HashSet;

impl Data {
    pub(crate) fn validate(&self) -> Result<(), String> {
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
                    return Err("Identificativi mancanti o duplicati nel vault".into());
                }
            }
        }
        for i in &self.identities {
            if i.username.trim().is_empty() || i.name.trim().is_empty() {
                return Err("Identità senza nome o utente".into());
            }
            match i.auth.as_str() {
                "key" if self.keys.iter().any(|k| k.id == i.key_id) && i.password.is_empty() => {}
                "password" if i.key_id.is_empty() => {}
                _ => return Err("Identità con riferimento alla chiave non valido".into()),
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
                    .ok_or("Gruppo padre non trovato")?;
                if depth > MAX_GROUP_DEPTH {
                    return Err(format!(
                        "Le cartelle possono avere al massimo {MAX_GROUP_DEPTH} livelli"
                    ));
                }
            }
            let name = g.name.trim();
            if name.is_empty()
                || name.len() > 80
                || name != g.name
                || name.chars().any(|c| c == '/' || c.is_control())
            {
                return Err("Nome cartella non valido".into());
            }
            if g.port == Some(0)
                || (!g.identity_id.is_empty()
                    && !self.identities.iter().any(|i| i.id == g.identity_id))
            {
                return Err(format!("Impostazioni della cartella {} non valide", g.name));
            }
            if self.groups.iter().any(|o| {
                o.id != g.id
                    && o.parent_id == g.parent_id
                    && o.name.to_lowercase() == g.name.to_lowercase()
            }) {
                return Err(format!("Esiste già una cartella chiamata {}", g.name));
            }
        }
        for h in &self.hosts {
            if h.port == Some(0)
                || (!h.group_id.is_empty() && !self.groups.iter().any(|g| g.id == h.group_id))
            {
                return Err(format!("Porta o cartella non valida per l’host {}", h.name));
            }
            if let Some(credentials) = &h.credentials {
                if !h.identity_id.is_empty()
                    || credentials.username.trim().is_empty()
                    || credentials
                        .username
                        .chars()
                        .any(|c| c.is_control() || c.is_whitespace())
                    || credentials.password.is_empty()
                {
                    return Err(
                        "Credenziali dell’host non valide o in conflitto con un’identità".into(),
                    );
                }
            } else if h.identity_id.is_empty() {
                if self.inherited_identity(h).is_none() {
                    return Err(format!(
                        "L’host {} non ha un’identità e la sua cartella non ne fornisce una",
                        h.name
                    ));
                }
            } else if !self.identities.iter().any(|i| i.id == h.identity_id) {
                return Err(format!(
                    "L’host {} fa riferimento a un’identità mancante",
                    h.name
                ));
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
                return Err(format!("Workspace {} non valido", w.name));
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
        assert!(data
            .upsert_identity(identity("invalid", "missing", "root"))
            .is_err());
        let mut data = Data::default();
        assert!(data
            .assign_identity(&["missing".into()], "missing")
            .is_err());
        let future = serde_json::json!({"schema_version":6,"hosts":[],"keys":[],"identities":[],"sync_url":"","sync_token":""});
        assert!(serde_json::from_value::<Data>(future).is_err());
    }
}
