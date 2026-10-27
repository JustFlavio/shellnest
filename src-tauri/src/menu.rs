use tauri::menu::{Menu, PredefinedMenuItem as P, Submenu};

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
    Ok(())
}
