use super::KeychainError;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use zeroize::Zeroizing;
fn entry(id: &str) -> Result<keyring::Entry, KeychainError> {
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
