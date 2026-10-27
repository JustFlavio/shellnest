use zeroize::Zeroizing;
const NO: &str = "Portachiavi non disponibile su questo sistema";
pub(crate) fn save(_: &str, _: &[u8; 32]) -> Result<(), String> {
    Err(NO.into())
}
pub(crate) fn load(_: &str) -> Result<Zeroizing<[u8; 32]>, String> {
    Err(NO.into())
}
pub(crate) fn forget(_: &str) {}
