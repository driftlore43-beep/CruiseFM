import SwiftUI
import WidgetKit

/**
 * THE RECORD — the station as an object, with the last song on its label.
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
 * The station is the subject; the song is a memento sitting on the label.
 * A station does not change from moment to moment, so drawing the station
 * cannot go out of date the way drawing a track would.
 */
struct VinylEntry: TimelineEntry {
  let date: Date
  let station: WidgetStation?
  let lastPlayed: LastPlayedInfo?
  let ready: Bool
}

struct VinylProvider: TimelineProvider {
  func placeholder(in context: Context) -> VinylEntry {
    VinylEntry(date: Date(), station: nil, lastPlayed: nil, ready: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (VinylEntry) -> Void) {
    completion(entry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<VinylEntry>) -> Void) {
    // ONE ENTRY, AND A REFRESH AFTER THE NEXT CHANGEOVER. Unlike the On Air
    // widget this does not walk the whole broadcast day: the record shows the
    // station you last drove, which only changes when you drive again — and
    // the app republishes the snapshot every time it is backgrounded, which
    // is a far better signal than any schedule guessed at here.
    completion(Timeline(entries: [entry()], policy: .after(Date().addingTimeInterval(60 * 60))))
  }

  private func entry() -> VinylEntry {
    guard let snap = SnapshotStore.load() else {
      return VinylEntry(date: Date(), station: nil, lastPlayed: nil, ready: false)
    }
    // Never driven? Show whatever is on air, so a first-time listener gets a
    // real record rather than an empty square.
    let station = snap.lastDrive ?? snap.onAir.first
    return VinylEntry(date: Date(), station: station, lastPlayed: snap.lastPlayed, ready: true)
  }
}

struct VinylView: View {
  var entry: VinylEntry
  @Environment(\.widgetFamily) var family

  private var isSmall: Bool { family == .systemSmall }

  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      ZStack {
        s.gradient
        if let img = Art.station(s.image) {
          img.resizable().aspectRatio(contentMode: .fill)
            .clipped()
            // Deeper than the other widgets: a record is a dark object and
            // needs the scene to fall back behind it, the same way the app's
            // Vinyl deck lays a heavier scrim than its lighter modes.
            .overlay(Color.black.opacity(0.55))
        }

        if isSmall { small(s) } else { medium(s) }
      }
    }
  }

  /// Small: the record fills the tile, the words sit under it.
  private func small(_ s: WidgetStation) -> some View {
    VStack(spacing: 6) {
      RecordView(accent: s.accentColor, label: Art.lastPlayed(), size: 74)
      VStack(spacing: 1) {
        Text(s.name).font(.system(size: 12, weight: .bold))
          .foregroundColor(.white).lineLimit(1)
        lastPlayedLine.lineLimit(1)
      }
    }
    .padding(10)
  }

  /// Medium: the record on the left, the station and the memento beside it.
  private func medium(_ s: WidgetStation) -> some View {
    HStack(spacing: 14) {
      RecordView(accent: s.accentColor, label: Art.lastPlayed(), size: 96)
      VStack(alignment: .leading, spacing: 3) {
        Text(s.dial).font(dialFont(15)).foregroundColor(.white.opacity(0.55))
        Text(s.name).font(.system(size: 17, weight: .bold))
          .foregroundColor(.white).lineLimit(1)
        Text(s.tagline).font(.system(size: 11))
          .foregroundColor(.white.opacity(0.6)).lineLimit(2)
        Spacer(minLength: 2)
        lastPlayedLine
      }
      Spacer(minLength: 0)
    }
    .padding(14)
  }

  /// THE HONEST LABEL. "LAST PLAYED", never "now playing" — see the note at
  /// the top of this file. With nothing remembered it says nothing at all
  /// rather than inventing a song.
  @ViewBuilder private var lastPlayedLine: some View {
    if let lp = entry.lastPlayed {
      VStack(alignment: .leading, spacing: 0) {
        Text("LAST PLAYED")
          .font(.system(size: 7.5, weight: .heavy)).tracking(1.4)
          .foregroundColor(.white.opacity(0.42))
        Text(lp.title).font(.system(size: 10.5, weight: .semibold))
          .foregroundColor(.white.opacity(0.8)).lineLimit(1)
      }
    }
  }
}

struct VinylWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseFMVinyl", provider: VinylProvider()) { entry in
      if #available(iOS 17.0, *) {
        VinylView(entry: entry).containerBackground(.clear, for: .widget)
      } else {
        VinylView(entry: entry)
      }
    }
    .configurationDisplayName("On the Deck")
    .description("Your station as a record, with the last song on the label.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
