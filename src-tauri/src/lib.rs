//! Shellnest: a desktop SSH client with encrypted local vaults and optional self-hosted sync.
mod account;
mod app;
mod commands;
mod error;
mod keychain;
mod local;
mod locks;
#[cfg(target_os = "macos")]
mod menu;
mod message;
mod model;
mod sftp;
mod ssh;
mod state;
mod sync;
mod terminal;
#[cfg(test)]
mod test_support;
mod vault;
mod view;

/// Builds and runs the Tauri app. `main.rs` only calls this, so the binary stays a one-liner.
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init());
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
            commands::account::sign_in,
            commands::account::register,
            commands::account::recover_account,
            commands::account::change_password,
            commands::account::sign_out,
            commands::account::devices,
            commands::account::revoke_device,
            commands::account::create_invite,
            commands::sync::sync_vault,
            commands::sync::upload_vault,
            commands::sync::leave_vault,
            commands::sync::vault_members,
            commands::sync::add_member,
            commands::sync::set_member_role,
            commands::sync::remove_member,
            commands::sync::share_identity,
            commands::sftp::sftp_connect,
            commands::sftp::sftp_answer,
            commands::sftp::sftp_list,
            commands::sftp::sftp_mutate,
            commands::sftp::sftp_transfer,
            commands::sftp::sftp_cancel,
            commands::sftp::sftp_close,
            commands::terminal::probe_host,
            commands::terminal::probe_target,
            commands::terminal::trust_host,
            commands::terminal::connect,
            commands::terminal::connect_quick,
            commands::terminal::terminal_answer,
            commands::terminal::connect_local,
            commands::terminal::terminal_input,
            commands::terminal::terminal_resize,
            commands::system::open_url,
            commands::system::set_menu_labels,
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
