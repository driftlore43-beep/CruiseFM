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
 * ── WHY THERE ARE TWO BUNDLES AND A LAUNCHER ──────────────────────────────
 *
 * THIS IS WHAT BUILD 40 DIED ON, and it is worth stating plainly because the
 * shape that failed reads perfectly well:
 *
 *     if #available(iOSApplicationExtension 17.0, *) {
 *       DeckConfigurableWidget()
 *     } else {
 *       DeckWidget()
 *     }
 *
 * `@WidgetBundleBuilder` is NOT `@ViewBuilder`. It supplies `buildOptional`,
 * so an `if #available` with NO else compiles — which is why the Lock Screen's
 * lone availability check has always been fine — but it supplies no
 * `buildEither`, so the moment an `else` appears the whole body is rejected:
 * "closure containing control flow statement cannot be used with result
 * builder 'WidgetBundleBuilder'".
 *
 * So the choice is made ABOVE the builder instead. `@main` needs nothing more
 * than a `static func main()`, and `WidgetBundle` already provides one, so the
 * launcher picks a bundle and that bundle's body is a plain list with no
 * control flow in it at all.
 *
 * THE PROPERTY THIS PRESERVES, which is the only reason the split exists:
 * exactly ONE widget of each configurable/static pair is ever registered, and
 * the two halves of a pair share a `kind`. A changed kind makes a widget that
 * is already on someone's Home Screen vanish, and build 39 has already put the
 * Deck on the owner's.
 *
 * The Lock Screen widget is iOS 16+ because its families did not exist before
 * that. Below 16 it is simply absent from the gallery — the right outcome, and
 * the reason it is added conditionally rather than guarded inside its own body.
 */
@main
struct CruiseWidgets {
  static func main() {
    if #available(iOSApplicationExtension 17.0, *) {
      ModernWidgets.main()
    } else {
      LegacyWidgets.main()
    }
  }
}

/// iOS 17 and later: the three widgets whose look can be changed from
/// Edit Widget, plus the four that never had a setting.
@available(iOSApplicationExtension 17.0, *)
struct ModernWidgets: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    StartDriveWidget()
    DeckConfigurableWidget()
    LastPlayedConfigurableWidget()
    OnAirWidget()
    ModeConfigurableWidget()
    StatsWidget()
    LockScreenWidget()
  }
}

/// iOS 16 and older: the same seven rows, with the plain version of each pair.
/// Someone here gets one fixed look rather than a setting — the alternative is
/// the widget not existing for them at all.
struct LegacyWidgets: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    StartDriveWidget()
    DeckWidget()
    LastPlayedWidget()
    OnAirWidget()
    ModeWidget()
    StatsWidget()
    // No `else` here, and there must never be one — see the note above.
    if #available(iOSApplicationExtension 16.0, *) {
      LockScreenWidget()
    }
  }
}
