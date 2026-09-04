import SwiftUI
import WidgetKit

/**
 * THE DECK — the station as an object, with the last song on its label.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────────
 *
 * IT DOES NOT SPIN. iOS redraws a widget a handful of times a day, and the
 * only thing allowed to animate on its own is countdown-style text. That is
 * true of every app on the platform, not just this one. A record that moved
 * only when you were not looking would be a lie told in motion, so this is
 * drawn as a still deck — which is what a turntable looks like at a glance.
 *
 * IT DOES NOT SAY "NOW PLAYING". It cannot know: by the time anyone reads
 * this, the song has usually changed. What it says is LAST PLAYED, which is a
 * claim about the past and therefore still true however stale the widget gets.
 * That single word is what makes showing a cover honest at all — the owner's
 * own idea (01.09), and the thing to protect if this is ever redesigned.
 *
 * ── THREE LOOKS, ONE WIDGET ──────────────────────────────────────────────
 *
 * Long-press → Edit Widget picks between them; see DeckLook.swift for why it
 * is a setting rather than three entries in the gallery. The looks differ in
 * WHERE the record sits, never in what it claims:
 *
 *   road   the record over the station's own photograph
 *   label  the pressing itself, song printed beside it on paper
 *   set    the record next to a lit receiver window
 *
 * The distinction being drawn is against a record-collection app: those put a
 * record on a clean studio table. This one belongs to a radio, so it sits on
 * the road, or on the set, or is printed like a station's own pressing.
 */

/// The look, in a form every iOS version can compile. `DeckLook` is the
/// user-facing setting and is iOS 17+; this is what the views actually take,
/// so the drawing is shared rather than duplicated behind an availability gate.
enum DeckStyle { case road, label }

private let cream = Color(red: 0.945, green: 0.929, blue: 0.890)
private let creamDeep = Color(red: 0.878, green: 0.863, blue: 0.812)
private let ink = Color(red: 0.106, green: 0.122, blue: 0.153)

struct DeckEntry: TimelineEntry {
  let date: Date
  let station: WidgetStation?
  let lastPlayed: LastPlayedInfo?
  let ready: Bool
  let style: DeckStyle
}

/// Shared by both providers, so the two cannot drift into showing different
/// things — only the look differs between them.
private func deckEntry(_ style: DeckStyle) -> DeckEntry {
  guard let snap = SnapshotStore.load() else {
    return DeckEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: style)
  }
  // Never driven? Show whatever is on air, so a first-time listener gets a
  // real record rather than an empty square.
  let station = snap.lastDrive ?? snap.onAir.first
  return DeckEntry(date: Date(), station: station, lastPlayed: snap.lastPlayed,
                   ready: true, style: style)
}

/// ONE ENTRY, AND A REFRESH IN AN HOUR. Unlike the On Air widget this does not
/// walk the broadcast day: the record shows the station you last drove, which
/// only changes when you drive again — and the app republishes the snapshot
/// every time it is backgrounded, a far better signal than any schedule
/// guessed at here.
private func deckTimeline(_ style: DeckStyle) -> Timeline<DeckEntry> {
  Timeline(entries: [deckEntry(style)], policy: .after(Date().addingTimeInterval(60 * 60)))
}

// ── iOS 16 and older: no setting, the default look ─────────────────────────

struct DeckProvider: TimelineProvider {
  func placeholder(in context: Context) -> DeckEntry {
    DeckEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .road)
  }
  func getSnapshot(in context: Context, completion: @escaping (DeckEntry) -> Void) {
    completion(deckEntry(.road))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<DeckEntry>) -> Void) {
    completion(deckTimeline(.road))
  }
}

// ── iOS 17+: the look comes from the widget's own configuration ────────────

@available(iOSApplicationExtension 17.0, *)
struct DeckIntentProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> DeckEntry {
    DeckEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .road)
  }
  func snapshot(for configuration: DeckLookIntent, in context: Context) async -> DeckEntry {
    deckEntry(style(configuration.look))
  }
  func timeline(for configuration: DeckLookIntent, in context: Context) async -> Timeline<DeckEntry> {
    deckTimeline(style(configuration.look))
  }
  private func style(_ look: DeckLook) -> DeckStyle {
    switch look {
    case .road: return .road
    case .label: return .label
    }
  }
}

