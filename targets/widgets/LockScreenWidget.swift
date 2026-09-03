import SwiftUI
import WidgetKit

/**
 * WIDGET 4 — THE LOCK SCREEN.
 *
 * Same on-air timeline as the Home Screen tile, drawn for the accessory
 * families. Reuses OnAirProvider outright rather than owning a second copy:
 * two providers computing the same thing is how the Lock Screen and the Home
 * Screen end up naming different stations at the same moment.
 *
 * NO COLOUR HERE, and that is the platform rather than a choice — the Lock
 * Screen renders accessory widgets as a monochrome stencil, so anything
 * tinted arrives as grey. The dial number carries it instead, in the app's
 * own seven-segment face, which is the one piece of Cruise FM's identity that
 * survives being flattened to one colour.
 *
 * iOS 16 and up. Below that the families simply do not exist, so the widget
 * never appears in the gallery — which is the correct outcome, not a bug.
 */
@available(iOSApplicationExtension 16.0, *)
struct LockScreenView: View {
  var entry: OnAirEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Text(dialNumber)
            .font(dialFont(15))
            .minimumScaleFactor(0.6).lineLimit(1)
          Text(dialBand)
            .font(.system(size: 8, weight: .heavy))
            .opacity(0.7)
        }
        .padding(4)
      }

    case .accessoryInline:
      // One line, no styling of its own — iOS sets it in the Lock Screen's
      // own face beside the date.
      Text(entry.station.map { "\($0.name) · on air" } ?? "Cruise FM")

    default: // .accessoryRectangular
      VStack(alignment: .leading, spacing: 1) {
        Text("ON AIR")
          .font(.system(size: 9, weight: .heavy)).tracking(1.4)
          .opacity(0.7)
        Text(entry.station?.name ?? "Cruise FM")
          .font(.system(size: 15, weight: .bold))
          .lineLimit(1).minimumScaleFactor(0.8)
        // Number and band in their own faces. No colour set on either: the
        // Lock Screen tints whatever it is given, and forcing white here
        // would fight it.
        HStack(alignment: .firstTextBaseline, spacing: 3) {
          Text(dialNumber).font(dialFont(12))
          if !dialBand.isEmpty { Text(dialBand).font(bandFont(7)) }
        }
        .opacity(0.75)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  /// "92.1 FM" split, so the circular family can stack the number over its
  /// band instead of shrinking the whole string into illegibility — and so
  /// the rectangular one can set each half in the face that can draw it.
  /// Through `splitDial` rather than a second copy of the same two lines:
  /// this repo spent a whole round on one idea that had quietly become four
  /// copies, and two is how that starts.
  private var dialNumber: String {
    entry.station.map { splitDial($0.dial).number } ?? "—"
  }
  private var dialBand: String {
    entry.station.map { splitDial($0.dial).band } ?? ""
  }
}

@available(iOSApplicationExtension 16.0, *)
struct LockScreenWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseLockScreen", provider: OnAirProvider()) { entry in
      LockScreenView(entry: entry)
        .widgetURL(entry.station?.url(mode: nil) ?? URL(string: "cruisefm://drive"))
        .cruiseContainerBackground()
    }
    .configurationDisplayName("On Air")
    .description("The station broadcasting now, on your Lock Screen.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
  }
}
