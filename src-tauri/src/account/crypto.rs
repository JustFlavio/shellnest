//! The account's keys. A password-derived key wraps a random account key; the account key wraps
//! everything else of the account, and each vault has its own random key, sealed to every member.
use argon2::Argon2;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use chacha20poly1305::{
    KeyInit, XChaCha20Poly1305, XNonce,
    aead::{Aead, Payload},
};
use curve25519_dalek::montgomery::MontgomeryPoint;
use hkdf::Hkdf;
use rand::{TryRng, rngs::SysRng};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

pub(crate) type Key = Zeroizing<[u8; 32]>;

/// Why a key could not be derived, unwrapped or unsealed.
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(tag = "code", content = "params")]
pub(crate) enum CryptoError {
    #[error("Wrong password or key")]
    Unwrap,
    #[error("Invalid encrypted data")]
    Malformed,
    #[error("Key derivation failed")]
    Kdf,
    #[error("Random number generator unavailable")]
    Random,
}

/// XChaCha20-Poly1305 output, as the server stores it (`Box` in sync/src/shapes.ts).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct SecretBox {
    pub(crate) nonce: String,
    pub(crate) ciphertext: String,
}
/// A 32-byte key sealed to an X25519 public key (`Sealed` in sync/src/shapes.ts).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Sealed {
    pub(crate) ephemeral: String,
    pub(crate) nonce: String,
    pub(crate) ciphertext: String,
}

pub(crate) fn random<const N: usize>() -> Result<Zeroizing<[u8; N]>, CryptoError> {
    let mut bytes = Zeroizing::new([0; N]);
    SysRng
        .try_fill_bytes(bytes.as_mut())
        .map_err(|_| CryptoError::Random)?;
    Ok(bytes)
}

/// Argon2id of the password, split in two: the half sent to the server to log in, and the half
/// that wraps the account key and never leaves the device.
pub(crate) fn login_keys(password: &str, salt: &[u8]) -> Result<(Key, Key), CryptoError> {
    let mut both = Zeroizing::new([0; 64]);
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, both.as_mut())
        .map_err(|_| CryptoError::Kdf)?;
    let (mut auth, mut wrap) = (Zeroizing::new([0; 32]), Zeroizing::new([0; 32]));
    auth.copy_from_slice(&both[..32]);
    wrap.copy_from_slice(&both[32..]);
    Ok((auth, wrap))
}

/// A sub-key of a high-entropy key, one per purpose (`info`).
pub(crate) fn subkey(key: &[u8; 32], info: &[u8]) -> Key {
    let mut out = Zeroizing::new([0; 32]);
    Hkdf::<Sha256>::new(None, key)
        .expand(info, out.as_mut())
        .expect("32 bytes is a valid HKDF-SHA256 length");
    out
}

pub(crate) fn seal_box(key: &[u8; 32], plain: &[u8], aad: &[u8]) -> Result<SecretBox, CryptoError> {
    let nonce = random::<24>()?;
    let ciphertext = XChaCha20Poly1305::new(key.into())
        .encrypt(&XNonce::from(*nonce), Payload { msg: plain, aad })
        .map_err(|_| CryptoError::Malformed)?;
    Ok(SecretBox {
        nonce: B64.encode(nonce.as_ref()),
        ciphertext: B64.encode(ciphertext),
    })
}
pub(crate) fn open_box(
    key: &[u8; 32],
    sealed: &SecretBox,
    aad: &[u8],
) -> Result<Zeroizing<Vec<u8>>, CryptoError> {
    let nonce = B64
        .decode(&sealed.nonce)
        .map_err(|_| CryptoError::Malformed)?;
    let nonce = <&XNonce>::try_from(nonce.as_slice()).map_err(|_| CryptoError::Malformed)?;
    let bytes = B64
        .decode(&sealed.ciphertext)
        .map_err(|_| CryptoError::Malformed)?;
    XChaCha20Poly1305::new(key.into())
        .decrypt(nonce, Payload { msg: &bytes, aad })
        .map(Zeroizing::new)
        .map_err(|_| CryptoError::Unwrap)
}
pub(crate) fn wrap_key(
    key: &[u8; 32],
    wrapped: &[u8; 32],
    aad: &[u8],
) -> Result<SecretBox, CryptoError> {
    seal_box(key, wrapped, aad)
}
pub(crate) fn unwrap_key(
    key: &[u8; 32],
    sealed: &SecretBox,
    aad: &[u8],
) -> Result<Key, CryptoError> {
    let plain = open_box(key, sealed, aad)?;
    let mut out = Zeroizing::new([0; 32]);
    if plain.len() != 32 {
        return Err(CryptoError::Malformed);
    }
    out.copy_from_slice(&plain);
    Ok(out)
}