// ── the drawing ────────────────────────────────────────────────────────────

struct DeckView: View {
  var entry: DeckEntry
  @Environment(\.widgetFamily) var family

  private var isSmall: Bool { family == .systemSmall }

  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      switch entry.style {
      case .road:  road(s)
      case .label: label(s)
      }
    }
  }

  // ── ON THE ROAD ─────────────────────────────────────────────────────────
  // The record over the station's own place. A record-collection app puts the
  // pressing on a clean table; the whole point of this one is which drive it
  // belongs to, so the picture underneath is the subject as much as the disc.
  private func road(_ s: WidgetStation) -> some View {
    ZStack {
      s.gradient
      if let img = Art.station(s.image) {
        img.resizable().aspectRatio(contentMode: .fill).clipped()
      }
      // Shading gathered where the words are and opened where the picture is
      // — the rule the app's own decks were rebuilt around on 02.09. A flat
      // wash over everything is what buried the photograph in the first place.
      LinearGradient(
        colors: [.black.opacity(0.90), .black.opacity(0.62), .black.opacity(0.34)],
        startPoint: .leading, endPoint: .trailing)

      if isSmall {
        smallStack(s, ink: .white)
      } else {
        HStack(spacing: 0) {
          VStack(alignment: .leading, spacing: 0) {
            Text("ON THE DECK").font(.system(size: 8, weight: .heavy)).tracking(1.8)
              .foregroundColor(s.accentColor)
            Text(s.name).font(.system(size: 20, weight: .bold))
              .foregroundColor(.white).lineLimit(1).padding(.top, 4)
            DialText(dial: s.dial, size: 12, color: s.accentColor).padding(.top, 3)
            Spacer(minLength: 6)
            lastPlayed(ink: .white)
          }
          Spacer(minLength: 8)
          // THE ONE THAT DOES NOT FALL BACK TO THE STATION PHOTO. It is
          // already the backdrop here, so using it on the label too would
          // print the same picture twice at two sizes. No cover means the
          // printed pressing instead — the station's own label.
          Group {
            if let art = Art.lastPlayed() {
              RecordView(accent: s.accentColor, label: art, size: 118)
            } else {
              pressing(s, size: 118, compact: true)
            }
          }
          .padding(.trailing, 2)
        }
        .padding(15)
      }
    }
  }

  // ── THE LABEL ───────────────────────────────────────────────────────────
  // The pressing itself. The record runs off the edge so the label becomes
  // the thing you read, printed with the station and its frequency the way a
  // real one carries its own catalogue detail.
  private func label(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [cream, creamDeep], startPoint: .topLeading, endPoint: .bottomTrailing)

      // BOTH LOOKS SHARE ONE SMALL TILE. It is the same object either way —
      // the pressing, its frequency, its name — and the only thing the look
      // decides at this size is what it is sitting on. Two copies of it is
      // how the two drifted apart the first time.
      if isSmall {
        smallStack(s, ink: ink)
      } else {
        HStack(spacing: 0) {
          // Off the left edge on purpose: a pressing that fits inside the card
          // reads as a picture OF a record, not as one sitting there.
          pressing(s, size: 232).offset(x: -58)
          Spacer(minLength: 0)
          VStack(alignment: .trailing, spacing: 2) {
            Text("NOW ON THE DECK").font(.system(size: 7.5, weight: .heavy)).tracking(1.6)
              .foregroundColor(ink.opacity(0.48))
            if let lp = entry.lastPlayed {
              Text(lp.title).font(.system(size: 19, weight: .heavy))
                .foregroundColor(ink).lineLimit(1).minimumScaleFactor(0.7)
              Text(lp.artist).font(.system(size: 12)).foregroundColor(ink.opacity(0.60)).lineLimit(1)
            } else {
              Text(s.name).font(.system(size: 19, weight: .heavy)).foregroundColor(ink).lineLimit(1)
            }
            Spacer(minLength: 4)
            Text(s.tagline).font(.system(size: 10))
              .foregroundColor(ink.opacity(0.46)).lineLimit(1)
          }
          .frame(width: 168, alignment: .trailing)
          .padding(.vertical, 16).padding(.trailing, 15)
        }
      }
    }
  }

  /// A record whose label is printed rather than photographic — the station's
  /// own pressing. Used only by the Label look; the other two want the cover.
  private func pressing(_ s: WidgetStation, size: CGFloat, compact: Bool = false) -> some View {
    ZStack {
      RecordView(accent: s.accentColor, label: nil, size: size, plainLabel: true)
      // WHAT FITS ON A LABEL IS A FUNCTION OF THE LABEL, not of the design.
      // The disc's label is 42% of it, so at 92pt there is 38pt of room —
      // "CRUISE FM" would set at under 4pt there, which is a grey smear
      // rather than small type. The compact label carries the frequency
      // alone, which is what the owner asked to see in the middle anyway,
      // and the station's name goes underneath the record where it is
      // legible.
      if compact {
        DialText(dial: s.dial, size: size * 0.105, color: s.accentColor)
      } else {
        VStack(spacing: size * 0.018) {
          Text("CRUISE FM").font(.system(size: size * 0.042, weight: .heavy))
            .tracking(size * 0.012).foregroundColor(.white.opacity(0.72))
          Text(s.name).font(.system(size: size * 0.082, weight: .bold))
            .foregroundColor(.white).lineLimit(1)
          Circle().fill(.white.opacity(0.5)).frame(width: size * 0.03, height: size * 0.03)
          DialText(dial: s.dial, size: size * 0.058, color: s.accentColor)
        }
        .frame(width: size * 0.40)
      }
    }
  }


  // ── shared pieces ───────────────────────────────────────────────────────

  /// THE SMALL TILE IS THE STATION'S OWN PRESSING (owner, 03.09: "increase the
  /// size of the vinyl and put the station number in the centre of the vinyl,
  /// and the name on the bottom. Remove the song name.")
  ///
  /// THE SONG COMING OFF IS WHAT MAKES THE RECORD BIGGER. At 78pt with a title
  /// and a name underneath, the record was the smallest thing on a tile named
  /// after it. With one line under it instead of two the disc takes 92 of a
  /// 155pt tile and the widget finally reads as an object rather than a
  /// caption with a picture above it.
  private func smallStack(_ s: WidgetStation, ink: Color) -> some View {
    VStack(spacing: 7) {
      pressing(s, size: 92, compact: true)
      Text(s.name).font(.system(size: 13, weight: .heavy))
        .foregroundColor(ink).lineLimit(1).minimumScaleFactor(0.75)
    }
    .padding(11)
  }

  /// THE HONEST LABEL. "LAST PLAYED", never "now playing" — see the note at
  /// the top of this file. With nothing remembered it says nothing at all
  /// rather than inventing a song.
  @ViewBuilder private func lastPlayed(ink: Color) -> some View {
    if let lp = entry.lastPlayed {
      VStack(alignment: .leading, spacing: 0) {
        Text("LAST PLAYED").font(.system(size: 7.5, weight: .heavy)).tracking(1.4)
          .foregroundColor(ink.opacity(0.42))
        Text(lp.title).font(.system(size: 11, weight: .semibold))
          .foregroundColor(ink.opacity(0.88)).lineLimit(1)
        Text(lp.artist).font(.system(size: 9.5))
          .foregroundColor(ink.opacity(0.56)).lineLimit(1)
      }
    }
  }
}

// ── the two configurations ─────────────────────────────────────────────────
//
// SAME `kind` ON BOTH, and that is load-bearing: build 39 shipped
// "CruiseFMVinyl", so anyone who has already put the Deck on a Home Screen
// keeps it exactly where it is rather than watching it disappear. Only one of
// the two is ever added to the bundle — see CruiseWidgetBundle.

@available(iOSApplicationExtension 17.0, *)
struct DeckConfigurableWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "CruiseFMVinyl", intent: DeckLookIntent.self,
                           provider: DeckIntentProvider()) { entry in
      DeckView(entry: entry).containerBackground(.clear, for: .widget)
    }
    .configurationDisplayName("On the Deck")
    .description("Your station as a record, with the last song on it. Long-press to change the look.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct DeckWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseFMVinyl", provider: DeckProvider()) { entry in
      if #available(iOSApplicationExtension 17.0, *) {
        DeckView(entry: entry).containerBackground(.clear, for: .widget)
      } else {
        DeckView(entry: entry)
      }
    }
    .configurationDisplayName("On the Deck")
    .description("Your station as a record, with the last song on the label.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
