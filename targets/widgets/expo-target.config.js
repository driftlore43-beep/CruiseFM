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
  // NO `fonts` KEY HERE, and that is not an oversight. @bacons/apple-targets
  // does not read one — it reads icon, images, colors, entitlements,
  // frameworks, name, displayName and a few more, and silently ignores
  // anything else. A `fonts: [...]` array sat here from 21.08 until 01.09
  // doing nothing at all, which is why the first widget build drew its dial
  // in a plain system face and every station icon as a missing-glyph box.
  //
  // Fonts reach the extension the way any other resource does: the ttf files
  // live in THIS FOLDER, so the target's file-system-synchronized group picks
  // them up as bundle resources, and Info.plist beside them declares them in
  // UIAppFonts. That Info.plist is committed deliberately — the plugin writes
  // one only when none exists, so ours is respected rather than overwritten.
};
