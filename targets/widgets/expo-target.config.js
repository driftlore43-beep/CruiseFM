/**
 * The Home Screen and Lock Screen widget extension.
 *
 * Read by @bacons/apple-targets during prebuild, which creates the real Xcode
 * target. Everything in this folder is compiled INTO THE EXTENSION, not into
 * the app — the extension is a separate process with its own sandbox, which
 * is why it reads a snapshot out of the shared App Group instead of asking
 * the app anything (see Snapshot.swift).
 *
 * The App Group string must match modules/cruise-widgets (the app's side),
 * app.json's entitlements, and the Apple Developer app ID. All four are the
 * same value; when they disagree the widgets quietly show placeholder data
 * with no error anywhere, so it is worth checking all four together.
 */
module.exports = {
  type: 'widget',
  // NO SPACE, AND THAT IS NOT COSMETIC — it is what build 37 died on:
  //
  //   Assigning provisioning profile ... to target 'CruiseFMWidgets'
  //   Could not find target 'CruiseFMWidgets' in project.pbxproj
  //
  // The plugin derives TWO names from this field. `productName` is
  // `sanitizeNameForNonDisplayUse(name)`, which strips non-word characters,
  // so 'CruiseFM Widgets' became 'CruiseFMWidgets' — and that sanitised form
  // is what EAS registers the target and its credentials under. But the
  // Xcode target itself is named with the RAW value, space and all, so at
  // signing time EAS looked for a target that did not exist under that name.
  // Keeping the two identical removes the mismatch at its source.
  //
  // Nothing user-facing is lost: the names people actually see in the widget
  // gallery come from each widget's own `configurationDisplayName` in Swift
  // ("Start Drive", "On Air Now", "Your Streak", "On Air"), and `displayName`
  // below carries the readable form for anywhere the extension itself is named.
  name: 'CruiseFMWidgets',
  displayName: 'Cruise FM Widgets',
  icon: '../../assets/images/icon.png',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.driftlore.CruiseFM'],
  },
  // The two faces the widgets draw with. DSEG is the app's own seven-segment
  // gauge font (already in assets/fonts, SIL OFL) and MaterialCommunityIcons
  // is the icon set every station picks its glyph from — the snapshot carries
  // the resolved CHARACTER, so the extension only needs the font, never the
  // name-to-codepoint table.
  fonts: [
    '../../assets/fonts/DSEG7Classic-Bold.ttf',
    '../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf',
  ],
};
