# Roadmap di prodotto

Obiettivo: un client SSH open source per utenti individuali su Windows e macOS, con credenziali riutilizzabili e sync self-hosted opzionale. Il caso d'uso iniziale è la gestione quotidiana di circa trenta server. Parità funzionale fra sistemi e uso completo da tastiera sono requisiti.

## 1. Flusso quotidiano — implementato, verifica visiva da completare

- [x] Nuova scheda `+` e `Ctrl/Cmd K`: ricerca host, schede aperte e connessioni recenti salvate.
- [x] Connessione rapida con identità esistente, senza obbligo di salvare un host; verifica della chiave server prima di autenticarsi.
- [x] Terminale locale interattivo con PTY nativo, input, resize e chiusura del processo.
- [x] Lista e cards compatte, preferenza ricordata per vault; menu azioni degli host.
- [x] OS rilevato dopo una connessione riuscita e salvato nel vault; nessuna scansione preventiva dei server.
- [x] Più vault indipendenti, con password, dati e configurazione sync propri; conservazione del vault locale esistente.
- [x] Schede: stato, riconnessione, duplicazione, riordino e chiusura delle altre sessioni.
- [x] Prove automatiche di separazione dei vault, migrazione, parsing connessioni, SSH e PTY.
- [x] Revisione UX: destinazione e identità visibili nelle schede, selezione separata dalla connessione, cartelle nella navigazione e filtro per finestre ridotte, protezione delle modifiche nei form e guida alle scorciatoie.
- [x] Verifica dei flussi nell'anteprima browser su Windows: creazione host/identità, ritorno ai moduli, selezione multipla, filtri e ricerca. La demo usa dati sintetici, senza SSH o cifratura.
- [ ] Verifica visiva nel WebView desktop Windows e macOS; prova con lettore di schermo e verifica completa dei flussi da tastiera sui due sistemi.

Confini: cambiare/bloccare vault chiude le sessioni, dopo conferma quando ce ne sono. I nomi dei vault sono metadati locali visibili prima dello sblocco; le credenziali restano cifrate. I recenti iniziali sono gli host salvati con ultimo accesso riuscito: nessuna registrazione dei comandi o dell'output del terminale. Il servizio sync è personale, senza condivisione multiutente.

Verifica del 25 ottobre 2026 su Windows: build TypeScript/Vite riuscita, 21 test Rust e 16 test JavaScript superati; inclusi SSH su localhost, PowerShell con PTY nativo, isolamento dei vault e sync fra due dispositivi simulati. L'anteprima browser è stata verificata visivamente; la verifica nel WebView desktop e su macOS resta aperta.

## 2. Importazione e protezione del lavoro

- Importazione `~/.ssh/config` con anteprima, associazione delle identità e gestione duplicati.
- Cartelle gerarchiche, breadcrumb e assegnazione ereditata con eccezioni esplicite.
- Preferiti, etichette ambiente e riconoscimento chiaro di Produzione nelle sessioni.
- Backup/esportazione e ripristino cifrati guidati.
- Risoluzione dei conflitti sync nell'app e stato degli errori per vault.
- Blocco automatico configurabile con comportamento delle sessioni dichiarato.
- Verifica del sistema remoto correggibile manualmente e cronologia delle connessioni rapide, se necessaria.

## 3. Funzioni operative successive

- SFTP, split terminali, port forwarding e workspace salvati.
- Snippet; broadcast soltanto con destinatari chiaramente verificabili.
- Firma/notarizzazione, build e test su macOS, revisione di sicurezza prima di una release stabile.

Non pianificati per la prima release: seriale, collaborazione in tempo reale, account multiutente e compatibilità con servizi cloud di terzi.

## Idee future

- Impostazioni dell'app per scegliere il font: uno per l'interfaccia (oggi Geist) e uno per il terminale (oggi Cascadia Code in `TerminalPane.tsx`), con anteprima dal vivo.
