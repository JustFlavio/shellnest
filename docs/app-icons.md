# App icons

`src-tauri/app-icon.png` is the original Shellnest artwork. The header uses the generated 128px icon, so it shows the same mark as the desktop application.

Run `npm run icons` to regenerate the desktop assets with the installed Tauri CLI. The script changes the viewport around the original bitmap; it does not redraw the logo. Intermediate files stay in the ignored `artifacts/icons` directory.

- **Windows:** the ICO contains 16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 128 and 256px frames. This covers the [Microsoft minimum sizes and common DPI variants](https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-construction). The artwork occupies about 96% of the width, instead of the original 81.5%. The percentage is an optical sizing decision, not a Windows requirement.
- **macOS:** the ICNS includes the Tauri-generated sizes through 1024px, following the [Apple layout size](https://developer.apple.com/design/human-interface-guidelines/app-icons/). Its viewport keeps the rounded tile inset, with the artwork at about 82.4% of the width. This traditional ICNS asset does not use Icon Composer or new system appearance variants.
- **Linux:** the bundle includes 32, 48, 64, 128, 256 and 512px PNGs, with the same proportions as Windows. The [freedesktop icon theme specification](https://specifications.freedesktop.org/icon-theme/#installing_application_icons) recommends at least a 48px icon in `hicolor`.

Regeneration verifies that each ICO frame contains a PNG of the expected dimensions. Actual Dock, taskbar and launcher appearance still depends on the OS, display scaling and icon cache.
