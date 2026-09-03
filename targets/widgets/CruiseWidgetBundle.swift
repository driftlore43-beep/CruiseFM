import SwiftUI
import WidgetKit

/**
 * Everything the extension offers, in the order it reads in the gallery:
 * start a drive, the record, the song you last heard, what's on, the mode as
 * an object, how you're doing, then the Lock Screen.
 *
 * SEVEN ROWS FOR TEN DESIGNS, and that is the point of the Look settings. The
 * Deck carries two looks, Last Played carries three and The Mode carries two;
 * each would otherwise be its own row and the gallery would be a scroll rather
 * than a choice. A look is a different way of drawing the SAME idea — where
 * two designs answer different questions they get their own row instead.
 *
 * The Lock Screen widget is iOS 16+ because its families did not exist
 * before that. Below 16 it is simply absent from the gallery — the right
 * outcome, and the reason it is added conditionally rather than guarded
 * inside its own body.
 */
@main
struct CruiseWidgetBundle: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    StartDriveWidget()
    // ONE OF THE TWO, NEVER BOTH — they share a `kind`, so the gallery shows
    // a single "On the Deck" either way. iOS 17 gets the version whose look
    // can be changed from Edit Widget; older phones get the plain one, which
    // matters because build 39 already put the Deck on Home Screens and
    // dropping it for them would take it away.
    if #available(iOSApplicationExtension 17.0, *) {
      DeckConfigurableWidget()
    } else {
      DeckWidget()
    }
    // Same two-configuration split as the Deck, and for the same reason:
    // AppIntentConfiguration is iOS 17+, both share a `kind`, and only ever
    // one of each pair is registered.
    if #available(iOSApplicationExtension 17.0, *) {
      LastPlayedConfigurableWidget()
    } else {
      LastPlayedWidget()
    }
    OnAirWidget()
    if #available(iOSApplicationExtension 17.0, *) {
      ModeConfigurableWidget()
    } else {
      ModeWidget()
    }
    StatsWidget()
    if #available(iOSApplicationExtension 16.0, *) {
      LockScreenWidget()
    }
  }
}

/**
 * iOS 17 moved a widget's background from "whatever you draw" to something
 * the system owns and needs told about — and a widget built without it gets
 * its padding wrong on 17 and later, while `containerBackground` does not
 * exist at all before then. So both paths are written out once, here, and
 * every widget view ends with this rather than each one repeating the
 * availability dance.
 */
extension View {
  @ViewBuilder
  func cruiseContainerBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      // The views already paint their own gradient edge to edge, so the
      // container is handed a clear background rather than a second one that
      // would sit under it doing nothing.
      self.containerBackground(.clear, for: .widget)
    } else {
      self
    }
  }
}
