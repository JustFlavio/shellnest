# Impostazioni

Dialog unico (menu ☰ → Impostazioni, `⌘,`) con sezioni: **Vault**, **Terminale**, **Scorciatoie**, **Aggiornamenti**.

Le impostazioni dell'app stanno in `localStorage` (`shellnest.settings`, `shellnest.shortcuts`): valgono per questo dispositivo, non si sincronizzano con il vault. Il parsing (`src/features/settings/settings.ts`, `src/features/settings/shortcuts.ts`) non lancia mai errori: ogni campo non valido torna al default.

## Fatto

- Vault: elenco, nuovo, rinomina, elimina (solo il vault attivo, solo se vuoto, mai `personal`: il controllo è nel backend, `delete_vault`), sync per vault con "Sincronizza ora".
- Terminale: font, dimensione, interlinea (1–1,6, default 1,15), tema colori (Shellnest, Nord, Dracula, Solarized Dark), copia alla selezione, incolla col tasto destro, bell, Option come Meta (spento di default: le tastiere italiane digitano `@ # [ ]` con Option), colori vivaci per il grassetto, scrollback.
- Scorciatoie: rimappatura con reset e controllo dei conflitti.
- Aggiornamenti: versione installata, "Controlla ora", interruttore "Controlla all'avvio" (`checkUpdates`, acceso di default). Il controllo contatta GitHub; scarica e riavvia solo su clic (vedi `docs/releases.md`).

## Scelte di prodotto: cosa non è previsto

- **Autocomplete** del terminale: non previsto.
- **Indicatori di popolarità** accanto ai temi (numero di utenti): non hanno senso senza un servizio centrale.
- **Link esterni** nella sidebar (richiesta funzioni, segnalazione bug, programma beta): per bug e idee c'è il repository GitHub pubblico.
- Account, SSH ID, inviti, SFTP, log a pagamento: fuori dal prodotto.

## Idee future

Evidenziazione di parole chiave nell'output del terminale (errori, avvisi, IP e MAC); keepalive configurabile (oggi fisso a 30 s con 3 tentativi in `src-tauri/src/terminal/host_key.rs`) e riconnessione automatica; tema chiaro dell'app; documentazione e changelog nell'app. Vault selezionabile dalla barra in alto, con "Sync now" accanto a ogni vault collegato a un server; blocco automatico del vault per inattività; ripristino delle schede all'avvio; esporta/importa vault.
