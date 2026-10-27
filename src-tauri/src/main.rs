#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[cfg(all(feature = "desktop-e2e", not(debug_assertions)))]
compile_error!("desktop-e2e is only allowed in debug builds");

fn main() {
    shellnest_lib::run();
}
