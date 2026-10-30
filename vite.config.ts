import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [tailwindcss()],
  // Keep the Vite 6 webview baseline when upgrading the bundler.
  build: { target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"] },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
