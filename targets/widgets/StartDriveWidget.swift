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
        if family == .systemSmall {
          if let img = Art.station(s.image) {
            img.resizable().aspectRatio(contentMode: .fill).clipped()
              .overlay(Color.black.opacity(0.42))
          }
          LinearGradient(colors: [.white.opacity(0.16), .clear],
                         startPoint: .topLeading, endPoint: .center)
          VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
              Text(s.mode == nil ? "TUNE IN" : "START DRIVE")
                .font(.system(size: 9, weight: .heavy)).tracking(1.6)
                .foregroundColor(.white.opacity(0.62))
              Spacer()
              if let ch = s.iconChar, !ch.isEmpty {
                Text(ch).font(iconFont(17)).foregroundColor(.white.opacity(0.9))
              }
            }
            Spacer(minLength: 4)
            DialText(dial: s.dial, size: 15, color: .white.opacity(0.55))
            Text(s.name).font(.system(size: 16, weight: .bold))
              .foregroundColor(.white).lineLimit(2).minimumScaleFactor(0.8)
          }
          .padding(13)
        } else {
          // THE MEDIUM IS AN INVITATION, not a label. This is the widget
          // someone taps to get going, so it asks rather than announces —
          // and the photograph bleeds in from the right instead of sitting
          // under everything, which is what stops the type competing with it.
          HStack(spacing: 0) {
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
                .fixedSize(horizontal: false, vertical: true)
              Spacer(minLength: 6)
              Text(s.mode == nil ? s.name : "\(s.name) · \(modeLabel(s.mode))")
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.62)).lineLimit(1)
            }
            .padding(.vertical, 16)
            .padding(.leading, 16)
            Spacer(minLength: 8)
            ZStack(alignment: .trailing) {
              if let img = Art.station(s.image) {
                img.resizable().aspectRatio(contentMode: .fill)
              } else {
                s.gradient
              }
              // The photograph fades OUT toward the type rather than being
              // boxed off it — a scrim with a visible edge is a rectangle.
              LinearGradient(stops: [
                .init(color: Color(hex: "#0d0f14"), location: 0),
                .init(color: Color(hex: "#0d0f14").opacity(0.55), location: 0.34),
                .init(color: .clear, location: 1),
              ], startPoint: .leading, endPoint: .trailing)
              Circle().fill(.white)
                .frame(width: 46, height: 46)
                .overlay(Triangle().fill(Color(hex: "#111")).frame(width: 15, height: 18).offset(x: 2))
                .shadow(color: .black.opacity(0.5), radius: 8, y: 3)
                .padding(.trailing, 16)
            }
            .frame(width: 168)
            .clipped()
          }
        }
      }
      .widgetURL(s.url(mode: s.mode))
    }
  }
}

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
