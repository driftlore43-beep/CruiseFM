import AppIntents
import WidgetKit

/**
 * The Deck's three looks, and the setting that picks between them.
 *
 * ONE WIDGET, NOT THREE. Every look could have been its own entry in the
 * widget gallery, and the gallery would then be seven items long for an app
 * with four ideas in it. A setting keeps it at one, lets someone change their
 * mind without deleting the widget and adding it back, and — the part that
 * matters for later — means a fourth look costs one case here rather than
 * another row everybody has to scroll past.
 *
 * IT ALSO ALLOWS TWO AT ONCE: iOS treats each placed copy of a configurable
 * widget as separate, so the same person can keep The Label on one page and
 * On the Road on another.
 *
 * iOS 17 AND LATER ONLY. `AppIntentConfiguration` did not exist before it.
 * Older phones get the plain widget with `DeckLook.defaultLook` — see the two
 * configurations at the foot of VinylWidget.swift, which is also why the two
 * share a `kind`: a widget already sitting on someone's Home Screen from
 * build 39 keeps its place rather than vanishing.
 */
@available(iOSApplicationExtension 17.0, *)
enum DeckLook: String, AppEnum {
  /// The record on the station's own place — the road, the mood, the colour.
  case road
  /// The label is the subject: station and frequency printed on the pressing.
  case label
  /// The record beside a lit receiver window — the object and the radio.
  case set

  /// What a phone too old for the setting gets, and the value a fresh widget
  /// starts on. The Road reads at a glance and needs no photograph to work,
  /// so it is the safest of the three to hand someone who cannot change it.
  static let defaultLook: DeckLook = .road

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Look"
  static var caseDisplayRepresentations: [DeckLook: DisplayRepresentation] = [
    .road: DisplayRepresentation(title: "On the road",
                                 subtitle: "The record over your station's own picture"),
    .label: DisplayRepresentation(title: "The label",
                                  subtitle: "The pressing, with the song printed beside it"),
    .set: DisplayRepresentation(title: "On the set",
                                subtitle: "The record next to a lit receiver"),
  ]
}

@available(iOSApplicationExtension 17.0, *)
struct DeckLookIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "On the Deck"
  static var description = IntentDescription("Choose how the record is drawn.")

  @Parameter(title: "Look", default: .road)
  var look: DeckLook

  init() {}
  init(look: DeckLook) { self.look = look }
}
