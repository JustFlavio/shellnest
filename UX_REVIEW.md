# Revisione UX — 25 ottobre 2026

Perimetro: client SSH per utenti individuali, alternativa open source a un altro client SSH con sync self-hosted opzionale. Parità Windows/macOS e uso da tastiera sono requisiti. Il lavoro mantiene il sistema visivo esistente e le protezioni dei vault.

## Metodo ed evidenze

Due valutazioni indipendenti: revisione di design e flussi; detector e browser. Una terza revisione ha controllato le correzioni, con un successivo passaggio sui problemi segnalati. Le valutazioni iniziali descrivono la baseline: alcune modifiche erano già visibili nelle catture successive via hot reload.

Il detector statico iniziale non ha trovato regole violate; quello nel browser ha segnalato 41 testi UI troppo piccoli e un ulteriore testo minuscolo. I risultati statici da soli non rappresentavano la qualità dell'esperienza.

Il punteggio euristico iniziale era 23/40. Non è stato ricalcolato dopo le modifiche e non misura sicurezza o maturità per la produzione.

| Euristica | Baseline /4 |
| --- | --- |
| Visibilità dello stato | 3 |
| Corrispondenza con il lavoro reale | 3 |
| Controllo e libertà | 2 |
| Coerenza | 2 |
| Prevenzione degli errori | 3 |
| Riconoscimento anziché memoria | 2 |
| Efficienza | 2 |
| Essenzialità | 3 |
| Recupero dagli errori | 2 |
| Aiuto e documentazione | 1 |

## Problemi affrontati

| Problema | Risultato |
| --- | --- |
| Schede con nome e utente, destinazione nascosta nel tooltip | Indirizzo, porta, utente, cartella e identità visibili; destinazione associata anche al nome accessibile del controllo. |
| Clic per selezionare, Invio per connettere sullo stesso pulsante | Pulsante per connettere e checkbox indipendente per selezionare, con comportamento nativo da tastiera. |
| Azioni delle schede affidate al clic destro o al passaggio del mouse | Menu azioni sempre disponibile; stesso insieme di azioni del menu contestuale. |
| Cartelle come ulteriori schede sopra i server | Cartelle nella sidebar; filtro dedicato quando la sidebar è ridotta. |
| Testi operativi da 10–11 px e titolo Host assente | Testi aumentati, titolo e conteggio coerenti fra le raccolte; rimossi contenitori di form e stili non più utilizzati. |
| Annullamento con perdita silenziosa dei draft | Conferma condivisa prima di scartare modifiche agli editor host, identità e chiavi. |
| Percorso host → identità → chiave senza ritorno esplicito | Indicazioni del contesto, pulsanti di ritorno e focus ripristinato sul campo pertinente. |
| Stato sync poco distinguibile e possibile sovrapposizione con salvataggi | Stato in corso/errore/riprova, scritture UI serializzate; sync automatica rimandata mentre un pannello è aperto. |
| Scorciatoie poco scopribili | Guida nella sidebar e indicazioni Ctrl/Cmd; ricerca e blocco disponibili con combinazioni dedicate. |

## Verifiche eseguite

- Build TypeScript/Vite finale riuscita; rimangono gli avvisi di bundling relativi a `use client` in Base UI e alla dimensione del bundle.
- 16 test JavaScript superati: controlli, parsing SSH, selezione indipendente, protezione dei draft, backend dimostrativo e servizio sync.
- 21 test Rust superati: cifratura, migrazione, isolamento vault, SSH temporaneo su localhost con password e chiave, PTY Windows e sync fra dispositivi simulati.
- Browser con dati sintetici: nuovo host, creazione annidata di identità con password fittizia, salvataggio, ricerca, filtri cartelle, selezione multipla, apertura dell'assegnazione identità e conferma di scarto. Verificati mantenimento del draft e ritorno del focus al campo Identità.
- Catture esaminate a 1280×840 e 600×800. Il controllo DOM a 480 px non mostrava overflow orizzontale della pagina; la cattura a quella misura era malformata ed è stata scartata.
- Revisione finale: problema di focus dovuto alla sync automatica risolto nel codice mediante rinvio durante i pannelli aperti. Questa specifica interazione non è stata riprodotta nel desktop, perché la demo non esegue sync.

Le catture in `.impeccable/review/` usano esclusivamente dati dimostrativi. Il browser T3 ha avuto timeout nelle snapshot; la verifica visiva è proseguita tramite Chrome. Il ripristino finale del browser ha incontrato ulteriori timeout.

## Confini della verifica e prossimi requisiti di release

Non sono stati verificati il WebView desktop, macOS, lettori di schermo o server SSH esterni. La revisione conferma le correzioni esaminate, non certifica l'intero prodotto per la produzione.

Prima di una release stabile restano prioritari backup e ripristino guidati, gestione dei conflitti sync nell'app, prove native su entrambi i sistemi e revisione di sicurezza, come riportato in README.md e ROADMAP.md. SFTP e le altre funzioni pianificate non sono diventate funzionalità disponibili con questa revisione.
