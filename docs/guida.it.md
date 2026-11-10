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

L'interfaccia usa componenti shadcn/ui (stile Base Nova) basati su Base UI, con Tailwind CSS 4. I componenti necessari sono nel repository in `src/components/ui`; i colori dei temi sono in `src/features/settings/app-themes.ts` e diventano le variabili di `src/theme.css`, il layout desktop in `src/style.css`. Select e menu sono personalizzati; i pannelli usano il focus e la gestione tastiera di Base UI. I test dei controlli usano il runner Node esistente, senza un framework di test aggiuntivo.

La barra delle sessioni occupa la parte superiore; la sidebar raccoglie navigazione e cartelle e passa automaticamente alle sole icone nelle finestre strette. La vista a schede separa cartelle e host senza cartella; la lista mostra le cartelle apribili con doppio clic o Invio. La ricerca mostra direttamente gli host corrispondenti. La porta SSH compare solo se diversa da 22. Un clic seleziona, Ctrl/Cmd clic aggiunge o rimuove host dalla selezione; doppio clic o Invio connette. Spazio seleziona da tastiera. La matita compare su hover o focus e apre l’editor; il clic destro espone le altre azioni. La barra flottante permette connessioni in tab separate, assegnazione di identità ed eliminazione con conferma. I nuovi server richiedono la verifica individuale dell’impronta anche nell’apertura multipla; annullarla interrompe le aperture rimanenti.

Gli editor usano sezioni di form e azioni fisse nel footer. Gli host validi si salvano automaticamente; gli altri editor usano il salvataggio esplicito. Creare identità e chiavi dall'host conserva la bozza. Le conferme brevi usano dialoghi centrati; le modifiche incomplete richiedono conferma prima di essere scartate.

Il menu applicazione nell’header raccoglie navigazione, nuove connessioni, visualizzazione, impostazioni, scorciatoie, blocco del vault e comandi della finestra. **Scorciatoie da tastiera** elenca i comandi disponibili: `Ctrl/Cmd T` o `Ctrl/Cmd K` per una nuova connessione, `Ctrl/Cmd J` per passare a una scheda aperta, `Ctrl/Cmd N` per un nuovo host, `Ctrl/Cmd Maiusc F` per la ricerca nella raccolta e `Ctrl/Cmd Maiusc L` per bloccare il vault, con conferma se ci sono sessioni aperte. Chiudere la sessione attiva seleziona una sessione adiacente quando disponibile.

- Vault locale cifrato con Argon2id e XChaCha20-Poly1305, nonce casuali a ogni salvataggio.
- Più vault indipendenti, ciascuno con host e identità propri; creazione, selezione e rinomina. Un vault locale ha la sua password; un vault sul server si apre con la password dell’account.
- Elenco e cards compatte degli host, cartelle, ricerca, modifica, menu azioni e selezione multipla.
- Nuova scheda `+`, `Ctrl/Cmd T` e `Ctrl/Cmd K`: ricerca di host e schede in gruppi con titolo («Schede», «Host», «Connessione rapida»), accessi recenti agli host salvati, terminale locale e connessione rapida con identità esistente. Un host con una scheda aperta compare solo sotto «Schede». `Ctrl/Cmd J` apre lo stesso riquadro in modalità «Vai alla scheda»: elenca soltanto le schede aperte, le più recenti per prime.
- Terminale locale del dispositivo con PTY nativo (ConPTY su Windows), input e ridimensionamento.
- Riconoscimento del sistema remoto dopo l'accesso, con icona e ultimo collegamento memorizzati nel vault.
- Portachiavi: importazione da file o testo, chiave privata e passphrase conservate una sola volta, riconoscimento dei duplicati per impronta pubblica.
- Identità riutilizzabili: nome, utente SSH e riferimento a una chiave oppure password. Una chiave può essere usata da più identità; ogni identità può essere assegnata a molti host.
- Assegnazione di un'identità a più host in una sola operazione; conteggi e filtri degli host associati; eliminazione bloccata per chiavi e identità ancora in uso.
- Terminali interattivi in schede riordinabili, duplicazione, riconnessione e chiusura delle altre sessioni; verifica esplicita dell'impronta SHA-256 prima dell'autenticazione e blocco se cambia. Durante la connessione il riquadro mostra i passaggi (connessione, impronta, autenticazione, sessione); la verifica dell’impronta e, se la chiave viene rifiutata, la richiesta della password avvengono dentro il riquadro, senza finestre. Se il server offre keyboard-interactive (ad esempio con `PasswordAuthentication no`, o PAM con codice OTP come Google Authenticator o Duo), Shellnest lo usa al posto della password, come OpenSSH, e le sue domande compaiono nel riquadro, con nome, istruzioni e testo forniti dal server; i campi senza eco sono mascherati. La password salvata risponde da sola a un’unica domanda nascosta, una sola volta, se il server non l’ha già rifiutata; il codice OTP e ogni altra domanda vanno sempre all’utente. Dopo 3 tentativi rifiutati l’accesso termina; «Annulla» interrompe il tentativo. Ogni passaggio mostra il suo esito (con un avviso, non un segno di spunta, se c’è stato un ripiego, ad esempio chiave rifiutata e poi password); dopo 3 password errate il tentativo termina con «Ricomincia» e «Chiudi». «Mostra log» apre il registro della connessione (indirizzo, server, algoritmi, impronta, tentativi), una riga per evento con il tempo trascorso, un’icona per tipo ed errori e rifiuti in evidenza, e dal cui angolo in alto a destra l’icona «Copia log» copia il testo; non contiene mai password o chiavi e resta solo in memoria.

