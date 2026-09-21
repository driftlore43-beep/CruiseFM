import AppIntents
import SwiftUI
import WidgetKit

/**
 * WIDGET 1 — START DRIVE.
 *
 * The last station driven, one tap back into it. Deliberately the simplest
 * thing here: it never changes on its own, so it costs iOS nothing, and it is
 * the one widget whose whole value is that it is already showing the answer
 * before you ask.
 *
 * Its timeline is a SINGLE entry with no refresh date. There is nothing to
 * count down to — the content only changes when the app writes a new snapshot
 * after a drive, and that already asks WidgetKit to reload. Asking for
 * periodic refreshes we have no use for would spend a budget the On Air
 * widget genuinely needs.
 */
struct StartDriveEntry: TimelineEntry {
  let date: Date
  let station: WidgetStation?
  let ready: Bool
}

struct StartDriveProvider: TimelineProvider {
  func placeholder(in context: Context) -> StartDriveEntry {
    // A REAL ENTRY, NOT AN EMPTY ONE.
    //
    // WidgetKit draws `placeholder` REDACTED — every piece of text becomes a
    // grey capsule — so a placeholder built from nothing renders as a blank
    // grey tile, which is precisely what the owner reports on an iPad (14.09)
    // and could not find a cause for. A tile stuck on its placeholder and a
    // tile that failed outright look identical from the outside.
    //
    // Reading the snapshot here costs one synchronous read of shared
    // UserDefaults, which the timeline does anyway, and it makes the two
    // cases tell themselves apart: a widget stuck on its placeholder now
    // shows real content, so if a grey tile fills in, the drawing was never
    // the problem — it never received a timeline.
    startDriveEntry()
  }

  func getSnapshot(in context: Context, completion: @escaping (StartDriveEntry) -> Void) {
    completion(startDriveEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StartDriveEntry>) -> Void) {
    completion(Timeline(entries: [startDriveEntry()], policy: .never))
  }
}

// A FREE FUNCTION RATHER THAN THE PROVIDER'S OWN METHOD, so the configurable
// provider below shares it and the two cannot drift into showing different
// things. The pinned station arrives as a bare id, not a StationEntity: the
// entity is iOS 17 only and this is also the older phones' path.
func startDriveEntry(pinned: String? = nil) -> StartDriveEntry {
  guard let snap = SnapshotStore.load() else {
    return StartDriveEntry(date: Date(), station: nil, ready: false)
  }
  // Pinned, else the last drive, else whatever is on air — so a first-time
  // driver gets a real suggestion instead of a dead square.
  return StartDriveEntry(date: Date(), station: snap.station(pinned: pinned), ready: true)
}

/**
 * The station this tile starts, and nothing else.
 *
 * NO LOOK SETTING HERE, deliberately: Start Drive has one design, and a
 * configuration with a single parameter reads as "choose a station" rather
 * than as a menu. The other three configurable widgets carry a Look as well,
 * so this is the only intent in the target with one parameter.
 */
@available(iOSApplicationExtension 17.0, *)
struct StartDriveStationIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Start Drive"
  static var description = IntentDescription("Choose which station this tile starts.")

  /// Nil (and the sentinel's empty id) mean "my last station", which is what
  /// this widget did before pinning existed — so a tile already on someone's
  /// Home Screen keeps behaving exactly as it did. See StationPick.swift.
  @Parameter(title: "Station")
  var station: StationEntity?

  init() {}
}

@available(iOSApplicationExtension 17.0, *)
struct StartDriveIntentProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> StartDriveEntry {
    // A REAL ENTRY, NOT AN EMPTY ONE — WidgetKit draws `placeholder` redacted,
    // so one built from nothing is a blank grey tile, which is what a widget
    // that never received a timeline also looks like. See StartDriveProvider.
    startDriveEntry()
  }
  func snapshot(for configuration: StartDriveStationIntent, in context: Context) async -> StartDriveEntry {
    startDriveEntry(pinned: configuration.station?.id)
  }
  func timeline(for configuration: StartDriveStationIntent, in context: Context) async -> Timeline<StartDriveEntry> {
    Timeline(entries: [startDriveEntry(pinned: configuration.station?.id)], policy: .never)
  }
}

