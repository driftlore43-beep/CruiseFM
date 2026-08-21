import SwiftUI
import WidgetKit

/**
 * Everything the extension offers, in the order it reads in the gallery:
 * start a drive, see what's on, see how you're doing, then the Lock Screen.
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
    OnAirWidget()
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
