//! Shellnest: a desktop SSH client with encrypted local vaults and optional self-hosted sync.
mod app;
mod commands;
mod keychain;
mod local;
#[cfg(target_os = "macos")]
mod menu;
mod model;
mod state;
mod sync;
mod terminal;
#[cfg(test)]
mod test_support;
mod vault;
mod view;

pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(feature = "desktop-e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());
    builder
        .setup(app::setup)
        .invoke_handler(tauri::generate_handler![
            commands::unlock::status,
            commands::vaults::select_vault,
            commands::vaults::create_vault,
            commands::vaults::rename_vault,
            commands::vaults::delete_vault,
            commands::unlock::unlock,
            commands::unlock::unlock_saved,
            commands::unlock::is_remembered,
            commands::unlock::set_remembered,
            commands::unlock::lock,
            commands::hosts::save_host,
            commands::hosts::reveal_host_password,
            commands::credentials::save_identity,
            commands::credentials::save_key,
            commands::credentials::delete_identity,
            commands::credentials::delete_key,
            commands::hosts::assign_identity,
            commands::hosts::delete_host,
            commands::groups::save_group,
            commands::groups::delete_group,
            commands::workspaces::save_workspace,
            commands::workspaces::delete_workspace,
            commands::sync::configure_sync,
            commands::sync::sync_vault,
            commands::sync::restore_vault,
            commands::terminal::probe_host,
            commands::terminal::probe_target,
            commands::terminal::trust_host,
            commands::terminal::connect,
            commands::terminal::connect_quick,
            commands::terminal::terminal_password,
            commands::terminal::connect_local,
            commands::terminal::terminal_input,
            commands::terminal::terminal_resize,
            commands::system::open_url,
            commands::terminal::disconnect
        ])
        .on_window_event(|_, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                local::shutdown_all();
            }
        })
        .run(tauri::generate_context!())
        .expect("Avvio app fallito");
}
