use super::KeychainError;
use zeroize::Zeroizing;
pub(crate) fn save(_: &str, _: &[u8; 32]) -> Result<(), KeychainError> {
    Err(KeychainError::Unsupported)
}
pub(crate) fn load(_: &str) -> Result<Zeroizing<[u8; 32]>, KeychainError> {
    Err(KeychainError::Unsupported)
}
pub(crate) fn forget(_: &str) {}