La connessione rapida (indirizzo digitato nella ricerca, anche con Ctrl/Cmd+Invio) avvia lo stesso riquadro e vi pone le domande: «Utente» (precompilato da `utente@host`, oppure un’identità salvata che porta con sé le credenziali) e, senza identità, «Metodo di accesso» (password o chiave del portachiavi). «Continua» si collega senza salvare nulla; «Continua e salva» crea anche l’host nel vault (nome predefinito: l’indirizzo; con una chiave viene creata, o riusata, un’identità). L’impronta di una connessione rapida non viene mai salvata.

- Account sul server di sincronizzazione incluso: i tuoi vault su tutti i dispositivi e vault condivisi con i colleghi, con ruoli. Sync ogni 30 secondi mentre il vault è aperto, dopo ogni modifica e con il pulsante manuale; le modifiche concorrenti si uniscono.
- Blocco manuale e cambio vault chiudono tutte le sessioni, comprese quelle locali, con conferma quando sono aperte.

I file sono nella directory dati applicazione Tauri: il vault personale esistente resta `vault.json`, gli altri sono in `vault-vaults/<id>.json`. Il catalogo `vault.catalog.json` contiene nomi e identificativi locali non cifrati; i contenuti dei vault sono cifrati, con una copia precedente `.bak`. Il blocco di istanza impedisce a due processi della nuova versione di scrivere contemporaneamente. Gli elenchi degli host non contengono password o chiavi SSH. Il campo password mostra pallini per una password esistente: soltanto il clic sull’occhiello recupera quella del singolo host dal vault sbloccato. La visualizzazione non modifica l’host; nasconderla rimuove il valore recuperato dallo stato del campo. La UI gestisce in memoria i segreti appena digitati fino alla chiusura dell’editor; localStorage conserva solo preferenze di visualizzazione. Il backend usa zeroizzazione per chiave e dati decifrati, senza promettere l'eliminazione di ogni copia creata da librerie o runtime.

Il riconoscimento OS usa un comando di sola lettura su un canale SSH separato; non inserisce comandi nel terminale interattivo. Non vengono registrati comandi o output. I recenti comprendono attualmente gli host salvati, non le destinazioni rapide.

## Chiavi, identità e migrazione

Importa la chiave in **Chiavi SSH**, poi crea un'**Identità** con utente (es. `root`) e riferimento alla chiave. Seleziona quell'identità quando aggiungi un host, oppure seleziona più host e usa **Assegna identità**. Un'altra identità con utente `ubuntu` può utilizzare la stessa chiave. Modifiche a identità e chiavi si applicano alle connessioni successive; le sessioni già aperte conservano il proprio accesso.

Utente e password inseriti nell’editor appartengono soltanto a quell’host. Il campo utente propone anche le identità salvate: selezionarne una collega esplicitamente un accesso condiviso. Dal menu **+ Identità o chiave SSH** puoi scegliere una chiave del portachiavi o importarne una, senza creare un’identità condivisa. I tag sotto la cartella si cercano o creano inline, vengono salvati nel vault e sono inclusi nella ricerca host. Le credenziali private non creano identità. Lasciare vuota la password durante la modifica conserva quella già salvata per lo stesso host. Le identità contengono `keyId` oppure una password; la sync conserva dati e riferimenti nel vault cifrato.

L’editor salva automaticamente dopo 650 ms di pausa soltanto gli host completi: etichetta, indirizzo, porta e credenziali valide. Una bozza incompleta resta nella UI e richiede conferma prima di essere scartata con un clic esterno o con Escape. Chiudere un host valido completa il salvataggio pendente. La sincronizzazione automatica può proseguire mentre l’editor mostra un host valido; il suo stato è distinto dal salvataggio locale.

