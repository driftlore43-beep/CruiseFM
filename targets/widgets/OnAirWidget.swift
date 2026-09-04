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
            DialScale(dial: s.dial)
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
  let dial: String

  /// WHERE THE NEEDLE REALLY GOES. It was pinned at 38% of the width, which
  /// is a lie dressed as a dial — the one thing this drawing claims is where
  /// on the band the station sits, so that had better come from the station.
  ///
  /// The bands are the app's own (`BAND_CFG` in TunerMode): FM 87.5–108.5,
  /// AM 530–1600. An unreadable dial parks in the middle rather than at an
  /// edge, because the middle reads as "somewhere here" and an edge reads as
  /// a specific, wrong answer.
  private var position: CGFloat {
    let (number, band) = splitDial(dial)
    guard let v = Double(number.filter { $0.isNumber || $0 == "." }), v > 0 else { return 0.5 }
    let (lo, hi) = band.uppercased().hasPrefix("F") ? (87.5, 108.5) : (530.0, 1600.0)
    return CGFloat(min(1, max(0, (v - lo) / (hi - lo))))
  }

  /// The printed scale. These are NOT other stations — a receiver's face has
  /// numbers printed on it whether or not anything is broadcasting there, so
  /// this claims nothing. Station NAMES would be a claim, and the widget only
  /// knows one station, which is why there are none.
  private var marks: [(CGFloat, String)] {
    let (_, band) = splitDial(dial)
    return band.uppercased().hasPrefix("F")
      ? [(0.10, "90"), (0.36, "95"), (0.62, "100"), (0.88, "106")]
      : [(0.10, "600"), (0.36, "800"), (0.62, "1000"), (0.88, "1400")]
  }

  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      ZStack(alignment: .topLeading) {
        LinearGradient(colors: [.clear, .black.opacity(0.42), .black.opacity(0.42), .clear],
                       startPoint: .top, endPoint: .bottom)
        // THE TICKS ARE THE POINT, and they were what failed: at 12 and 22
        // against a photograph they did not read at all (owner, 03.09: "I can
        // barely see the lines"). Longer and brighter is what makes this a
        // dial rather than a texture.
        ForEach(0..<33, id: \.self) { i in
          let major = i % 8 == 0
          Rectangle()
            .fill(.white.opacity(major ? 0.80 : 0.44))
            .frame(width: major ? 2 : 1.4, height: major ? 20 : 11)
            .offset(x: w * (CGFloat(i) / 32) * 0.96 + w * 0.02, y: major ? 2 : 8)
        }
        Rectangle().fill(.white.opacity(0.28)).frame(height: 1).offset(y: 23)
        // the printed numbers, under the rule
        ForEach(marks, id: \.1) { m in
          Text(m.1).font(dialFont(9)).foregroundColor(.white.opacity(0.42))
            .offset(x: w * m.0 - 9, y: 26)
        }
        // the needle, where the station actually is
        Rectangle().fill(Color(hex: "#FF3B30"))
          .frame(width: 2, height: 27)
          .offset(x: w * position, y: -1)
          .shadow(color: Color(hex: "#FF3B30").opacity(0.85), radius: 5)
        Circle().fill(Color(hex: "#FF3B30"))
          .frame(width: 7, height: 7)
          .offset(x: w * position - 2.5, y: -4)
          .shadow(color: Color(hex: "#FF3B30").opacity(0.9), radius: 5)
      }
    }
    .frame(height: 38)
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
