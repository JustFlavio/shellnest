use crate::commands::system::MenuLabels;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem as P, Submenu};
use tauri::{AppHandle, Emitter, Wry};

/// The frontend listens for this event and runs the same check as its own "Check for updates".
const CHECK_UPDATES_EVENT: &str = "check-for-updates";
const CHECK_UPDATES_ID: &str = "check-updates";
/// Other custom items emit this event with their id as payload; the frontend runs the matching action.
const MENU_ACTION_EVENT: &str = "menu-action";
const ACTIONS: [&str; 3] = ["open-settings", "lock-vault", "close-all-sessions"];

// The default macOS menu binds Cmd+W to "Close Window", which would swallow the pane-close shortcut.
fn build(h: &AppHandle, labels: &MenuLabels) -> tauri::Result<Menu<Wry>> {
    Menu::with_items(
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
                        &labels.check_updates,
                        true,
                        None::<&str>,
                    )?,
                    &MenuItem::with_id(h, ACTIONS[0], &labels.settings, true, None::<&str>)?,
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
                &labels.vault,
                true,
                &[
                    &MenuItem::with_id(h, ACTIONS[1], &labels.lock_vault, true, None::<&str>)?,
                    &MenuItem::with_id(
                        h,
                        ACTIONS[2],
                        &labels.close_all_sessions,
                        true,
                        None::<&str>,
                    )?,
                ],
            )?,
            &Submenu::with_items(
                h,
                &labels.edit,
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
                &labels.window,
                true,
                &[&P::minimize(h, None)?, &P::maximize(h, None)?],
            )?,
        ],
    )
}

pub(crate) fn install(app: &mut tauri::App) -> tauri::Result<()> {
    app.set_menu(build(app.handle(), &MenuLabels::default())?)?;
    app.on_menu_event(|app, event| {
        if event.id() == CHECK_UPDATES_ID {
            let _ = app.emit(CHECK_UPDATES_EVENT, ());
        } else if let Some(action) = ACTIONS.iter().find(|a| event.id().as_ref() == **a) {
            let _ = app.emit(MENU_ACTION_EVENT, *action);
        }
    });
    Ok(())
}

/// Replaces the menu with one in the language the UI is showing.
pub(crate) fn relabel(app: &AppHandle, labels: &MenuLabels) -> tauri::Result<()> {
    app.set_menu(build(app, labels)?)?;
    Ok(())
}
