# Impostazioni

Dialog unico (menu ☰ → Impostazioni, `⌘,`) con sezioni: **Vault**, **Terminale**, **Scorciatoie**. In fondo: Documentazione e Changelog ("Presto") e la versione.

Le impostazioni dell'app stanno in `localStorage` (`shellnest.settings`, `shellnest.shortcuts`): valgono per questo dispositivo, non si sincronizzano con il vault. Il parsing (`src/settings.mjs`, `src/shortcuts.mjs`) non lancia mai errori: ogni campo non valido torna al default.

## Fatto

- Vault: elenco, nuovo, rinomina, elimina (solo il vault attivo, solo se vuoto, mai `personal`: il controllo è nel backend, `delete_vault`), sync per vault con "Sincronizza ora".
- Terminale: font, dimensione, tema colori (Shellnest, Nord, Dracula, Solarized Dark), copia alla selezione, incolla col tasto destro, bell, Option come Meta (spento di default: le tastiere italiane digitano `@ # [ ]` con Option), colori vivaci per il grassetto, scrollback.
- Scorciatoie: rimappatura con reset e controllo dei conflitti.

## In arrivo (mostrato nella UI come "Presto")

- **Evidenziazione parole chiave** nell'output (errori, avvisi, OK, info, debug, IP e MAC) con colori a scelta. Lavoro a sé: serve colorare l'output di xterm senza toccare i dati inviati alla shell.
- **Connessione**: keepalive configurabile (oggi fisso a 30 s con 3 tentativi in `src-tauri/src/terminal.rs`), riconnessione automatica, shell del terminale locale, rilevamento OS dell'host come interruttore.
- Documentazione e Changelog.
- Tema chiaro dell'app (oggi esiste una sola paletta): solo allora ha senso il selettore "Tema".

## Scelte: cosa NON copiamo da un altro client SSH

- **Autocomplete** del terminale (beta in un altro client SSH): non previsto.
- **Indicatori di popolarità** accanto ai temi (numero di utenti): non hanno senso senza un servizio centrale.
- **Link esterni** nella sidebar (richiesta funzioni, segnalazione bug, programma beta): per bug e idee c'è il repository GitHub pubblico.
- Account, SSH ID, inviti, SFTP, log a pagamento: fuori dal prodotto.

## Idee future

Vault selezionabile dalla barra in alto, con "Sync now" accanto a ogni vault collegato a un server; blocco automatico del vault per inattività; ripristino delle schede all'avvio; esporta/importa vault.
