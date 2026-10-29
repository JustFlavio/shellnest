use super::{VaultError, save};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct VaultEntry {
    pub(crate) id: String,
    pub(crate) name: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct VaultCatalog {
    pub(crate) selected: String,
    pub(crate) vaults: Vec<VaultEntry>,
}
impl Default for VaultCatalog {
    fn default() -> Self {
        Self {
            selected: "personal".into(),
            vaults: vec![VaultEntry {
                id: "personal".into(),
                name: "Personal".into(),
            }],
        }
    }
}
impl VaultCatalog {
    pub(crate) fn load(legacy: &Path) -> Result<Self, VaultError> {
        let catalog = match fs::read(legacy.with_extension("catalog.json")) {
            Ok(bytes) => {
                serde_json::from_slice::<Self>(&bytes).map_err(|_| VaultError::CatalogInvalid)?
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Self::default(),
            Err(e) => return Err(e.into()),
        };
        let mut ids = std::collections::HashSet::new();
        for entry in &catalog.vaults {
            if !valid_vault_id(&entry.id) || entry.name.trim().is_empty() || !ids.insert(&entry.id)
            {
                return Err(VaultError::CatalogInvalid);
            }
        }
        if !catalog.vaults.iter().any(|v| v.id == "personal")
            || !catalog.vaults.iter().any(|v| v.id == catalog.selected)
        {
            return Err(VaultError::CatalogIncomplete);
        }
        Ok(catalog)
    }
    pub(crate) fn persist(&self, legacy: &Path) -> Result<(), VaultError> {
        save(&legacy.with_extension("catalog.json"), self)
    }
    pub(crate) fn path_for(legacy: &Path, id: &str) -> Result<std::path::PathBuf, VaultError> {
        if !valid_vault_id(id) {
            return Err(VaultError::IdInvalid);
        }
        if id == "personal" {
            return Ok(legacy.to_path_buf());
        }
        let stem = legacy
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or(VaultError::PathInvalid)?;
        Ok(legacy
            .with_file_name(format!("{stem}-vaults"))
            .join(format!("{id}.json")))
    }
    pub(crate) fn selected_path(&self, legacy: &Path) -> Result<std::path::PathBuf, VaultError> {
        Self::path_for(legacy, &self.selected)
    }
    pub(crate) fn validate_name(
        &self,
        name: &str,
        except: Option<&str>,
    ) -> Result<String, VaultError> {
        let name = name.trim();
        if name.is_empty() || name.chars().count() > 80 || name.chars().any(char::is_control) {
            return Err(VaultError::NameInvalid);
        }
        if self
            .vaults
            .iter()
            .any(|v| Some(v.id.as_str()) != except && v.name.to_lowercase() == name.to_lowercase())
        {
            return Err(VaultError::NameTaken);
        }
        Ok(name.into())
    }
}
pub(crate) fn valid_vault_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && !matches!(
            id,
            "con"
                | "prn"
                | "aux"
                | "nul"
                | "com1"
                | "com2"
                | "com3"
                | "com4"
                | "com5"
                | "com6"
                | "com7"
                | "com8"
                | "com9"
                | "lpt1"
                | "lpt2"
                | "lpt3"
                | "lpt4"
                | "lpt5"
                | "lpt6"
                | "lpt7"
                | "lpt8"
                | "lpt9"
        )
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn vault_paths_and_catalog_names_are_bounded() {
        let legacy = Path::new("root/vault.json");
        assert_eq!(VaultCatalog::path_for(legacy, "personal").unwrap(), legacy);
        assert!(VaultCatalog::path_for(legacy, "../other").is_err());
        assert!(VaultCatalog::path_for(legacy, "con").is_err());
        assert_eq!(
            VaultCatalog::path_for(legacy, "work-1").unwrap(),
            Path::new("root/vault-vaults/work-1.json")
        );
        let catalog = VaultCatalog::default();
        assert!(catalog.validate_name(" PERSONAL ", None).is_err());
        assert!(catalog.validate_name("", None).is_err());
        assert_eq!(catalog.validate_name("  Lavoro  ", None).unwrap(), "Lavoro");
    }
}
