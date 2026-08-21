import SwiftUI
import WidgetKit

/**
 * WIDGET 2 — ON AIR NOW, and the reason the whole snapshot is shaped the way
 * it is.
 *
 * THIS IS HOW A STATIC WIDGET FEELS ALIVE. iOS budgets a widget to a handful
 * of reloads a day, so "ask the app what's on air" every few minutes is not
 * available to anyone. What WidgetKit DOES take is a timeline — a list of
 * entries each stamped with the moment it becomes current — and it renders
 * those itself, on time, with our app not running and no budget spent.
 *
 * Cruise FM already owns a real broadcast schedule, so the changeovers for
 * the next day are knowable in advance. The JS side works them out
 * (buildOnAirTimeline) and this hands them straight to WidgetKit. The result
 * is a widget that genuinely changes through the day — Night Run at night,
 * Sunset at dusk — while never animating and never waking the app.
 *
 * The last entry asks for a reload (.atEnd) because the written-down day has
 * run out by then and only the app can produce more.
 */
struct OnAirEntry: TimelineEntry {
  let date: Date
  let station: WidgetStation?
  let upNext: String?
  let ready: Bool
}

struct OnAirProvider: TimelineProvider {
  func placeholder(in context: Context) -> OnAirEntry {
    OnAirEntry(date: Date(), station: nil, upNext: nil, ready: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (OnAirEntry) -> Void) {
    let snap = SnapshotStore.load()
    completion(OnAirEntry(date: Date(), station: snap?.onAir.first,
                          upNext: snap?.upNextLine, ready: snap != nil))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<OnAirEntry>) -> Void) {
    guard let snap = SnapshotStore.load(), !snap.onAir.isEmpty else {
      completion(Timeline(entries: [OnAirEntry(date: Date(), station: nil, upNext: nil, ready: false)],
                          policy: .after(Date().addingTimeInterval(3600))))
      return
    }

    let now = Date()
    var entries: [OnAirEntry] = []
    for (i, station) in snap.onAir.enumerated() {
      // `at` is epoch milliseconds from JS.
      let when = Date(timeIntervalSince1970: (station.at ?? 0) / 1000)
      // An entry already in the past is only useful as the CURRENT one, and
      // the first entry is always "now" by construction — so keep that and
      // drop any other stale entry rather than handing WidgetKit a timeline
      // that starts behind the clock.
      let date = i == 0 ? now : when
      if i > 0 && date <= now { continue }
      // The up-next line describes what follows the CURRENT station, so it
      // only belongs on the entry that is current when it was written.
      entries.append(OnAirEntry(date: date, station: station,
                                upNext: i == 0 ? snap.upNextLine : nil, ready: true))
    }
    if entries.isEmpty {
      entries = [OnAirEntry(date: now, station: snap.onAir.first, upNext: snap.upNextLine, ready: true)]
    }
    // .atEnd: when the written-down day runs out, ask the app for more. This
    // is the only reload this widget ever needs.
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

struct OnAirView: View {
  var entry: OnAirEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      ZStack(alignment: .topLeading) {
        s.gradient
        LinearGradient(colors: [.white.opacity(0.14), .clear],
                       startPoint: .topLeading, endPoint: .center)

        VStack(alignment: .leading, spacing: 0) {
          HStack(spacing: 5) {
            // The app's own on-air lamp: a red dot, the one colour that never
            // changes with the station (the Tuner's needle rule).
            Circle().fill(Color(hex: "#FF3B30")).frame(width: 6, height: 6)
            Text("ON AIR")
              .font(.system(size: 9, weight: .heavy)).tracking(1.6)
              .foregroundColor(.white.opacity(0.72))
            Spacer()
            if let ch = s.iconChar, !ch.isEmpty {
              Text(ch).font(iconFont(family == .systemSmall ? 16 : 19))
                .foregroundColor(.white.opacity(0.85))
            }
          }
          Spacer(minLength: 4)
          Text(s.dial)
            .font(dialFont(family == .systemSmall ? 15 : 18))
            .foregroundColor(.white.opacity(0.55))
          Text(s.name)
            .font(.system(size: family == .systemSmall ? 16 : 20, weight: .bold))
            .foregroundColor(.white)
            .lineLimit(2).minimumScaleFactor(0.8)
          if family != .systemSmall {
            Text(s.tagline)
              .font(.system(size: 12))
              .foregroundColor(.white.opacity(0.68))
              .lineLimit(1).padding(.top, 2)
            if let next = entry.upNext {
              Text("UP NEXT · \(next)")
                .font(.system(size: 9, weight: .bold)).tracking(1)
                .foregroundColor(.white.opacity(0.42))
                .lineLimit(1).padding(.top, 5)
            }
          }
        }
        .padding(family == .systemSmall ? 13 : 16)
      }
      .widgetURL(s.url(mode: nil))
    }
  }
}

struct OnAirWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseOnAir", provider: OnAirProvider()) { entry in
      OnAirView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("On Air Now")
    .description("Whichever station is broadcasting this hour.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