Al primo sblocco, i vault precedenti vengono migrati allo schema dati 6. Lo schema 6 aggiunge tag e chiavi dirette agli host; conserva cartelle, porte ereditate e accessi precedenti. Le identità esistenti e i loro collegamenti restano invariati; la migrazione non tenta di dedurne la proprietà dal nome. Per la prima versione, chiavi e credenziali uguali sono accorpate, mentre host, cartelle e impronte dei server sono conservati. Prima di riscrivere il vault locale viene salvata una copia cifrata `.pre-v6.bak`, non sovrascritta dai salvataggi ordinari. Una chiave legacy non valida viene conservata e indicata come da verificare, così può essere reimportata senza perdere il riferimento. La migrazione conserva password principale e configurazione sync. **Chiudi la vecchia app e aggiorna tutti i dispositivi prima di riprendere la sync**: i client precedenti non gestiscono il nuovo schema.

Nel browser l'anteprima usa gli stessi componenti dell'app desktop con dati dimostrativi modificabili in memoria: host, identità, chiavi, assegnazioni e vault. Tutto torna ai dati iniziali ricaricando la pagina. Usa solo credenziali e chiavi fittizie: password, chiavi private e token non vengono conservati dal backend dimostrativo, che non esegue cifratura, verifiche crittografiche, SSH o sincronizzazione di rete. Il recupero con l’occhiello mostra solo una password dimostrativa, non quella digitata. Il vault locale dell'app desktop non viene modificato.

## Sincronizzazione e condivisione

Il server incluso (`sync/`) è un servizio Node.js senza dipendenze da ospitare in proprio. Conserva account e vault **cifrati sui dispositivi**: il server non vede host, indirizzi, utenti, password, chiavi, cartelle né i nomi dei vault. Vede i nomi utente, i nomi dei dispositivi, chi appartiene a quale vault con quale ruolo, dimensioni e orari delle modifiche. Installazione con Docker Compose e HTTPS automatico (Caddy), backup e API in inglese: [`sync/README.md`](../sync/README.md). Come funziona la cifratura: [`docs/sync-design.md`](sync-design.md).

### Primo avvio del server

```sh
cd sync
SYNC_DOMAIN=sync.example.com docker compose up -d
docker compose exec sync node server.ts invite --admin
```

Il secondo comando stampa un invito da amministratore, valido una volta per 7 giorni. Per una prova sul proprio computer basta `npm run sync` e poi `node sync/server.ts invite --admin`: l’app accetta HTTP solo per `localhost`, per tutto il resto serve HTTPS.

### Account

1. In **Impostazioni → Vault** scegli **Ho un invito** e inserisci indirizzo del server, codice di invito, nome utente e una password di almeno 12 caratteri.
2. L’app mostra la **chiave di recupero** una sola volta. Conservala in un gestore di password o stampala: se dimentichi la password, è l’unico modo per rientrare. Nemmeno chi gestisce il server può recuperare l’account.
3. Su un altro dispositivo scegli **Accedi al server** (anche dalla schermata di sblocco) con indirizzo, nome utente e password: i vault dell’account arrivano da soli.

Dal riquadro dell’account:

- **Dispositivi** elenca i dispositivi collegati; rimuoverne uno lo scollega alla sua richiesta successiva.
- **Cambia password** cambia la password dell’account. Gli altri dispositivi restano collegati: uno sbloccato passa alla nuova password alla prossima sincronizzazione; uno spento si apre con la nuova password appena raggiunge il server, e finché resta offline si apre ancora con quella vecchia.
- **Invita** (solo amministratori) crea un invito per un collega.
- **Esci** scollega il dispositivo e toglie da qui i vault del server, che restano sul server. È rifiutato se ci sono modifiche non ancora inviate.
- **Password dimenticata?** nella schermata di accesso imposta una nuova password con la chiave di recupero e scollega tutti gli altri dispositivi.

Dopo 10 accessi falliti in 15 minuti con lo stesso nome utente dallo stesso indirizzo IP, quell’indirizzo non può più accedere a quel nome utente per il resto dei 15 minuti; dopo 200 accessi falliti da un indirizzo, su qualunque nome utente, si ferma l’indirizzo. Chi prova a indovinare la tua password da un altro posto blocca solo se stesso, e un ufficio dietro una VPN resta lontano dal limite. I dispositivi già collegati continuano a funzionare.

### Vault sul server

Un vault locale resta locale finché non scegli **Carica sul server** nel riquadro **Server** del vault. Da quel momento si apre con la password dell’account invece della sua; resta una copia del file locale con estensione `.pre-server.bak`.

Il vault caricato ha due parti:

- la parte **condivisa**, che vedono tutti i membri: host, cartelle, impronte dei server e le identità o chiavi che qualcuno ha scelto di condividere;
- la tua parte **privata**, sincronizzata solo tra i tuoi dispositivi: le tue identità, chiavi e credenziali, quali credenziali usi per quale host o cartella, gli spazi di lavoro e la cronologia delle connessioni.

