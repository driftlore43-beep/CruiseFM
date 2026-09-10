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
  /// The station's own three eqColors — the real hues the app's mirror ball
  /// reflects, distinct from `colors` above (the MUTED card ramp, the only
  /// station colour this target had before). Optional because it is a new
  /// field: a widget binary built before it existed keeps reading a snapshot
  /// this app already sends over the air, and just ignores the key it does
  /// not know.
  let eqColors: [String]?
  /// Only on lastDrive: which deck to reopen.
  let mode: String?
  /// Only on timeline entries: epoch MILLISECONDS this becomes current.
  let at: Double?
}

/**
 * NOTHING DRAWS THIS ANY MORE. The streak widget was deleted on 09.09 —
 * owner: "we don't need trackers, aren't Cruise FM's style" — and this is
 * kept ONLY so that the app can go on sending the field harmlessly.
 *
 * IT IS OPTIONAL, AND THAT IS THE WHOLE POINT OF LEAVING IT HERE. Swift's
 * decoder is all or nothing: one required property missing and the whole
 * snapshot decodes to nil, which blanks every widget at once with nothing
 * logged anywhere. The app updates OVER THE AIR and the extension does not,
 * so a binary already on a phone keeps reading whatever the newer app writes
 * — and build 44's copy of this struct declares `stats` as REQUIRED. Dropping
 * the field from the JSON today would empty that phone's Home Screen.
 *
 * So the order is: optional here first, ship a build, and only then may the
 * JS side stop sending it. Until that build is on real phones, leave
 * `stats` in widgetData.ts alone.
 */
