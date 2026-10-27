use super::KeychainError;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use zeroize::Zeroizing;
fn entry(id: &str) -> Result<keyring::Entry, KeychainError> {
    Ok(keyring::Entry::new("Shellnest", id)?)
}
pub(crate) fn save(id: &str, key: &[u8; 32]) -> Result<(), KeychainError> {
    Ok(entry(id)?.set_password(&B64.encode(key))?)
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
