import SwiftUI
import WidgetKit

/**
 * WHAT THE WIDGETS READ, and the one rule this whole folder follows:
 * NOTHING IS DECIDED HERE.
 *
 * Which station is on air, what the dial says, how a desk listener's sessions
 * are counted and worded — all of it is worked out in JS
 * (src/utils/widgetData.ts) where the app's own screens use the same code and
 * scripts/test-widget-data.mjs checks it against the real broadcast schedule.
 * The extension's job is to draw what it is given. A second copy of any of
 * that logic in Swift is how a widget starts disagreeing with the app, and a
 * widget is read at a glance and believed.
 *
 * These structs mirror the TypeScript types exactly. If a field is added
 * there, add it here as an OPTIONAL — a widget binary in the wild will
 * happily be handed a newer snapshot by an app that updated over the air, and
 * a required field it has never heard of would make the whole decode fail and
 * blank every widget at once. `version` exists for the same reason: a shape
 * change big enough to break drawing bumps it, and the widget declines
 * rather than misdraws.
 */
struct LastPlayedInfo: Codable {
  let title: String
  let artist: String
}

struct WidgetStation: Codable {
  let id: String
  let name: String
  let tagline: String
  /// "92.1 FM" — set in DSEG, the app's own gauge face.
  let dial: String
  /// The glyph NAME, sent for reference and debugging. Nothing draws it —
  /// a font needs a character — but it is declared so the Swift and the
  /// TypeScript stay a matched pair; an undeclared field arriving is
  /// indistinguishable from a rename half-done.
  let icon: String?
  /// Already the character, not the glyph name (see glyphChar in widgetData).
  let iconChar: String?
  /// The station id, when this target bundles a backdrop for it (see
  /// Art.station). Nil for a custom station, which has no bundled image.
  let image: String?
  /// Deep, mid, black — the station's own card ramp.
  let colors: [String]
  let accent: String
  /// Only on lastDrive: which deck to reopen.
  let mode: String?
  /// Only on timeline entries: epoch MILLISECONDS this becomes current.
  let at: Double?
}

struct WidgetStats: Codable {
  let streakDays: Int
  let sessionsThisWeek: Int
  let totalMinutes: Int
  /// "DRIVES" or "SESSIONS" — decided in JS so a desk listener is never told
  /// they drove (the app's standing wording rule).
  let countLabel: String
  let timeLabel: String
}

struct Snapshot: Codable {
  let version: Int
  let updatedAt: Double
  let lastDrive: WidgetStation?
  let onAir: [WidgetStation]
  let upNextLine: String?
  /// The last song the app saw play — NOT what is playing now. A widget is
  /// redrawn a handful of times a day, so "now playing" would be wrong most
  /// of the time anyone reads it; "last played" is a claim about the past and
  /// stays true however stale this gets. Any view drawing it must say so.
  let lastPlayed: LastPlayedInfo?
  let stats: WidgetStats
}

/// The newest shape this binary knows how to draw.
private let supportedVersion = 1

enum SnapshotStore {
  /// Must match modules/cruise-widgets, app.json, and the Apple app ID.
  static let appGroup = "group.com.driftlore.CruiseFM"
  static let key = "cruisefm.widget.snapshot"

  /**
   * The current snapshot, or nil when there isn't one to draw.
   *
   * Nil is a NORMAL state, not an error: a phone that has installed the app
   * but never opened it has nothing written yet, and every widget here has a
   * placeholder for exactly that. Returning nil rather than inventing data is
   * the point — a widget showing a plausible station nobody chose is worse
   * than one saying "open Cruise FM".
   */
  static func load() -> Snapshot? {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let json = defaults.string(forKey: key),
      let data = json.data(using: .utf8),
      let snap = try? JSONDecoder().decode(Snapshot.self, from: data),
      snap.version <= supportedVersion
    else { return nil }
    return snap
  }
}

// MARK: - Drawing helpers

extension Color {
  /// "#0d5f70" as a Color. Anything unparseable comes back as the app's own
  /// near-black rather than a default blue, so a bad value degrades to the
  /// house background instead of announcing itself.
  init(hex: String) {
    let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var value: UInt64 = 0
    guard cleaned.count == 6, Scanner(string: cleaned).scanHexInt64(&value) else {
      self = Color(red: 0.04, green: 0.04, blue: 0.06)
      return
    }
    self.init(
      red: Double((value & 0xFF0000) >> 16) / 255,
      green: Double((value & 0x00FF00) >> 8) / 255,
      blue: Double(value & 0x0000FF) / 255
    )
  }
}