Le modifiche fatte su due dispositivi si uniscono campo per campo; se lo stesso campo è cambiato su entrambi vince l’ultima scrittura. Il server conserva le ultime 20 versioni della parte condivisa per un recupero manuale.

### Condividere con i colleghi

Il proprietario aggiunge un collega per nome utente nel riquadro **Membri**, con un ruolo:

| Ruolo          | Può                                                            |
| -------------- | -------------------------------------------------------------- |
| Proprietario   | tutto, compresi membri, ruoli e nome del vault                 |
| Può modificare | cambiare host, cartelle e impronte                             |
| Sola lettura   | vedere host e cartelle e collegarsi con le proprie credenziali |

Prima di condividere, confronta di persona o in chiamata il **codice di sicurezza** che il collega vede nel suo account con quello che vedi tu: esclude che il server abbia sostituito la sua chiave. L’app ricorda la chiave del collega e rifiuta una chiave diversa in seguito.

Le tue identità restano private finché non scegli di condividerle dall’editor; chi ha la sola lettura imposta le proprie credenziali per gli host del vault. Rimuovere un membro sostituisce la chiave del vault: chi è stato rimosso tiene la copia che aveva, ma non riceve più nulla. L’app elenca le identità e le chiavi condivise che poteva leggere: cambiale anche sui server.

### Limiti

Polling ogni 30 secondi, nessuna notifica in tempo reale. Il server è pensato per una persona o un piccolo gruppo: account e vault stanno in file JSON e in memoria. Restano da fare: esportazione/importazione guidata, blocco automatico, test SSH con server reali e revisione di sicurezza. Non sono implementati agent forwarding, jump host o biometria. Chiavi hardware non esportabili non sono sincronizzabili come chiavi private.

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

Compila una build debug dedicata e usa WebdriverIO con il driver incorporato nella WebView Tauri: non usa il browser personale o un'estensione. Il percorso verifica creazione del vault, selezione di un'identità condivisa per due host, salvataggio automatico, cambio schede/lista e blocco/sblocco con rilettura dei dati salvati. Poi avvia un server di sync locale e, dall’interfaccia, crea l’account con un invito, carica il vault, controlla che sul server non ci siano dati in chiaro, apre i dispositivi, cambia la password, crea un invito e riapre il vault solo con la nuova password. Non apre connessioni SSH.

Ogni esecuzione crea una directory temporanea per il vault e, su Windows, per il profilo WebView2; la directory viene rimossa al termine. L'identificativo Tauri di test è distinto da quello dell'app normale. La feature Cargo `desktop-e2e` abilita i plugin di automazione solo su richiesta e rifiuta le build release; la build ordinaria non li include. Usare il comando completo sopra, che prepara l'ambiente isolato.

L'app di test può mostrare una finestra propria. Il risultato è testuale; i log di build e driver sono in `artifacts/desktop-e2e/`, con `failure.png` in caso di test fallito. Gli artefatti contengono soltanto i dati sintetici usati dal test. Per verifiche UI funzionali usare questa suite prima di ricorrere all'esplorazione manuale del browser; riservare quest'ultima a controlli visivi mirati e diagnosi. I test di focus e scorciatoie globali richiedono un desktop dedicato per evitare interferenze dell'utente.

I test verificano rifiuto di password errate e manomissioni, nonce distinti, autenticazione API, revisioni concorrenti, isolamento dei vault e persistenza del servizio. Un server SSH temporaneo su localhost verifica accesso con password, chiave e keyboard-interactive (password salvata, codice OTP, codice errato, annullamento); su Linux la CI ripete i casi keyboard-interactive contro OpenSSH con PAM e Google Authenticator in un container (`src-tauri/test-fixtures/pam-2fa`), terminale e rifiuto di identità cambiate prima dell'autenticazione. Un test Rust avvia il servizio Node con due dispositivi dello stesso utente e una collega in sola lettura: unione delle modifiche, condivisione di un’identità, rimozione con cambio della chiave, cambio password seguito dagli altri dispositivi e verifica che il server non veda niente in chiaro. Su Windows il test PTY apre PowerShell e verifica input, dimensioni e chiusura. L'accesso a server SSH reali e il comportamento macOS richiedono ambienti di prova dedicati. Select, menu vault, ritorno del focus e pannelli sono stati verificati nell’anteprima browser con dati sintetici. Il percorso automatico descritto sopra è stato verificato anche nella WebView dell’app desktop su Windows.

La pianificazione delle prossime funzioni è in [ROADMAP.md](ROADMAP.md). Per generare il solo eseguibile Windows con interfaccia incorporata, senza dipendere da Vite: `npm run desktop:build -- --no-bundle`.

Licenza MIT. Le dipendenze mantengono le rispettive licenze.
