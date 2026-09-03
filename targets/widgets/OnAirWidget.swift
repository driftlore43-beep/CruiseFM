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

        if family == .systemSmall {
          VStack(alignment: .leading, spacing: 0) {
            onAirLamp(s)
            Spacer(minLength: 4)
            DialText(dial: s.dial, size: 15, color: .white.opacity(0.55))
            Text(s.name).font(.system(size: 16, weight: .bold))
              .foregroundColor(.white).lineLimit(2).minimumScaleFactor(0.8)
          }
        } else {
          // THE MEDIUM IS A DIAL, because this widget is the one that answers
          // "what's on?" and a receiver answers it by showing you where you
          // are on the band. Owner, 03.09, on the tick marks: "I can barely
          // see the lines - they are quite short" — so they are nearly twice
          // as long as the first cut and brighter with it. A scale you cannot
          // read is decoration rather than a dial.
          VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
              onAirLamp(s)
              Spacer(minLength: 6)
              DialText(dial: s.dial, size: 22, color: .white)
            }
            Text(s.name).font(.system(size: 21, weight: .heavy))
              .foregroundColor(.white).lineLimit(1).minimumScaleFactor(0.7)
              .padding(.top, 3)
            Spacer(minLength: 6)
            DialScale(accent: s.accentColor)
            Spacer(minLength: 6)
            if let next = entry.upNext {
              Text("UP NEXT · \(next)")
                .font(.system(size: 9, weight: .bold)).tracking(1)
                .foregroundColor(.white.opacity(0.46)).lineLimit(1)
            } else {
              Text(s.tagline).font(.system(size: 12))
                .foregroundColor(.white.opacity(0.66)).lineLimit(1)
            }
          }
        }
        .padding(family == .systemSmall ? 13 : 16)
      }
      .widgetURL(s.url(mode: nil))
    }
  }
}

/// The app's own on-air lamp: a red dot, the one colour that never changes
/// with the station (the Tuner's needle rule).
private func onAirLamp(_ s: WidgetStation) -> some View {
  HStack(spacing: 5) {
    Circle().fill(Color(hex: "#FF3B30")).frame(width: 6, height: 6)
    Text("ON AIR").font(.system(size: 9, weight: .heavy)).tracking(1.6)
      .foregroundColor(.white.opacity(0.72))
    if let ch = s.iconChar, !ch.isEmpty {
      Text(ch).font(iconFont(15)).foregroundColor(.white.opacity(0.8))
    }
  }
}

/**
 * A printed band scale with the needle parked on this station.
 *
 * THE TICKS ARE THE POINT, and they were the thing that failed: at 12pt and
 * 22pt against a photograph they simply did not read. 20 and 36, and lifted
 * in opacity, is what makes it a dial rather than a texture.
 *
 * The numbers are not the real band — this widget knows one station, not the
 * whole dial — so the scale is printed and the NEEDLE is what is true. It sits
 * where the station sits, which is the one claim being made.
 */
private struct DialScale: View {
  let accent: Color

  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      ZStack(alignment: .topLeading) {
        LinearGradient(colors: [.clear, .black.opacity(0.42), .black.opacity(0.42), .clear],
                       startPoint: .top, endPoint: .bottom)
        // the ticks
        ForEach(0..<33, id: \.self) { i in
          let major = i % 5 == 0
          Rectangle()
            .fill(.white.opacity(major ? 0.78 : 0.42))
            .frame(width: major ? 2 : 1.4, height: major ? 22 : 12)
            .offset(x: w * (CGFloat(i) / 32) * 0.96 + w * 0.02,
                    y: major ? 6 : 11)
        }
        Rectangle().fill(.white.opacity(0.28)).frame(height: 1).offset(y: 28)
        // the needle, on the station
        Rectangle().fill(Color(hex: "#FF3B30"))
          .frame(width: 2, height: 32)
          .offset(x: w * 0.38, y: 1)
          .shadow(color: Color(hex: "#FF3B30").opacity(0.85), radius: 5)
        Circle().fill(Color(hex: "#FF3B30"))
          .frame(width: 7, height: 7)
          .offset(x: w * 0.38 - 2.5, y: -2)
          .shadow(color: Color(hex: "#FF3B30").opacity(0.9), radius: 5)
      }
    }
    .frame(height: 34)
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
