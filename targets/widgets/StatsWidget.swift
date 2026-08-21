import SwiftUI
import WidgetKit

/**
 * WIDGET 3 — THE STREAK.
 *
 * Mirrors the strip on the Profile page, and takes its WORDING from the
 * snapshot rather than deciding it here: someone who answered "just
 * listening" sees SESSIONS and LISTENED, someone who drives sees DRIVES and
 * CRUISED. That rule lives in sessionKind.ts and must never be re-decided in
 * Swift, or the widget starts telling a desk listener they drove.
 *
 * Static timeline, like Start Drive — the numbers only move when a session
 * ends, and the app reloads the widgets itself when that happens.
 */
struct StatsEntry: TimelineEntry {
  let date: Date
  let stats: WidgetStats?
  let accent: Color
}

struct StatsProvider: TimelineProvider {
  func placeholder(in context: Context) -> StatsEntry {
    StatsEntry(date: Date(), stats: nil, accent: Color(hex: "#7B38E0"))
  }

  func getSnapshot(in context: Context, completion: @escaping (StatsEntry) -> Void) {
    completion(entry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StatsEntry>) -> Void) {
    completion(Timeline(entries: [entry()], policy: .never))
  }

  private func entry() -> StatsEntry {
    guard let snap = SnapshotStore.load() else {
      return StatsEntry(date: Date(), stats: nil, accent: Color(hex: "#7B38E0"))
    }
    // Wear the colour of whatever is on air, so the tile shifts with the day
    // instead of sitting in one fixed hue among stations that all have their
    // own.
    let accent = Color(hex: snap.onAir.first?.accent ?? "#7B38E0")
    return StatsEntry(date: Date(), stats: snap.stats, accent: accent)
  }
}

struct StatsView: View {
  var entry: StatsEntry

  private func hours(_ minutes: Int) -> String {
    if minutes < 60 { return "\(minutes)m" }
    let h = minutes / 60, m = minutes % 60
    return m == 0 ? "\(h)h" : "\(h)h \(m)m"
  }

  var body: some View {
    if let s = entry.stats {
      ZStack(alignment: .topLeading) {
        LinearGradient(colors: [Color(hex: "#12121c"), Color(hex: "#0a0a10")],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
        VStack(alignment: .leading, spacing: 0) {
          Text("STREAK")
            .font(.system(size: 9, weight: .heavy)).tracking(1.6)
            .foregroundColor(.white.opacity(0.5))
          Spacer(minLength: 2)
          HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text("\(s.streakDays)")
              .font(.system(size: 40, weight: .bold))
              .foregroundColor(entry.accent)
            Text(s.streakDays == 1 ? "day" : "days")
              .font(.system(size: 13, weight: .semibold))
              .foregroundColor(.white.opacity(0.55))
          }
          Spacer(minLength: 2)
          HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
              Text("\(s.sessionsThisWeek)")
                .font(.system(size: 15, weight: .bold)).foregroundColor(.white)
              Text(s.countLabel)
                .font(.system(size: 7.5, weight: .heavy)).tracking(1)
                .foregroundColor(.white.opacity(0.42))
            }
            VStack(alignment: .leading, spacing: 1) {
              Text(hours(s.totalMinutes))
                .font(.system(size: 15, weight: .bold)).foregroundColor(.white)
              Text(s.timeLabel)
                .font(.system(size: 7.5, weight: .heavy)).tracking(1)
                .foregroundColor(.white.opacity(0.42))
            }
          }
        }
        .padding(13)
      }
      .widgetURL(URL(string: "cruisefm://drive"))
    } else {
      NotReadyView()
    }
  }
}

struct StatsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseStats", provider: StatsProvider()) { entry in
      StatsView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("Your Streak")
    .description("Days in a row, and what you've listened to this week.")
    .supportedFamilies([.systemSmall])
  }
}
