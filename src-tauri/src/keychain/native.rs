use base64::{engine::general_purpose::STANDARD as B64, Engine};
use zeroize::Zeroizing;
fn entry(id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("Shellnest", id).map_err(|e| e.to_string())
}
pub(crate) fn save(id: &str, key: &[u8; 32]) -> Result<(), String> {
    entry(id)?
        .set_password(&B64.encode(key))
        .map_err(|e| e.to_string())
}
pub(crate) fn load(id: &str) -> Result<Zeroizing<[u8; 32]>, String> {
    let text = Zeroizing::new(entry(id)?.get_password().map_err(|e| e.to_string())?);
    let bytes = Zeroizing::new(B64.decode(text.as_bytes()).map_err(|e| e.to_string())?);
    let mut key = Zeroizing::new([0; 32]);
    if bytes.len() != 32 {
        return Err("Chiave salvata non valida".into());
    }
    key.copy_from_slice(&bytes);
    Ok(key)
}
pub(crate) fn forget(id: &str) {
    if let Ok(e) = entry(id) {
        let _ = e.delete_credential();
    }
}
