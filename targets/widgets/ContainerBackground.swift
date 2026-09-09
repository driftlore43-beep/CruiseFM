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

/**
 * ── WHY EVERY HOME SCREEN WIDGET ENDS WITH THIS ───────────────────────────
 *
 * From iOS 17 WidgetKit INSETS a widget's content by a default margin before
 * it draws it. The view is handed a smaller box than the tile, and whatever is
 * left over shows the container background instead — which is `.clear` above,
 * so on a Home Screen it reads as a pale ring around every widget.
 *
 * THAT IS WHAT BUILD 43 LOOKED LIKE, and it is the whole of the owner's
 * "they're still not fitting with the widgets' dimensions": each design sat in
 * the middle of a larger white rounded tile. It also quietly contradicted an
 * instruction — 03.09, "create the Winamp as if it's the shape of the widget"
 * — because a window that fills its view still cannot fill the tile while the
 * system is holding the view away from the edges.
 *
 * Every view in this target already carries its OWN outer padding (13 on the
 * small tiles, 15-16 on the mediums), which is what keeps type off the curve,
 * so the system margin was a second one on top of a margin that already
 * existed. Disabling it is what makes a photograph, a gradient or a drawn
 * object reach the tile's real edges.
 *
 * NO AVAILABILITY CHECK, AND THAT IS DELIBERATE RATHER THAN AN OVERSIGHT:
 * this extension's deployment target is iOS 18.0 — set by
 * @bacons/apple-targets, confirmed by reading IPHONEOS_DEPLOYMENT_TARGET out
 * of a generated project rather than assumed — so a method added in 17 is
 * always there. The check would not have compiled anyway: `contentMarginsDisabled`
 * returns a DIFFERENT concrete type from `self`, and `some WidgetConfiguration`
 * needs one underlying type, so the `if #available { … } else { … }` shape
 * that works for views (see above) is rejected here. There is no public
 * `AnyWidgetConfiguration` to erase it with. If the deployment target is ever
 * lowered below 17, the answer is a second availability-gated Widget struct
 * sharing the same `kind`, NOT a branch inside this function.
 *
 * THE LOCK SCREEN DELIBERATELY DOES NOT CALL THIS. Accessory widgets are drawn
 * inside a system shape a few points across, and their margins are what keeps
 * text off that curve; there is no photograph to bleed there anyway.
 */
extension WidgetConfiguration {
  func cruiseFullBleed() -> some WidgetConfiguration {
    contentMarginsDisabled()
  }
}
