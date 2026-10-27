# Shellnest

<!-- impeccable:product-schema 1 -->

## Platform

web

Interfaccia React in un'app desktop Tauri per Windows e macOS. La piattaforma qui descrive il linguaggio dell'interfaccia web, non una distribuzione del client SSH come servizio browser. L'anteprima browser è dimostrativa.

## Users

Utenti individuali che amministrano server via SSH, incluso l'autore del progetto. Il caso d'uso di riferimento documentato è la gestione quotidiana di circa trenta server; non è un limite del prodotto. Non è un servizio di collaborazione multiutente.

## Product Purpose

Progetto open source proposto come alternativa a un altro client SSH per utenti individuali, con sincronizzazione self-hosted opzionale. La distribuzione pubblica è un obiettivo confermato; i limiti documentati restano validi e non costituiscono una release stabile verificata.

Riunire organizzazione degli host, credenziali riutilizzabili e terminali SSH in un client quotidiano per Windows e macOS. Il successo richiede percorsi rapidi per trovare un server, connettersi e passare fra sessioni, con parità funzionale fra i due sistemi e uso completo da tastiera.

## Operating Context

- Uso desktop con più sessioni SSH in schede e terminale locale del dispositivo.
- Organizzazione degli host in cartelle, ricerca, connessione rapida e accessi recenti agli host salvati.
- Chiavi SSH conservate nel portachiavi del vault; identità riutilizzabili con utente e chiave oppure password, assegnabili a più host.
- Utente e password privati appartengono all’host; un’identità condivisa viene collegata soltanto con una selezione esplicita. L’editor salva dopo una breve pausa solo gli host validi, senza persistere bozze incomplete.
- Più vault indipendenti, ciascuno con password e configurazione di sincronizzazione proprie.
- Uso locale senza servizio di sincronizzazione. La sync opzionale fra dispositivi richiede il servizio personale incluso e una configurazione per vault.

## Capabilities and Constraints

- Il vault locale è cifrato con Argon2id e XChaCha20-Poly1305. Nomi e identificativi dei vault nel catalogo locale non sono cifrati.
- Le connessioni richiedono verifica esplicita dell'impronta del server prima dell'autenticazione e vengono bloccate se l'impronta cambia.
- Blocco e cambio vault chiudono tutte le sessioni, comprese quelle locali, con conferma quando sono aperte.
- Gli elenchi non contengono password o chiavi private. Nell’editor host l’occhiello recupera la singola password privata dal vault sbloccato solo su richiesta e senza segnare modifiche. Nasconderla o chiudere l’editor rimuove il valore recuperato dallo stato del campo. I segreti appena digitati transitano nella memoria della UI fino alla chiusura dell’editor.
- La sync trasferisce il vault cifrato intero, usa revisioni e scritture condizionali e interrompe l'operazione in caso di modifiche concorrenti, conservando la copia locale. Non esiste ancora un'interfaccia per unire i conflitti.
- Il servizio sync è personale: un token autorizza tutti i vault del deployment; non offre permessi o condivisione multiutente.
- Non esiste recupero della password principale. Backup e protezione dalla perdita di dati sono vincoli da preservare.
- L'anteprima browser usa dati sintetici modificabili in memoria: non effettua SSH, cifratura o sincronizzazione di rete e non modifica i vault desktop. Usare soltanto credenziali fittizie.
- SFTP, jump host, agent forwarding, keyboard-interactive/2FA e biometria non sono funzionalità presenti. Le proposte in ROADMAP.md non vanno presentate come già disponibili.
- La parità Windows/macOS è un requisito confermato, non una verifica già conclusa. Test su macOS, firma/notarizzazione, revisione di sicurezza e prove con server SSH reali restano da completare secondo README.md.

## Brand Commitments

Shellnest è il nome dell’app (il logo è provvisorio). Il progetto è open source con licenza MIT e l'interfaccia attuale è in italiano. Il client è implementato indipendentemente da un altro client SSH: i riferimenti di prodotto non implicano integrazione con il suo cloud o importazione del suo vault.

## Evidence on Hand

- README.md: funzionamento, avvio, modello delle credenziali, protezioni, migrazione, sync e limiti dichiarati.
- ROADMAP.md: flusso quotidiano, funzioni pianificate e verifiche ancora aperte.
- src/: interfaccia React condivisa fra desktop e anteprima, componenti UI e backend dimostrativo in src/lib/preview.ts.
- src-tauri/: backend desktop Rust/Tauri; sync/: servizio personale Node.js e relativi test.
- I test e le verifiche riportati nella documentazione sono evidenza storica; questa inizializzazione non li ha rieseguiti. I dati dimostrativi non sono testimonianze o risultati di clienti.

## Product Principles

1. Consentire agli utenti individuali di svolgere il lavoro quotidiano senza richiedere un servizio remoto per l'uso locale.
2. Offrire le stesse capacità su Windows e macOS e rendere ogni flusso utilizzabile da tastiera.
3. Tenere private le credenziali degli host e permettere il riuso esplicito di identità e chiavi.
4. Rendere esplicite le decisioni di fiducia SSH e preservare i dati quando un'operazione non può essere completata in sicurezza.
5. Distinguere funzionalità operative, dimostrazioni e obiettivi ancora da realizzare.

## Accessibility & Inclusion

L'uso completo da tastiera è un requisito confermato: navigazione, ricerca, gestione degli host e delle credenziali, dialoghi, schede e terminali devono essere raggiungibili e utilizzabili senza mouse, con focus visibile e ritorno del focus coerente. Nessuno standard formale di conformità è stato concordato in questa inizializzazione.
