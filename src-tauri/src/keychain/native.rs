use super::KeychainError;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use zeroize::Zeroizing;
fn entry(id: &str) -> Result<keyring::Entry, KeychainError> {
    static STORE: std::sync::LazyLock<Result<(), keyring::Error>> =
        std::sync::LazyLock::new(|| {
            #[cfg(target_os = "macos")]
            let store = apple_native_keyring_store::keychain::Store::new()?;
            #[cfg(target_os = "windows")]
            let store = windows_native_keyring_store::Store::new()?;
            #[cfg(target_os = "linux")]
            let store = dbus_secret_service_keyring_store::Store::new()?;
            keyring::set_default_store(store);
            Ok(())
        });
    if STORE.is_err() {
        return Err(keyring::Error::NoDefaultStore.into());
    }
    Ok(keyring::Entry::new("Shellnest", id)?)
}
pub(crate) fn save(id: &str, key: &[u8; 32]) -> Result<(), KeychainError> {
    // The encoded key is as good as the key: it is wiped like it.
    let encoded = Zeroizing::new(B64.encode(key));
    Ok(entry(id)?.set_password(&encoded)?)
}
pub(crate) fn load(id: &str) -> Result<Zeroizing<[u8; 32]>, KeychainError> {
    let text = Zeroizing::new(entry(id)?.get_password()?);
    let bytes = Zeroizing::new(B64.decode(text.as_bytes())?);
    let mut key = Zeroizing::new([0; 32]);
    if bytes.len() != 32 {
        return Err(KeychainError::InvalidKey);
    }
    key.copy_from_slice(&bytes);
    Ok(key)
}
pub(crate) fn forget(id: &str) {
    if let Ok(e) = entry(id) {
        let _ = e.delete_credential();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires an unlocked native credential store"]
    fn native_store_round_trip() {
        let id = format!("shellnest-keychain-test-{:032x}", rand::random::<u128>());
        let key = Zeroizing::new([42; 32]);
        save(&id, &key).unwrap();
        let loaded = load(&id);
        forget(&id);
        assert_eq!(*loaded.unwrap(), *key);
        assert!(load(&id).is_err());
    }
}
