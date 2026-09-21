import AppIntents
import WidgetKit

/**
 * PIN A TILE TO A STATION — the picker behind every "Station" setting.
 *
 * WHAT THE TILES DID BEFORE, AND WHY IT LOOKED BROKEN. Five widgets name a
 * station — Start Drive, On the Deck, The Mode's three looks and Last Played
 * — and every one of them drew the LAST DRIVE. That is the right default and
 * was the only thing a widget could know on its own. It is also a loop:
 * each of those tiles deep-links to the station it is already showing, so
 * tapping one starts that station, which is then the last drive, which is
 * what the tile shows. Owner, 21.09: "all the 'on the deck' 'start drive' and
 * 'pick up where you left off' stay on sunset AM - and it doesn't change...
 * And everytime I click on the mirror ball it just takes me to sunset
 * station. How should this work when people made their own stations".
 *
 * THE ANSWER IS BOTH, NOT EITHER. Last drive stays the default, so nothing
 * changes for anyone who never long-presses; and a tile can be PINNED to one
 * station, so someone with three favourites can keep three tiles, one each.
 * That is also the only place a station someone made themselves gets a
 * permanent home on the Home Screen.
 *
 * ── WHY AN AppEntity AND NOT AN AppEnum ───────────────────────────────────
 *
 * Every other setting in this target (DeckLook, ModeLook, LastPlayedLook) is
 * an `AppEnum`, which is a list written into the binary. Stations cannot be:
 * the whole point is that the list includes the driver's OWN creations, which
 * do not exist when this is compiled. An `AppEntity` with an `EntityQuery` is
 * the shape that allows a list decided at read time.
 *
 * THE LIST COMES OUT OF THE SNAPSHOT, and it has to, because
 * `suggestedEntities()` is asked while the app is NOT RUNNING — a widget
 * extension is its own process and cannot call into the app for anything.
 * So `widgetData.ts` writes every pickable station into the snapshot and this
 * reads it back. See Snapshot.pickableStations.
 *
 * ── THE SENTINEL, AND WHY IT IS NOT JUST `nil` ────────────────────────────
 *
 * The parameter is optional and nil means "my last station", which is the
 * behaviour every tile had before this. But an optional parameter does not
 * reliably offer a way BACK to nothing once something has been chosen, and a
 * setting you can change and not undo is worse than no setting. So the list
 * also carries a first row with an empty id, and both it and nil mean the
 * same thing — `Snapshot.station(pinned:)` treats an empty id as unpinned.
 *
 * ── PREMIUM ───────────────────────────────────────────────────────────────
 *
 * The FM band is offered to everyone and MARKED rather than hidden, which is
 * the same shop-window rule the Stations page follows: a locked row is dimmed
 * behind a padlock, never removed. Tapping a pinned premium station opens the
 * app, which gates it the way it gates every other premium pick — a taste,
 * then the paywall. NOTHING IS ENFORCED HERE: this extension reads a file out
 * of shared storage, and a paywall decided from that is a paywall anyone can
 * edit. `isPro` in the snapshot only decides whether the word "Premium"
 * appears beside a row.
 */
@available(iOSApplicationExtension 17.0, *)
struct StationEntity: AppEntity, Identifiable {
  /// The station's own id, or "" for the "My last station" row.
  let id: String
  let name: String
  /// "92.1 FM", or "" on the sentinel.
  let dial: String
  /// Shown as "Premium" beside the dial, and only when they do not have it.
  let locked: Bool

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Station"
  static var defaultQuery = StationQuery()

  var displayRepresentation: DisplayRepresentation {
    if id.isEmpty {
      return DisplayRepresentation(title: "My last station",
                                   subtitle: "Whichever one you drove most recently")
    }
    let sub = locked ? "\(dial) · Premium" : dial
    return DisplayRepresentation(title: "\(name)", subtitle: "\(sub)")
  }

  /// The row that means "leave this tile following my last drive". Listed
  /// first, so the default is the first thing anyone sees.
  static let lastStation = StationEntity(id: "", name: "My last station", dial: "", locked: false)
}

@available(iOSApplicationExtension 17.0, *)
struct StationQuery: EntityQuery {
  /// Everything someone can pin, read out of the snapshot the app wrote.
  ///
  /// A phone that has installed the app but never opened it has no snapshot,
  /// and this correctly returns just the sentinel: one row saying "my last
  /// station", which is exactly what that tile will do.
  private func all() -> [StationEntity] {
    guard let snap = SnapshotStore.load() else { return [StationEntity.lastStation] }
    let pro = snap.isPro ?? true
    return [StationEntity.lastStation] + snap.pickableStations.map {
      StationEntity(id: $0.id, name: $0.name, dial: $0.dial,
                    locked: !pro && ($0.premium ?? false))
    }
  }

  func entities(for identifiers: [String]) async throws -> [StationEntity] {
    let known = all()
    // Preserve the ORDER ASKED FOR rather than the list's own — the caller is
    // resolving a value it already holds, and handing it back in a different
    // order is the kind of thing that works until something depends on it.
    return identifiers.compactMap { id in known.first { $0.id == id } }
  }

  func suggestedEntities() async throws -> [StationEntity] {
    all()
  }
}

// WHAT A FRESHLY ADDED TILE STARTS ON is nil, and deliberately nothing more.
// An unset optional parameter already means "my last station" — the behaviour
// every one of these widgets had before pinning existed — so no default value
// has to be declared anywhere, and nobody's Home Screen changes under them
// when this ships. A `defaultResult()` was written here and taken out again:
// it belongs to a protocol this query does not conform to, so it would have
// compiled as a method nobody calls, and there is no Swift compiler in this
// environment to notice. Prefer the version with fewer ways to be wrong.
