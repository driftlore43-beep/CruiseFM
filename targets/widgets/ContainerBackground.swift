import SwiftUI
import WidgetKit

/**
 * iOS 17 moved a widget's background from "whatever you draw" to something the
 * system owns and needs told about — and a widget built without it gets its
 * padding wrong on 17 and later, while `containerBackground` does not exist at
 * all before then. So both paths are written out once, here, and every widget
 * view ends with this rather than each one repeating the availability dance.
 *
 * IT LIVES IN ITS OWN FILE BECAUSE OF WHAT BUILD 40 LOOKED LIKE. This used to
 * sit at the foot of CruiseWidgetBundle.swift, and when the bundle's body
 * failed to compile the extension went down with it — so all EIGHT call sites
 * lost the method at once and Xcode reported a second, unrelated-looking error
 * ("instance member 'padding' cannot be used on type 'View'") that sent the
 * search somewhere it did not belong. One genuine mistake, two error messages,
 * and the louder one was the false trail.
 *
 * Note the `if #available` with an `else` IS fine here: this is a
 * `@ViewBuilder`, which supplies `buildEither`. The one in the bundle was not
 * — see the note in CruiseWidgetBundle.swift.
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