pub(crate) fn public_key(secret: &[u8; 32]) -> [u8; 32] {
    MontgomeryPoint::mul_base_clamped(*secret).to_bytes()
}
fn shared_key(
    secret: &[u8; 32],
    public: &[u8; 32],
    ephemeral: &[u8; 32],
    recipient: &[u8; 32],
) -> Result<Key, CryptoError> {
    let shared = Zeroizing::new(MontgomeryPoint(*public).mul_clamped(*secret).to_bytes());
    // A low-order public key gives an all-zero secret that anyone could compute.
    if shared.iter().all(|b| *b == 0) {
        return Err(CryptoError::Malformed);
    }
    let mut salt = [0; 64];
    salt[..32].copy_from_slice(ephemeral);
    salt[32..].copy_from_slice(recipient);
    let mut out = Zeroizing::new([0; 32]);
    Hkdf::<Sha256>::new(Some(&salt), shared.as_ref())
        .expand(b"shellnest:seal:1", out.as_mut())
        .expect("32 bytes is a valid HKDF-SHA256 length");
    Ok(out)
}
/// Seals `key` so that only the holder of the private half of `recipient` can open it.
pub(crate) fn seal_to(
    recipient: &[u8; 32],
    key: &[u8; 32],
    aad: &[u8],
) -> Result<Sealed, CryptoError> {
    let ephemeral_secret = random::<32>()?;
    let ephemeral = public_key(&ephemeral_secret);
    let shared = shared_key(&ephemeral_secret, recipient, &ephemeral, recipient)?;
    let sealed = seal_box(&shared, key, aad)?;
    Ok(Sealed {
        ephemeral: B64.encode(ephemeral),
        nonce: sealed.nonce,
        ciphertext: sealed.ciphertext,
    })
}
pub(crate) fn open_sealed(
    secret: &[u8; 32],
    sealed: &Sealed,
    aad: &[u8],
) -> Result<Key, CryptoError> {
    let ephemeral = decode32(&sealed.ephemeral)?;
    let shared = shared_key(secret, &ephemeral, &ephemeral, &public_key(secret))?;
    unwrap_key(
        &shared,
        &SecretBox {
            nonce: sealed.nonce.clone(),
            ciphertext: sealed.ciphertext.clone(),
        },
        aad,
    )
}
pub(crate) fn decode32(text: &str) -> Result<[u8; 32], CryptoError> {
    B64.decode(text)
        .ok()
        .and_then(|b| <[u8; 32]>::try_from(b.as_slice()).ok())
        .ok_or(CryptoError::Malformed)
}
/// A short code that identifies a public key, for comparing out of band: 4 groups of 4 hex digits.
pub(crate) fn safety_code(public: &[u8; 32]) -> String {
    let digest = Sha256::digest(public);
    digest[..8]
        .chunks(2)
        .map(|pair| format!("{:02X}{:02X}", pair[0], pair[1]))
        .collect::<Vec<_>>()
        .join(" ")
}