struct WidgetStats: Codable {
  let streakDays: Int?
  let sessionsThisWeek: Int?
  let totalMinutes: Int?
  let countLabel: String?
  let timeLabel: String?
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
  let stats: WidgetStats?
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

/// The red, green and blue of a "#rrggbb", each 0-1. Anything unparseable
/// comes back as the app's own violet rather than nil, so a bad value still
/// draws something rather than nothing.
func rgbOf(_ hex: String) -> (Double, Double, Double) {
  let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
  var value: UInt64 = 0
  guard cleaned.count == 6, Scanner(string: cleaned).scanHexInt64(&value) else {
    return (0.482, 0.220, 0.878)
  }
  return (Double((value & 0xFF0000) >> 16) / 255,
          Double((value & 0x00FF00) >> 8) / 255,
          Double(value & 0x0000FF) / 255)
}

/// Relative luminance, the sRGB definition WCAG uses. This is what lets a
/// colour's readability be MEASURED rather than guessed at.
func srgbLuminance(_ c: (Double, Double, Double)) -> Double {
  func lin(_ x: Double) -> Double {
    x <= 0.03928 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(c.0) + 0.7152 * lin(c.1) + 0.0722 * lin(c.2)
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

  /// THE WINAMP'S TITLE BAR IS THE STATION'S OWN COLOUR, UNCHANGED (owner,
  /// 10.09: "the Winamp top banner still comes with this murkey-yellow top
  /// banner. We need to stop guessing and re[mo]ve the yellow colour").
  ///
  /// SHE WAS RIGHT AND THE YELLOW WAS OURS, not build lag. The previous
  /// version took the station's HUE only, replaced its brightness outright,
  /// floored saturation at 0.42, and then scaled the whole ramp down against
  /// the prototype gold's own luminance. Follow that through on her "Party"
  /// station, which is a CREAM: a cream's hue is around 45 degrees, so
  /// forcing it to 42% saturation at mid brightness produces a murky gold —
  /// arithmetically, every time. The bar was never showing the old fixed
  /// gold; it was manufacturing a new one, which is why no screenshot could
  /// tell the two builds apart.
  ///
  /// SO NOTHING IS INVENTED HERE ANY MORE. This is the app's own rule for a
  /// coloured control, settled on 01.09 for the shuffle and repeat pills and
  /// re-proved by measurement there: the FILL is the accent exactly as
  /// chosen, and the INK adapts to it. A colour that is never mixed with
  /// anything can never come out murky.
  ///
  /// What is left is a gentle ONE-WAY ramp — a title bar of that era runs
  /// dark at the hinge to light at the buttons — built by darkening and
  /// lightening the accent itself, so hue AND saturation survive intact.
  private var titleBarRGB: [(Double, Double, Double)] {
    let src = !accent.isEmpty ? accent : (colors.count > 1 ? colors[1] : "#7B38E0")
    let (r, g, b) = rgbOf(src)
    func scaled(_ f: Double) -> (Double, Double, Double) { (r * f, g * f, b * f) }
    func lifted(_ t: Double) -> (Double, Double, Double) {
      (r + (1 - r) * t, g + (1 - g) * t, b + (1 - b) * t)
    }
    return [scaled(0.82), scaled(0.94), lifted(0.12)]
  }

  /// The title bar itself: dark at the hinge, light at the buttons, the way
  /// every window of that era was drawn.
  var titleBarRamp: LinearGradient {
    LinearGradient(
      colors: titleBarRGB.map { Color(red: $0.0, green: $0.1, blue: $0.2) },
      startPoint: .leading, endPoint: .trailing)
  }

  /// The type ON that bar, chosen by MEASURED contrast rather than assumed to
  /// be white. This is the half that makes an honest fill safe: a cream
  /// station gets near-black lettering and a navy one gets white, so the
  /// station keeps its own colour and the name stays readable on all of them.
  ///
  /// Judged against the ramp's MIDDLE stop, which is where the text sits.
  var titleBarInk: Color {
    let mid = titleBarRGB[1]
    let lum = srgbLuminance(mid)
    let onWhite = 1.05 / (lum + 0.05)
    // #0d0f14, the app's own near-black, at relative luminance 0.00522.
    let onDark = (lum + 0.05) / (0.00522 + 0.05)
    return onDark > onWhite ? Color(red: 0.051, green: 0.059, blue: 0.078) : .white
  }

  /// Where tapping this station goes. The app's /drive route resolves and
  /// falls back, so a stale link (a station deleted since this was drawn)
  /// still lands in a real drive rather than a dead end.
  /// `kind` says whether the tap means a DRIVE or a desk listen. Only the
  /// Start Drive tile sends one — it is the widget whose whole name is the
  /// answer to that question (owner, 09.09: "since it's for a start drive …
  /// it should be in driving mode when this widget is selected"). Every other
  /// widget leaves it off and the app keeps whatever the listener last chose,
  /// which is right: a tap on the Deck is not a claim about where they are.
  func url(mode: String?, kind: String? = nil) -> URL? {
    var s = "cruisefm://drive?station=\(id)"
    if let mode { s += "&mode=\(mode)" }
    if let kind { s += "&kind=\(kind)" }
    return URL(string: s)
  }
}

/**
 * WHY EVERY ONE OF THESE IS `fixedSize:` AND NOT `size:`
 *
 * `Font.custom(_:size:)` SCALES WITH THE READER'S TEXT-SIZE SETTING. That is
 * the right default for body copy in an app and completely wrong here: a
 * widget is a fixed rectangle drawn to a hand-measured layout, and there is
 * no scroll view to absorb the extra. `.system(size:)` does NOT scale, so
 * these four helpers were the only text in the target that grew — which is
 * why layouts came apart in a way that looked arbitrary rather than uniform.
 *
 * MEASURED ON THE OWNER'S OWN SCREENSHOTS 08.09: the ticket's seven-segment
 * digits ran about 38% wider, relative to the widget, than the prototype they
 * were drawn from. At that scale "Artist:" (38.5pt of glyph at 11pt, in a
 * 40pt column) overflows and iOS truncates the LABEL — the "Arti···" she
 * photographed — and the Player's song and artist lose most of their
 * characters. Neither is a layout mistake; both are one line of API.
 *
 * So: any face asked for by name in this target goes through these helpers,
 * and these helpers always ask for a fixed size.
 */

/// The seven-segment face the app sets every dial number in.
func dialFont(_ size: CGFloat) -> Font { .custom("DSEG7Classic-Bold", fixedSize: size) }

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
func bandFont(_ size: CGFloat) -> Font { .custom("DSEG14Classic-Bold", fixedSize: size) }

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
  /// Pull the digits left so their INK starts at this view's leading edge.
  /// Only wanted when the dial sits directly above or below other type that
  /// has to line up with it — see `dseg7InkInset`.
  var alignInk: Bool = false

  var body: some View {
    let d = splitDial(dial)
    HStack(alignment: .firstTextBaseline, spacing: size * 0.28) {
      Text(d.number).font(dialFont(size)).foregroundColor(color)
      if !d.band.isEmpty {
        Text(d.band).font(bandFont(size * 0.56)).foregroundColor(color.opacity(0.82))
      }
    }
    .padding(.leading, alignInk ? -dseg7InkInset(d.number, size: size) : 0)
  }
}

/// HOW FAR A SEVEN-SEGMENT NUMBER'S INK SITS FROM ITS OWN TEXT ORIGIN.
///
/// Owner, 09.09: "the station's number and the name aligned, it currently
/// looks staggered." It was, and the cause is the font rather than the
/// layout — every glyph in that column really does start at the same x.
///
/// A seven-segment glyph is drawn where its segments are, and its box is
/// sized for a full '8'. MEASURED off DSEG7's own hmtx: every digit carries a
/// **0.099 em** left side bearing except **'1', which carries 0.593 em**,
/// because a seven-segment one is only the two right-hand bars.
///
/// So the indent CHANGED FROM STATION TO STATION, which is exactly what
/// "staggered" describes: at 15pt a dial reading 1240 sat 8.9pt in from the
/// name beneath it and one reading 810 sat 1.5pt in. Shifting the number left
/// by its own first glyph's bearing puts the ink where the eye expects it.
func dseg7InkInset(_ number: String, size: CGFloat) -> CGFloat {
  size * (number.first == "1" ? 0.593 : 0.099)
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
func iconFont(_ size: CGFloat) -> Font { .custom("MaterialDesignIcons", fixedSize: size) }

/**
 * The pixel face, for the CD Player look.
 *
 * ASK FOR THE POSTSCRIPT NAME, NEVER THE FILENAME. This is the trap that cost
 * build 39's icons: Swift asked for "MaterialCommunityIcons", the file's own
 * name table says "MaterialDesignIcons", SwiftUI matched nothing, and iOS
 * quietly substituted the system font — no error, no log, just missing
 * glyphs. Read from the ttf here rather than assumed: DotGothic16-Latin.ttf
 * declares postscript name `DotGothic16-Regular`.
 *
 * Subset to Latin (1.6 MB -> 37 KB); the licence travels with it in
 * DotGothic16-OFL.txt, as the OFL requires.
 */
func pixelFont(_ size: CGFloat) -> Font { .custom("DotGothic16-Regular", fixedSize: size) }

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
