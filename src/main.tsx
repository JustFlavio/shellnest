import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { trackOpener } from "@/lib/opener";
import { desktop } from "@/lib/platform";
import "./theme.css";

if (import.meta.env.MODE === "desktop-e2e") {
  void import("@wdio/tauri-plugin");
}

if (desktop && /Mac/.test(navigator.userAgent))
  document.documentElement.classList.add("mac");
trackOpener();
createRoot(document.getElementById("root")!).render(<App />);