/// The recovery key as the user writes it down: 32 bytes in 8 groups of base32 (no padding).
pub(crate) fn recovery_text(key: &[u8; 32]) -> String {
    const ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut bits = 0u32;
    let mut count = 0;
    let mut out = String::new();
    for byte in key {
        bits = (bits << 8) | u32::from(*byte);
        count += 8;
        while count >= 5 {
            count -= 5;
            out.push(ALPHABET[((bits >> count) & 31) as usize] as char);
        }
    }
    if count > 0 {
        out.push(ALPHABET[((bits << (5 - count)) & 31) as usize] as char);
    }
    out.as_bytes()
        .chunks(7)
        .map(|c| String::from_utf8_lossy(c).into_owned())
        .collect::<Vec<_>>()
        .join("-")
}
pub(crate) fn parse_recovery(text: &str) -> Result<Key, CryptoError> {
    const ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut bits = 0u32;
    let mut count = 0;
    let mut out = Zeroizing::new(Vec::with_capacity(32));
    for c in text.chars().filter(|c| !c.is_whitespace() && *c != '-') {
        let c = c.to_ascii_uppercase() as u8;
        let value = ALPHABET
            .iter()
            .position(|a| *a == c)
            .ok_or(CryptoError::Malformed)?;
        bits = (bits << 5) | value as u32;
        count += 5;
        if count >= 8 {
            count -= 8;
            out.push((bits >> count) as u8);
            bits &= (1 << count) - 1;
        }
    }
    let mut key = Zeroizing::new([0; 32]);
    if out.len() != 32 || bits != 0 {
        return Err(CryptoError::Malformed);
    }
    key.copy_from_slice(&out);
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn login_keys_split_the_password_into_two_unrelated_halves() {
        let (auth, wrap) = login_keys("correct horse battery staple", &[1; 16]).unwrap();
        assert_ne!(*auth, *wrap);
        let (again, _) = login_keys("correct horse battery staple", &[1; 16]).unwrap();
        assert_eq!(*auth, *again);
        let (other, _) = login_keys("correct horse battery staple", &[2; 16]).unwrap();
        assert_ne!(*auth, *other);
    }
    #[test]
    fn boxes_need_the_key_and_the_context() {
        let key = random::<32>().unwrap();
        let sealed = seal_box(&key, b"secret", b"context").unwrap();
        assert_eq!(&**open_box(&key, &sealed, b"context").unwrap(), b"secret");
        assert!(open_box(&key, &sealed, b"other context").is_err());
        assert!(open_box(&[9; 32], &sealed, b"context").is_err());
        assert_ne!(sealed, seal_box(&key, b"secret", b"context").unwrap());
    }
    #[test]
    fn sealed_keys_open_only_with_the_recipient_secret() {
        let secret = random::<32>().unwrap();
        let other = random::<32>().unwrap();
        let vault_key = random::<32>().unwrap();
        let sealed = seal_to(&public_key(&secret), &vault_key, b"vault").unwrap();
        assert_eq!(
            *open_sealed(&secret, &sealed, b"vault").unwrap(),
            *vault_key
        );
        assert!(open_sealed(&other, &sealed, b"vault").is_err());
        assert!(open_sealed(&secret, &sealed, b"other vault").is_err());
        // The identity point would give a shared secret of zeros.
        assert!(seal_to(&[0; 32], &vault_key, b"vault").is_err());
    }
    #[test]
    fn recovery_keys_round_trip_and_reject_typos() {
        let key = random::<32>().unwrap();
        let text = recovery_text(&key);
        assert_eq!(text.split('-').count(), 8);
        assert_eq!(*parse_recovery(&text).unwrap(), *key);
        assert_eq!(
            *parse_recovery(&text.to_lowercase().replace('-', " ")).unwrap(),
            *key
        );
        assert!(parse_recovery(&text[1..]).is_err());
        assert!(parse_recovery(&text.replace(text.chars().next().unwrap(), "0")).is_err());
    }
    #[test]
    fn safety_codes_are_short_and_stable() {
        let code = safety_code(&[7; 32]);
        assert_eq!(code, safety_code(&[7; 32]));
        assert_eq!(code.len(), 19);
        assert_ne!(code, safety_code(&[8; 32]));
    }
}