extension WidgetStation {
  /// The accent slot every mode wears — eqColors[1] in the app, sent already
  /// resolved so a widget can never pick a different one from the screen it
  /// links into. Falls back to the ramp's mid stop, then to the app's violet.
  var accentColor: Color {
    if !accent.isEmpty { return Color(hex: accent) }
    if colors.count > 1 { return Color(hex: colors[1]) }
    return Color(hex: "#7B38E0")
  }

  /// The station's own ramp, corner to corner — the same diagonal the app's
  /// cards use, so a widget sits beside the app rather than beside iOS.
  var gradient: LinearGradient {
    let stops = colors.isEmpty ? ["#0a0a10", "#181c28", "#000000"] : colors
    return LinearGradient(
      colors: stops.map { Color(hex: $0) },
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }

  /// Where tapping this station goes. The app's /drive route resolves and
  /// falls back, so a stale link (a station deleted since this was drawn)
  /// still lands in a real drive rather than a dead end.
  func url(mode: String?) -> URL? {
    var s = "cruisefm://drive?station=\(id)"
    if let mode { s += "&mode=\(mode)" }
    return URL(string: s)
  }
}

/// The seven-segment face the app sets every dial number in.
func dialFont(_ size: CGFloat) -> Font { .custom("DSEG7Classic-Bold", size: size) }

/**
 * The band letters — AM, FM — in the FOURTEEN-segment face.
 *
 * SEVEN SEGMENTS CAN ONLY APPROXIMATE A LETTER, and the approximation for M
 * reads as N. DSEG7 does have A, M and F glyphs — checked, they are distinct
 * outlines, not substitutions — but seven bars have no diagonals and no
 * vertical centre, so its M is the closest a calculator display can get. The
 * app hit this on 31.07 with a whole "94.7 FM" set in DSEG7 coming out as
 * "94.7 FN", and fixed it by moving the band to DSEG14, which has fourteen
 * segments and therefore real letterforms. Every widget was still setting the
 * whole of `snapshot.dial` ("810 AM") in DSEG7 until 03.09.
 *
 * So numbers go through `dialFont` and letters through this one, always.
 */
func bandFont(_ size: CGFloat) -> Font { .custom("DSEG14Classic-Bold", size: size) }

/**
 * "810 AM" split into the part a seven-segment display can show and the part
 * it cannot. Done here rather than by adding two more snapshot fields, so a
 * phone still running an older build's snapshot gets the fix too.
 */
func splitDial(_ dial: String) -> (number: String, band: String) {
  let parts = dial.split(separator: " ", maxSplits: 1).map(String.init)
  guard parts.count == 2 else { return (dial, "") }
  return (parts[0], parts[1])
}

/// Number and band set side by side in their own faces, which is the only way
/// this reads as one display rather than two fonts that happen to be adjacent.
struct DialText: View {
  let dial: String
  var size: CGFloat = 15
  var color: Color = .white
  var body: some View {
    let d = splitDial(dial)
    HStack(alignment: .firstTextBaseline, spacing: size * 0.28) {
      Text(d.number).font(dialFont(size)).foregroundColor(color)
      if !d.band.isEmpty {
        Text(d.band).font(bandFont(size * 0.56)).foregroundColor(color.opacity(0.82))
      }
    }
  }
}
/// The icon set every station picks its glyph from.
///
/// "MaterialDesignIcons" IS THE FONT'S POSTSCRIPT NAME, and it is not the
/// filename — SwiftUI's `.custom` wants the former. Asking for
/// "MaterialCommunityIcons" (which is what the file is called) silently falls
/// back to the system font, and a private-use codepoint has no glyph there, so
/// every station icon rendered as the missing-glyph box. Read it out of the
/// ttf's own name table rather than assuming; `scripts/test-widget-fonts.mjs`
/// pins both names so a future font swap cannot quietly break this again.
func iconFont(_ size: CGFloat) -> Font { .custom("MaterialDesignIcons", size: size) }

/// Shown when there is no snapshot yet — an honest empty state rather than a
/// made-up station. Deliberately says what to do about it.
struct NotReadyView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("CRUISE FM")
        .font(.system(size: 10, weight: .heavy)).tracking(2)
        .foregroundColor(.white.opacity(0.5))
      Text("Open the app to get started")
        .font(.system(size: 13, weight: .semibold))
        .foregroundColor(.white.opacity(0.85))
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .background(LinearGradient(colors: [Color(hex: "#0a0a10"), Color(hex: "#181c28")],
                               startPoint: .topLeading, endPoint: .bottomTrailing))
  }
}
