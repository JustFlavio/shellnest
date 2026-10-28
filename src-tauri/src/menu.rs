use tauri::Emitter;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem as P, Submenu};

/// The frontend listens for this event and runs the same check as its own "Controlla aggiornamenti".
const CHECK_UPDATES_EVENT: &str = "check-for-updates";
const CHECK_UPDATES_ID: &str = "check-updates";
/// Other custom items emit this event with their id as payload; the frontend runs the matching action.
const MENU_ACTION_EVENT: &str = "menu-action";
const ACTIONS: [&str; 3] = ["open-settings", "lock-vault", "close-all-sessions"];

// The default macOS menu binds Cmd+W to "Close Window", which would swallow the pane-close shortcut.
pub(crate) fn install(app: &mut tauri::App) -> tauri::Result<()> {
    let h = app.handle();
    let menu = Menu::with_items(
        h,
        &[
            &Submenu::with_items(
                h,
                "Shellnest",
                true,
                &[
                    &P::about(h, None, None)?,
                    &MenuItem::with_id(
                        h,
                        CHECK_UPDATES_ID,
                        "Controlla aggiornamenti…",
                        true,
                        None::<&str>,
                    )?,
                    &MenuItem::with_id(h, ACTIONS[0], "Impostazioni…", true, None::<&str>)?,
                    &P::separator(h)?,
                    &P::hide(h, None)?,
                    &P::hide_others(h, None)?,
                    &P::show_all(h, None)?,
                    &P::separator(h)?,
                    &P::quit(h, None)?,
                ],
            )?,
            &Submenu::with_items(
                h,
                "Vault",
                true,
                &[
                    &MenuItem::with_id(h, ACTIONS[1], "Blocca vault", true, None::<&str>)?,
                    &MenuItem::with_id(
                        h,
                        ACTIONS[2],
                        "Chiudi tutte le sessioni",
                        true,
                        None::<&str>,
                    )?,
                ],
            )?,
            &Submenu::with_items(
                h,
                "Modifica",
                true,
                &[
                    &P::undo(h, None)?,
                    &P::redo(h, None)?,
                    &P::separator(h)?,
                    &P::cut(h, None)?,
                    &P::copy(h, None)?,
                    &P::paste(h, None)?,
                    &P::select_all(h, None)?,
                ],
            )?,
            &Submenu::with_items(
                h,
                "Finestra",
                true,
                &[&P::minimize(h, None)?, &P::maximize(h, None)?],
            )?,
        ],
    )?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id() == CHECK_UPDATES_ID {
            let _ = app.emit(CHECK_UPDATES_EVENT, ());
        } else if let Some(action) = ACTIONS.iter().find(|a| event.id().as_ref() == **a) {
            let _ = app.emit(MENU_ACTION_EVENT, *action);
        }
    });
    Ok(())
}
