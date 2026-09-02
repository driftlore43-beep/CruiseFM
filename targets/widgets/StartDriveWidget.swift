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
    StartDriveEntry(date: Date(), station: nil, ready: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (StartDriveEntry) -> Void) {
    completion(entry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StartDriveEntry>) -> Void) {
    completion(Timeline(entries: [entry()], policy: .never))
  }

  private func entry() -> StartDriveEntry {
    guard let snap = SnapshotStore.load() else {
      return StartDriveEntry(date: Date(), station: nil, ready: false)
    }
    // Never driven yet? Offer whatever is on air rather than an empty tile —
    // a first-time driver gets a real suggestion instead of a dead square.
    let station = snap.lastDrive ?? snap.onAir.first
    return StartDriveEntry(date: Date(), station: station, ready: true)
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
        s.gradient
        // THE STATION'S OWN PHOTOGRAPH, when this target bundles one — the
        // ten built-ins do, a custom station does not and keeps the gradient
        // above. Already blurred in the asset, exactly as the app's decks
        // draw it; re-blurring at runtime is what got the app killed once.
        if let img = Art.station(s.image) {
          img.resizable().aspectRatio(contentMode: .fill)
            .clipped()
            .overlay(Color.black.opacity(0.42))
        }
        // A single soft catch from the top-left, the same light the app's
        // cards take. Enough to stop a flat fill reading as a coloured
        // rectangle, not enough to compete with the type.
        LinearGradient(colors: [.white.opacity(0.16), .clear],
                       startPoint: .topLeading, endPoint: .center)

        VStack(alignment: .leading, spacing: 0) {
          HStack(alignment: .top) {
            Text(entry.station?.mode == nil ? "TUNE IN" : "START DRIVE")
              .font(.system(size: 9, weight: .heavy)).tracking(1.6)
              .foregroundColor(.white.opacity(0.62))
            Spacer()
            if let ch = s.iconChar, !ch.isEmpty {
              Text(ch).font(iconFont(family == .systemSmall ? 17 : 20))
                .foregroundColor(.white.opacity(0.9))
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
              .foregroundColor(.white.opacity(0.66))
              .lineLimit(1)
              .padding(.top, 2)
          }
        }
        .padding(family == .systemSmall ? 13 : 16)
      }
      .widgetURL(s.url(mode: s.mode))
    }
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
  }
}
