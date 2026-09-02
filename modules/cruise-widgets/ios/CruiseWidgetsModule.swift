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
  /** The last-played cover, as a file in the App Group container. Named here
   *  and in the extension's Artwork.swift; the two must agree. */
  private static let artworkFile = "last-artwork.jpg"

  /** A custom station's own photograph, one file per station. The extension
   *  builds the same name from the station id it already has in the snapshot,
   *  so neither side needs a list of what exists. */
  private static func stationFile(_ id: String) -> String { "station-\(id).jpg" }

  /** Station ids come from the app, not a user, but they end up in a FILE
   *  NAME — so anything that could climb out of the container is refused
   *  rather than trusted. A rejected id simply means no photo in the widget. */
  private static func safeId(_ id: String) -> String? {
    let ok = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
    guard !id.isEmpty, id.count <= 64, id.unicodeScalars.allSatisfy({ ok.contains($0) }) else { return nil }
    return id
  }

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

    /**
     * Put the last-played album cover where the widget can draw it.
     *
     * A FILE, NOT UserDefaults. Shared UserDefaults is a property list read
     * whole on every access, and the snapshot already lives there; a few tens
     * of kilobytes of JPEG in it would be paid for on every widget draw. The
     * App Group's container directory is the right home for bytes.
     *
     * THE COVER IS OF THE LAST SONG, WHICH IS WHY IT CAN BE SHOWN AT ALL. A
     * widget is redrawn a handful of times a day, so it can never honestly
     * claim what is playing NOW — by the time anyone looks, the song has
     * usually changed. "Last played" is a statement about the past, and the
     * past does not go stale. The label under it in the widget says so.
     *
     * Passing nil clears it, which is what a drive with no artwork should do
     * rather than leaving yesterday's cover sitting on the record for ever.
     */
    /**
     * Put a CUSTOM station's photograph where the widgets can draw it.
     *
     * The ten built-in stations' backdrops are bundled into the extension
     * itself, which is why they needed nothing like this. A custom station's
     * photo lives in the app's documents directory — a place a widget
     * extension genuinely cannot reach, being a separate process with its own
     * sandbox — so the only route across is to copy it into the App Group.
     *
     * ONE FILE PER STATION, named from the station id the snapshot already
     * carries, so the extension can find it without being told and nothing
     * has to keep a list in step. Passing nil deletes it, which is what
     * removing a station or its photo should do rather than leaving an
     * orphan behind for a widget to draw.
     */
    AsyncFunction("setStationImage") { (id: String, base64: String?) -> Bool in
      guard
        let safe = Self.safeId(id),
        let dir = FileManager.default
          .containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup)
      else { return false }
      let url = dir.appendingPathComponent(Self.stationFile(safe))
      guard let b64 = base64, !b64.isEmpty else {
        try? FileManager.default.removeItem(at: url)
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        return true
      }
      guard let data = Data(base64Encoded: b64) else { return false }
      do { try data.write(to: url, options: .atomic) } catch { return false }
      if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
      return true
    }

    AsyncFunction("setArtwork") { (base64: String?) -> Bool in
      guard let dir = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup) else { return false }
      let url = dir.appendingPathComponent(Self.artworkFile)
      guard let b64 = base64, !b64.isEmpty else {
        try? FileManager.default.removeItem(at: url)
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        return true
      }
      guard let data = Data(base64Encoded: b64) else { return false }
      // Atomic so a widget waking mid-write never reads half a JPEG.
      do { try data.write(to: url, options: .atomic) } catch { return false }
      if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
      return true
    }
  }
}
