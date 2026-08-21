import ExpoModulesCore
import WidgetKit

/**
 * CruiseWidgets — the doorway between the app and its widgets.
 *
 * It does exactly one thing, and deliberately nothing else: take the snapshot
 * the app has already built (src/utils/widgetData.ts) and put it somewhere the
 * widget extension can read, then ask WidgetKit to redraw.
 *
 * NO LOGIC LIVES HERE. Which station is on air, what the dial says, how a
 * desk listener's sessions are counted — all of that is decided in JS, where
 * it is shared with the app's own screens and covered by
 * scripts/test-widget-data.mjs. A second copy of any of it in Swift is how the
 * widget and the app start disagreeing, which is the one failure a widget
 * cannot recover from: it is read at a glance and believed.
 *
 * THE APP GROUP IS THE WHOLE MECHANISM. A widget extension is a separate
 * process with its own sandbox — it cannot see the app's AsyncStorage, its
 * documents directory, or anything else. An App Group is the one place both
 * are allowed to touch, so the snapshot goes into its shared UserDefaults as
 * a JSON string. It is small (a day of changeovers, a few stats) and rewritten
 * whole each time, so there is nothing to migrate or reconcile.
 *
 * IT NEVER THROWS. This is called on drive start, drive end and every time
 * the app is backgrounded — paths where nothing may interrupt a drive. A
 * failed write leaves the previous snapshot in place, which is a widget that
 * is briefly out of date rather than a widget that is blank.
 */
public class CruiseWidgetsModule: Module {
  /**
   * Must match the App Group on the Apple Developer app ID, the entitlement
   * in app.json, AND the one the widget extension reads. All four are the
   * same string; if they ever disagree the widgets simply show placeholder
   * data forever, with no error anywhere — so it is defined once here and
   * once in the extension, and both name this constant in a comment.
   */
  private static let appGroup = "group.com.driftlore.CruiseFM"
  private static let snapshotKey = "cruisefm.widget.snapshot"

  public func definition() -> ModuleDefinition {
    Name("CruiseWidgets")

    /**
     * Store the snapshot and redraw. Returns false rather than throwing when
     * the App Group is unreachable — which is what a missing or misspelled
     * entitlement looks like at runtime, and is worth being able to see from
     * JS rather than having it fail silently.
     */
    AsyncFunction("setSnapshot") { (json: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: Self.appGroup) else { return false }
      defaults.set(json, forKey: Self.snapshotKey)
      // Ask every widget to rebuild its timeline. This is a REQUEST, not a
      // command — iOS spends it from the widget's own budget and may defer
      // it. That is fine and is the reason the snapshot carries a whole day
      // of changeovers rather than just "what is on air now": the widget can
      // keep telling the truth for hours without being reloaded at all.
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      return true
    }

    /**
     * Whether the shared container is actually reachable. Used by the setup
     * check rather than by the app itself — the JS side already treats a
     * missing module as "no widgets", and this distinguishes "no module" from
     * "module present but the App Group was never enabled", which are two
     * very different things to go and fix.
     */
    AsyncFunction("isReady") { () -> Bool in
      UserDefaults(suiteName: Self.appGroup) != nil
    }
  }
}
