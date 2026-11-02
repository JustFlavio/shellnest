# macOS app icon

macOS 26 and later use the native Icon Composer catalog in
`src-tauri/icons/Assets.car`. `src-tauri/Info.plist` selects its `Shellnest` icon.
The macOS Tauri configuration copies the catalog to `Contents/Resources/Assets.car`.
Older systems use `src-tauri/icons/icon.icns` from the same export.

The icon document is `src-tauri/icons/Shellnest.icon`. Its opaque background lets
macOS apply its own mask instead of placing the transparent artwork inside a
second tile. The artwork comes from `src-tauri/app-icon.png`; Windows and Linux
assets are independent of this macOS export.

To regenerate with Xcode 26 or later on macOS, run from the repository root:

```sh
cp src-tauri/app-icon.png src-tauri/icons/Shellnest.icon/Assets/Shellnest.png
icon_output=$(mktemp -d)
xcrun actool src-tauri/icons/Shellnest.icon \
  --compile "$icon_output" \
  --platform macosx \
  --minimum-deployment-target 11.0 \
  --app-icon Shellnest \
  --include-all-app-icons \
  --output-partial-info-plist "$icon_output/partial.plist"
cp "$icon_output/Assets.car" src-tauri/icons/Assets.car
cp "$icon_output/Shellnest.icns" src-tauri/icons/icon.icns
```

`npm run icons` performs this export on macOS alongside the other desktop assets.
Commit the source document and both exports together. Running `tauri icon`
overwrites the ICNS fallback; repeat this export afterward.

After bundling, verify that `Contents/Resources` contains both `Assets.car` and
`icon.icns`, and that `Contents/Info.plist` contains `CFBundleIconName = Shellnest`
alongside `CFBundleIconFile`. Check the installed app in both Applications and the
Dock on macOS 26 or later; check the ICNS fallback on an older macOS release.