struct StartDriveView: View {
  var entry: StartDriveEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      ZStack(alignment: .topLeading) {
        // THE GROUND IS ALWAYS DARK, and the station tints it rather than
        // being it. `s.gradient` is the station's own card ramp, which for the
        // ten built-ins is dark and for a CUSTOM station is whatever colour
        // its owner picked — so a pale one (the owner's "Party" is a cream)
        // put the accent-coloured eyebrow and the 62%-white station line on a
        // near-white ground, where both simply disappeared. She photographed
        // the result and read it as two missing lines; they were rendering
        // the whole time.
        //
        // This is the app's own `readableOn` rule (14.08) in widget form: a
        // colour arriving from outside the palette may tint a surface, but it
        // may never decide whether the type on it can be read. The prototype
        // draws this card on near-black for exactly that reason.
        Color(hex: "#0d0f14")
        s.gradient.opacity(0.55)
        // THE STATION'S OWN PHOTOGRAPH, when this target bundles one — the
        // ten built-ins do, a custom station does not and keeps the gradient
        // above. Already blurred in the asset, exactly as the app's decks
        // draw it; re-blurring at runtime is what got the app killed once.
        if family == .systemSmall {
          if let img = Art.station(s.image) {
            img.cruiseBackdrop()
          }
          // THE SAME RAMP THE ON AIR TILE USES, and for the same reason: the
          // type on this tile sits in two places, an eyebrow at the crown and
          // the dial and the station's name at the foot, with nothing but
          // picture between them. A FLAT 0.42 wash — which is what this was,
          // under a lightening sheen at the top-left — dimmed the photograph
          // everywhere and still left "START DRIVE" at 2.56:1 on Daylight.
          // Measured after, worst of the ten: eyebrow 4.51, dial 5.37 (its
          // ink went 0.55 -> 0.72 to get there), name 9.32.
          StationScrim()
          VStack(alignment: .leading, spacing: 0) {
            // THE CAR OFF THE SEEK BAR (owner, 09.09: "since it's for a start
            // drive, the car icon — the same one that sits on our scrub —
            // should be there"). `car-convertible`, the glyph `SeekCar` draws,
            // so the tile and the bar are the same little car rather than two
            // that merely rhyme. It is already in the subset the extension
            // ships, because the create sheet offers it as a station icon;
            // test-widget-fonts pins that, since a codepoint with no glyph
            // draws a hollow box and nothing anywhere logs it.
            HStack(alignment: .top) {
              Text(CAR_GLYPH).font(iconFont(22)).foregroundColor(.white)
              Spacer()
              if let ch = s.iconChar, !ch.isEmpty {
                Text(ch).font(iconFont(15)).foregroundColor(.white.opacity(0.62))
              }
            }
            Spacer(minLength: 2)
            // BIG, because it is what the tile is for ("make the start drive
            // big also"). It was 9pt letterspaced small caps in the corner —
            // a label on a photograph rather than an invitation. Two lines,
            // so it can be large and still clear a narrow tile.
            Text(s.mode == nil ? "TUNE\nIN" : "START\nDRIVE")
              .font(.system(size: 24, weight: .heavy))
              .foregroundColor(.white)
              .lineSpacing(-1)
              .shadow(color: .black.opacity(0.55), radius: 6)
              .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 4)
            // `alignInk` is what stops these two reading as staggered: a
            // seven-segment '1' is only the right-hand bars, so an unshifted
            // 1240 sat visibly further in than the name beneath it while an
            // 810 did not. See dseg7InkInset.
            DialText(dial: s.dial, size: 13, color: .white.opacity(0.74), alignInk: true)
            Text(s.name).font(.system(size: 13, weight: .bold))
              .foregroundColor(.white).lineLimit(1).minimumScaleFactor(0.7)
          }
          .padding(13)
        } else {
          // THE MEDIUM IS AN INVITATION, not a label. This is the widget
          // someone taps to get going, so it asks rather than announces.
          //
          // THE PICTURE RUNS THE WHOLE CARD NOW, AND THE TYPE SITS IN A
          // SHADOW ON IT (owner, 09.09: "remove that grey box on the left and
          // replace it with a black gradient or vignette"). It used to be a
          // 168pt photo panel butted against a flat slab, and the slab was
          // the station's own ramp over near-black — which on a muted station
          // is precisely a grey box, with a hard vertical seam where the two
          // met. A boxed-off scrim is a rectangle; a scrim that fades to
          // nothing has no edge to see, which is the rule this target already
          // follows everywhere else.
          ZStack {
            if let img = Art.station(s.image) {
              img.cruiseBackdrop()
            } else {
              // No photograph — a custom station. Its own colours, on the
              // dark ground rather than as the ground, because a pale one
              // must never decide whether the words on it can be read.
              Color(hex: "#0d0f14")
              s.gradient.opacity(0.55)
            }

            // THE SHADOW THE TYPE STANDS IN. Opaque at the left edge, gone by
            // the right, so the picture emerges under the play button and the
            // words never have to compete with it.
            LinearGradient(stops: [
              .init(color: Color(hex: "#07080c"), location: 0),
              .init(color: Color(hex: "#07080c").opacity(0.90), location: 0.42),
              .init(color: Color(hex: "#07080c").opacity(0.46), location: 0.72),
              .init(color: Color(hex: "#07080c").opacity(0.10), location: 1),
            ], startPoint: .leading, endPoint: .trailing)

            // A VIGNETTE, so the photograph is framed rather than cropped —
            // it is what stops a bright sky running flat into the tile's own
            // rounded edge. Both bands fade to nothing inward.
            VStack(spacing: 0) {
              LinearGradient(colors: [.black.opacity(0.30), .clear],
                             startPoint: .top, endPoint: .bottom)
                .frame(height: 30)
              Spacer(minLength: 0)
              LinearGradient(colors: [.clear, .black.opacity(0.38)],
                             startPoint: .top, endPoint: .bottom)
                .frame(height: 34)
            }

            HStack(spacing: 8) {
              VStack(alignment: .leading, spacing: 0) {
                Text(s.mode == nil ? "TUNE IN" : "PICK UP WHERE YOU LEFT OFF")
                  .font(.system(size: 9, weight: .heavy)).tracking(1.5)
                  .foregroundColor(s.accentColor)
                  .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 6)
                Text("Let\u{2019}s put\nsomething on.")
                  .font(.system(size: 23, weight: .heavy))
                  .foregroundColor(.white)
                  .lineSpacing(1)
                  .shadow(color: .black.opacity(0.55), radius: 6)
                  .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 6)
                Text(s.mode == nil ? s.name : "\(s.name) · \(modeLabel(s.mode))")
                  .font(.system(size: 12, weight: .medium))
                  .foregroundColor(.white.opacity(0.80)).lineLimit(1)
                  .shadow(color: .black.opacity(0.55), radius: 5)
              }
              Spacer(minLength: 0)
              Circle().fill(.white)
                .frame(width: 46, height: 46)
                .overlay(Triangle().fill(Color(hex: "#111")).frame(width: 15, height: 18).offset(x: 2))
                .shadow(color: .black.opacity(0.5), radius: 8, y: 3)
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 16)
          }
        }
      }
      // A TAP HERE MEANS A DRIVE, so it says so. The app asks once whether
      // someone is heading anywhere and remembers the answer, which decides
      // what it COUNTS and what it CALLS things — and this is the one widget
      // whose entire name answers that question, so leaving the app to guess
      // would be the app guessing when it had been told.
      .widgetURL(s.url(mode: s.mode, kind: "driving"))
    }
  }
}

