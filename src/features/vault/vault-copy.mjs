// Texts that depend on the state of the vault; kept apart from the components that show them.

export function syncTitle({ syncConfigured, lastSync }) {
  if (!syncConfigured) return "Configura il tuo servizio di sincronizzazione";
  return lastSync
    ? `Ultima sincronizzazione riuscita: ${lastSync}`
    : "Sincronizza ora";
}

// null when sync is not set up: only the icon shows.
export function syncLabel({ syncState, syncConfigured, dirty, lastSync }) {
  if (syncState === "syncing") return "Sincronizzazione…";
  if (syncState === "error") return "Sync non riuscita · Riprova";
  if (!syncConfigured) return null;
  if (dirty) return "Da sincronizzare";
  return lastSync ? `Sync ${lastSync}` : "Sync configurata";
}

// `interactive`: the desktop app or the in-memory preview; a plain browser only gets the gate.
export function lockTitle({ exists, restore, interactive }) {
  if (exists) return "Sblocca vault";
  if (restore) return "Collega dispositivo";
  return interactive ? "Crea vault locale" : "Esplora Shellnest";
}

export function lockLead({ exists, restore, interactive }) {
  if (!interactive)
    return "Client SSH open source per Windows e macOS, con sincronizzazione self-hosted opzionale.";
  if (exists) return "Inserisci la password principale.";
  if (restore)
    return "Apri il vault già presente nel tuo servizio di sincronizzazione.";
  return "Host, identità e chiavi SSH vengono salvati sul dispositivo, cifrati.";
}

export function unlockLabel({ busy, exists, restore }) {
  if (busy) return "Attendi…";
  if (exists) return "Sblocca";
  return restore ? "Collega dispositivo" : "Crea vault";
}

// Why the active vault cannot be deleted, or "" when it can.
export function deleteBlock(view) {
  if (view.vaultId === "personal")
    return "Il vault Personale non si può eliminare";
  const empty =
    !view.hosts.length &&
    !view.identities.length &&
    !view.keys.length &&
    !view.groups.length &&
    !view.workspaces.length;
  return empty
    ? ""
    : "Svuota prima il vault: host, identità, chiavi e cartelle";
}
