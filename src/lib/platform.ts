import { isTauri } from "@tauri-apps/api/core";

export const desktop = isTauri();
export const mac = /Mac/i.test(navigator.platform);
