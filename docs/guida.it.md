# Shellnest — guida (italiano)

Guida dettagliata in italiano. Per una panoramica in inglese vedi il [README](../README.md).

Client SSH open source per utenti individuali su Windows, macOS e Linux, con sincronizzazione self-hosted opzionale. Nessun account necessario per l'uso locale. Versione alpha.

## Avvio

Servono Node.js 22.18+, Rust e i prerequisiti Tauri 2 (su Windows: Visual Studio C++ Build Tools e WebView2; su macOS: Xcode Command Line Tools; su Ubuntu: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libdbus-1-dev libxdo-dev pkg-config patchelf`). SSH usa russh con backend ring, senza richiedere OpenSSL o Perl. Riferimento: https://v2.tauri.app/start/prerequisites/.

```sh
npm ci
npm run desktop
```

`npm run dev` apre solo l'interfaccia in un browser: non salva credenziali e non effettua connessioni SSH. `npm run desktop:build` genera il pacchetto desktop. Firma e notarizzazione non sono configurate: al primo avvio macOS e Windows mostrano un avviso.

## Funzioni presenti

L'interfaccia usa componenti shadcn/ui (stile Base Nova) basati su Base UI, con Tailwind CSS 4. I componenti necessari sono nel repository in `src/components/ui`; i colori condivisi sono in `src/theme.css`, il layout desktop in `src/style.css`. Select e menu sono personalizzati; i pannelli usano il focus e la gestione tastiera di Base UI. I test dei controlli usano il runner Node esistente, senza un framework di test aggiuntivo.

La barra delle sessioni occupa la parte superiore; la sidebar raccoglie navigazione e cartelle e passa automaticamente alle sole icone nelle finestre strette. La vista a schede separa cartelle e host senza cartella; la lista mostra le cartelle apribili con doppio clic o Invio. La ricerca mostra direttamente gli host corrispondenti. La porta SSH compare solo se diversa da 22. Un clic seleziona, Ctrl/Cmd clic aggiunge o rimuove host dalla selezione; doppio clic o Invio connette. Spazio seleziona da tastiera. La matita compare su hover o focus e apre l’editor; il clic destro espone le altre azioni. La barra flottante permette connessioni in tab separate, assegnazione di identità ed eliminazione con conferma. I nuovi server richiedono la verifica individuale dell’impronta anche nell’apertura multipla; annullarla interrompe le aperture rimanenti.

Gli editor usano sezioni di form e azioni fisse nel footer. Gli host validi si salvano automaticamente; gli altri editor usano il salvataggio esplicito. Creare identità e chiavi dall'host conserva la bozza. Le conferme brevi usano dialoghi centrati; le modifiche incomplete richiedono conferma prima di essere scartate.

Il menu applicazione nell’header raccoglie navigazione, nuove connessioni, visualizzazione, impostazioni, scorciatoie, blocco del vault e comandi della finestra. **Scorciatoie da tastiera** elenca i comandi disponibili: `Ctrl/Cmd T` o `Ctrl/Cmd K` per una nuova connessione, `Ctrl/Cmd J` per passare a una scheda aperta, `Ctrl/Cmd N` per un nuovo host, `Ctrl/Cmd Maiusc F` per la ricerca nella raccolta e `Ctrl/Cmd Maiusc L` per bloccare il vault, con conferma se ci sono sessioni aperte. Chiudere la sessione attiva seleziona una sessione adiacente quando disponibile.

- Vault locale cifrato con Argon2id e XChaCha20-Poly1305, nonce casuali a ogni salvataggio.
- Più vault indipendenti, ciascuno con password, host, identità e configurazione sync propri; creazione, selezione e rinomina.
- Elenco e cards compatte degli host, cartelle, ricerca, modifica, menu azioni e selezione multipla.
- Nuova scheda `+`, `Ctrl/Cmd T` e `Ctrl/Cmd K`: ricerca di host e schede in gruppi con titolo («Schede», «Host», «Connessione rapida»), accessi recenti agli host salvati, terminale locale e connessione rapida con identità esistente. Un host con una scheda aperta compare solo sotto «Schede». `Ctrl/Cmd J` apre lo stesso riquadro in modalità «Vai alla scheda»: elenca soltanto le schede aperte, le più recenti per prime.
- Terminale locale del dispositivo con PTY nativo (ConPTY su Windows), input e ridimensionamento.
- Riconoscimento del sistema remoto dopo l'accesso, con icona e ultimo collegamento memorizzati nel vault.
- Portachiavi: importazione da file o testo, chiave privata e passphrase conservate una sola volta, riconoscimento dei duplicati per impronta pubblica.
- Identità riutilizzabili: nome, utente SSH e riferimento a una chiave oppure password. Una chiave può essere usata da più identità; ogni identità può essere assegnata a molti host.
- Assegnazione di un'identità a più host in una sola operazione; conteggi e filtri degli host associati; eliminazione bloccata per chiavi e identità ancora in uso.
- Terminali interattivi in schede riordinabili, duplicazione, riconnessione e chiusura delle altre sessioni; verifica esplicita dell'impronta SHA-256 prima dell'autenticazione e blocco se cambia. Durante la connessione il riquadro mostra i passaggi (connessione, impronta, autenticazione, sessione); la verifica dell’impronta e, se la chiave viene rifiutata, la richiesta della password avvengono dentro il riquadro, senza finestre. Ogni passaggio mostra il suo esito (con un avviso, non un segno di spunta, se c’è stato un ripiego, ad esempio chiave rifiutata e poi password); dopo 3 password errate il tentativo termina con «Ricomincia» e «Chiudi». «Mostra log» apre il registro della connessione (indirizzo, server, algoritmi, impronta, tentativi), una riga per evento con il tempo trascorso, un’icona per tipo ed errori e rifiuti in evidenza, e dal cui angolo in alto a destra l’icona «Copia log» copia il testo; non contiene mai password o chiavi e resta solo in memoria.

La connessione rapida (indirizzo digitato nella ricerca, anche con Ctrl/Cmd+Invio) avvia lo stesso riquadro e vi pone le domande: «Utente» (precompilato da `utente@host`, oppure un’identità salvata che porta con sé le credenziali) e, senza identità, «Metodo di accesso» (password o chiave del portachiavi). «Continua» si collega senza salvare nulla; «Continua e salva» crea anche l’host nel vault (nome predefinito: l’indirizzo; con una chiave viene creata, o riusata, un’identità). L’impronta di una connessione rapida non viene mai salvata.

- Sincronizzazione del vault cifrato tramite il servizio incluso; controllo ogni 30 secondi mentre il vault è aperto e pulsante manuale.
- Collegamento di un dispositivo nuovo scaricando il vault esistente; protezione dalle sovrascritture concorrenti tramite ETag e scritture condizionali.
- Blocco manuale e cambio vault chiudono tutte le sessioni, comprese quelle locali, con conferma quando sono aperte.

I file sono nella directory dati applicazione Tauri: il vault personale esistente resta `vault.json`, gli altri sono in `vault-vaults/<id>.json`. Il catalogo `vault.catalog.json` contiene nomi e identificativi locali non cifrati; i contenuti dei vault sono cifrati, con una copia precedente `.bak`. Il blocco di istanza impedisce a due processi della nuova versione di scrivere contemporaneamente. Gli elenchi degli host non contengono password o chiavi SSH. Il campo password mostra pallini per una password esistente: soltanto il clic sull’occhiello recupera quella del singolo host dal vault sbloccato. La visualizzazione non modifica l’host; nasconderla rimuove il valore recuperato dallo stato del campo. La UI gestisce in memoria i segreti appena digitati fino alla chiusura dell’editor; localStorage conserva solo preferenze di visualizzazione. Il backend usa zeroizzazione per chiave e dati decifrati, senza promettere l'eliminazione di ogni copia creata da librerie o runtime.

Il riconoscimento OS usa un comando di sola lettura su un canale SSH separato; non inserisce comandi nel terminale interattivo. Non vengono registrati comandi o output. I recenti comprendono attualmente gli host salvati, non le destinazioni rapide.

## Chiavi, identità e migrazione

Importa la chiave in **Chiavi SSH**, poi crea un'**Identità** con utente (es. `root`) e riferimento alla chiave. Seleziona quell'identità quando aggiungi un host, oppure seleziona più host e usa **Assegna identità**. Un'altra identità con utente `ubuntu` può utilizzare la stessa chiave. Modifiche a identità e chiavi si applicano alle connessioni successive; le sessioni già aperte conservano il proprio accesso.

Utente e password inseriti nell’editor appartengono soltanto a quell’host. Il campo utente propone anche le identità salvate: selezionarne una collega esplicitamente un accesso condiviso. Le credenziali private non creano identità. Lasciare vuota la password durante la modifica conserva quella già salvata per lo stesso host. Le identità contengono `keyId` oppure una password; la sync conserva dati e riferimenti nel vault cifrato.

L’editor salva automaticamente dopo 650 ms di pausa soltanto gli host completi: etichetta, indirizzo, porta e credenziali valide. Una bozza incompleta resta nella UI e richiede conferma prima di essere scartata con un clic esterno o con Escape. Chiudere un host valido completa il salvataggio pendente. La sincronizzazione automatica può proseguire mentre l’editor mostra un host valido; il suo stato è distinto dal salvataggio locale.

Al primo sblocco, i vault precedenti vengono migrati allo schema dati 4. Le identità esistenti e i loro collegamenti restano invariati; la migrazione non tenta di dedurne la proprietà dal nome. Per la prima versione, chiavi e credenziali uguali sono accorpate, mentre host, cartelle e impronte dei server sono conservati. Prima di riscrivere il vault locale viene salvata una copia cifrata `.pre-v4.bak`, non sovrascritta dai salvataggi ordinari. Una chiave legacy non valida viene conservata e indicata come da verificare, così può essere reimportata senza perdere il riferimento. La migrazione conserva password principale e configurazione sync. **Chiudi la vecchia app e aggiorna tutti i dispositivi prima di riprendere la sync**: i client precedenti non gestiscono il nuovo schema.

Nel browser l'anteprima usa gli stessi componenti dell'app desktop con dati dimostrativi modificabili in memoria: host, identità, chiavi, assegnazioni e vault. Tutto torna ai dati iniziali ricaricando la pagina. Usa solo credenziali e chiavi fittizie: password, chiavi private e token non vengono conservati dal backend dimostrativo, che non esegue cifratura, verifiche crittografiche, SSH o sincronizzazione di rete. Il recupero con l’occhiello mostra solo una password dimostrativa, non quella digitata. Il vault locale dell'app desktop non viene modificato.

## Sincronizzazione personale

Il servizio incluso nella stessa codebase è un server Node.js senza framework; conserva più vault cifrati separati. **È un servizio personale: un solo token autorizza tutti i vault del deployment, senza permessi multiutente.** Genera un token casuale (ad esempio 32 byte con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) e conservalo nel gestore dei segreti del deployment. Non inserirlo in Git o nella riga di comando.

In PowerShell, per una prova locale:

```powershell
$env:SYNC_TOKEN = '<token casuale di almeno 32 caratteri>'
npm run sync
```

Il servizio ascolta su `127.0.0.1:8787`, salva solo i contenitori cifrati in `sync/data`, e richiede il token per GET/PUT `/vaults/<id>`. `/vault` e `/vaults/personal` mantengono compatibilità con il vault personale originale. Per ospitarlo su una VPS, mettilo dietro un reverse proxy HTTPS; resta in ascolto locale per impostazione predefinita. `SYNC_HOST`, `SYNC_PORT` e `SYNC_DATA_DIR` permettono di personalizzare il deployment. È incluso un Dockerfile: `docker build -t shellnest-sync sync`. Persisti `/data` in un volume e fornisci `SYNC_TOKEN` tramite l'ambiente protetto del deployment. Il servizio non parte senza un token di almeno 32 caratteri. `/health` non richiede autenticazione. Guida completa al deployment (Docker, systemd, Caddy/nginx, backup) in inglese: [`sync/README.md`](../sync/README.md).

1. Sul primo dispositivo crea un vault, aggiungi gli host e configura URL e token nelle impostazioni. Esegui una sync.
2. Su un dispositivo senza vault scegli **Collega questo dispositivo**. Inserisci URL, token e la stessa password principale.
3. Le modifiche vengono sincronizzate mentre il vault è sbloccato. Non occorrono applicazioni di sincronizzazione esterne sui client.

Ogni vault si configura separatamente. Per un nuovo vault diverso da quello personale, l'app completa un URL base con `/vaults/<id>`. **Sul secondo dispositivo copia l'URL completo mostrato dal primo**, ad esempio `https://sync.example.com/vaults/abc123`: il nome del vault e l'identificativo locale del secondo dispositivo possono essere diversi. Crea/seleziona un vault locale vuoto e usa il collegamento al vault remoto con quell'URL e la stessa password. Il servizio web è opzionale per l'uso locale, obbligatorio soltanto per la sync tra dispositivi.

Il client rifiuta HTTP remoto e redirect. Host, utenti, credenziali, cartelle e token sono dentro il contenitore cifrato. Il servizio può osservare dimensione, tempi e indirizzi IP; chi possiede il token può scaricare, sostituire o cancellare i file sul server se possiede anche accesso amministrativo, ma il solo token non decifra il vault. Una password principale robusta resta necessaria contro tentativi offline. Non esiste recupero della password: conservarla e fare backup del vault.

### Conflitti e limiti della preview

La sync conserva un intero vault: se entrambi i dispositivi hanno modifiche non sincronizzate, interrompe l'operazione e conserva la copia locale. Non è ancora presente una schermata per unire le modifiche. Per risolvere un conflitto, chiudi le app e fai una copia dei file vault di entrambi i dispositivi; scegli una versione autorevole e ricrea un ambiente di sincronizzazione pulito con una nuova directory remota vuota e un **nuovo URL**. Configura quel nuovo URL sul dispositivo autorevole, così viene azzerata la revisione del precedente servizio, quindi ricollega l'altro dispositivo dopo averne conservato e rimosso il vault locale. Non eliminare l'unica copia di un vault. Un guasto dopo l'upload e prima del salvataggio della revisione locale può produrre un conflitto prudenziale.

Da completare prima di un uso stabile: risoluzione dei conflitti nell'app, esportazione/importazione guidata, recupero e pairing dispositivi, blocco automatico, protezione da rollback del server, test SSH con server reali, test macOS e revisione di sicurezza. Non sono implementati SFTP, agent forwarding, jump host, keyboard-interactive/2FA o biometria. Chiavi hardware non esportabili non sono sincronizzabili come chiavi private.

## Verifiche

```sh
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

### Test automatico dell'app desktop

```sh
npm run test:desktop
```

Compila una build debug dedicata e usa WebdriverIO con il driver incorporato nella WebView Tauri: non usa il browser personale o un'estensione. Il percorso verifica creazione del vault, selezione di un'identità condivisa per due host, salvataggio automatico, cambio schede/lista e blocco/sblocco con rilettura dei dati salvati. Non apre connessioni SSH.

Ogni esecuzione crea una directory temporanea per il vault e, su Windows, per il profilo WebView2; la directory viene rimossa al termine. L'identificativo Tauri di test è distinto da quello dell'app normale. La feature Cargo `desktop-e2e` abilita i plugin di automazione solo su richiesta e rifiuta le build release; la build ordinaria non li include. Usare il comando completo sopra, che prepara l'ambiente isolato.

L'app di test può mostrare una finestra propria. Il risultato è testuale; i log di build e driver sono in `artifacts/desktop-e2e/`, con `failure.png` in caso di test fallito. Gli artefatti contengono soltanto i dati sintetici usati dal test. Per verifiche UI funzionali usare questa suite prima di ricorrere all'esplorazione manuale del browser; riservare quest'ultima a controlli visivi mirati e diagnosi. I test di focus e scorciatoie globali richiedono un desktop dedicato per evitare interferenze dell'utente.

I test verificano rifiuto di password errate e manomissioni, nonce distinti, autenticazione API, revisioni concorrenti, isolamento dei vault e persistenza del servizio. Un server SSH temporaneo su localhost verifica accesso con password e chiave, terminale e rifiuto di identità cambiate prima dell'autenticazione. Un test Rust avvia il servizio Node e verifica upload, ripristino, aggiornamenti in entrambe le direzioni e conservazione dei dati in conflitto. Su Windows il test PTY apre PowerShell e verifica input, dimensioni e chiusura. L'accesso a server SSH reali e il comportamento macOS richiedono ambienti di prova dedicati. Select, menu vault, ritorno del focus e pannelli sono stati verificati nell’anteprima browser con dati sintetici. Il percorso automatico descritto sopra è stato verificato anche nella WebView dell’app desktop su Windows.

La pianificazione delle prossime funzioni è in [ROADMAP.md](ROADMAP.md). Per generare il solo eseguibile Windows con interfaccia incorporata, senza dipendere da Vite: `npm run desktop:build -- --no-bundle`.

Licenza MIT. Le dipendenze mantengono le rispettive licenze.