/// `car-convertible` in MaterialCommunityIcons — the same glyph the seek
/// bar's little car is drawn from. Written as a codepoint because the
/// extension has no glyph-name table (the app resolves names and the
/// snapshot carries the character), and pinned in test-widget-fonts so a
/// renumbered glyph fails a check rather than drawing a hollow box.
let CAR_GLYPH = "\u{F07A7}"

/// The mode's own name, for the invitation line. The snapshot carries the id
/// the app stores (`disco`, not "Mirror Ball"), and printing an id at someone
/// is the kind of thing that reads as a bug rather than a feature.
private func modeLabel(_ id: String?) -> String {
  switch id {
  case "vinyl":    return "Vinyl"
  case "cassette": return "Cassette"
  case "cd":       return "CD"
  case "disco":    return "Mirror Ball"
  case "radio":    return "Tuner"
  case "horizon":  return "Horizon"
  case "orb":      return "Circular EQ"
  case "equalizer": return "Equalizer"
  default:         return "your last mode"
  }
}

// ── the two configurations ─────────────────────────────────────────────────
//
// SAME `kind` ON BOTH, and it is load-bearing for the same reason it is on
// the Deck: "CruiseStartDrive" has been on Home Screens since build 39, and a
// changed kind makes a widget already sitting on one vanish. Only ever one of
// the pair is registered — see CruiseWidgetBundle.

@available(iOSApplicationExtension 17.0, *)
struct StartDriveConfigurableWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "CruiseStartDrive", intent: StartDriveStationIntent.self,
                           provider: StartDriveIntentProvider()) { entry in
      StartDriveView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("Start Drive")
    .description("Your last station, one tap away. Long-press to pin it to a station.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .cruiseFullBleed()
  }
}

struct StartDriveWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseStartDrive", provider: StartDriveProvider()) { entry in
      StartDriveView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("Start Drive")
    .description("Your last station, one tap away.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .cruiseFullBleed()
  }
}
