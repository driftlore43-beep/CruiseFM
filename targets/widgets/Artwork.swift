import SwiftUI

/**
 * The station's backdrop, and the last-played album cover.
 *
 * TWO DIFFERENT PLACES, for a reason that is not arbitrary.
 *
 * THE STATION IMAGE IS BUNDLED. A widget extension cannot read the app's
 * bundle — it is a separate process with its own — so the ten built-in
 * stations' blurred backdrops are copied into THIS target's folder and picked
 * up as its own resources. They are named by station id, so the snapshot only
 * has to carry the id it already carries. At 560px wide and ~24KB each they
 * cost 237KB for all ten, against 774KB for the app's own copies: a widget is
 * at most ~1080px across at 3x, and these are blurred anyway.
 *
 * THE ALBUM COVER IS WRITTEN AT RUNTIME, into the App Group container, by
 * `setArtwork` in CruiseWidgetsModule — it cannot be bundled because nobody
 * knows in advance what someone will play. The filename is agreed between the
 * two and must stay in step.
 *
 * A CUSTOM STATION HAS NO BUNDLED IMAGE and falls back to its colours. Its
 * photograph lives in the app's documents directory, which is outside the
 * shared container, so getting it across means copying it in when it is saved
 * — worth doing, not done.
 */
enum Art {
  /** Must match `artworkFile` in CruiseWidgetsModule.swift. */
  static let artworkFile = "last-artwork.jpg"
  static let appGroup = "group.com.driftlore.CruiseFM"

  /// A custom station's photograph, as written by `setStationImage`. Must
  /// match `stationFile` in CruiseWidgetsModule.swift.
  static func stationFile(_ id: String) -> String { "station-\(id).jpg" }

  /**
   * The backdrop for a station, from whichever of the two places has one.
   *
   * BUNDLED FIRST — the ten built-ins ship inside this extension, so they
   * cost no I/O and are always present. Then the App Group container, where
   * a CUSTOM station's photo is copied when it is saved; that is the only
   * route across, because the app's documents directory is outside anything
   * this process can see.
   *
   * Nil is a perfectly good answer: a custom station with no photo, or one
   * saved by a build older than the copying, falls back to its gradient.
   */
  static func station(_ id: String?) -> Image? {
    guard let id else { return nil }
    if let ui = UIImage(named: id) { return Image(uiImage: ui) }
    guard
      let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
      let ui = UIImage(contentsOfFile: dir.appendingPathComponent(stationFile(id)).path)
    else { return nil }
    return Image(uiImage: ui)
  }

  /**
   * WHAT GOES IN A PICTURE SLOT: the STATION'S OWN PHOTOGRAPH first, the
   * song's cover only if there is no photograph.
   *
   * THE OWNER PICKED THIS WAY ROUND, and her reason is the good one (03.09):
   * "do it the station cover so people can add their photos in." A custom
   * station can carry a photograph the listener chose themselves, and this is
   * what puts it on their Home Screen — the feature is invisible otherwise.
   *
   * IT IS ALSO THE ONE THAT IS ALWAYS THERE. The song's cover exists only
   * once someone has driven with a service that reports the track, and
   * Spotify caps full playback at five accounts, so most listeners are in
   * companion mode with none; a fresh install has none either. The station
   * photograph is BUNDLED in this extension for the ten built-ins and copied
   * into the App Group for a custom one: no network, never stale.
   *
   * The cover is kept as the second choice rather than dropped, so a custom
   * station with no photograph still shows something real.
   *
   * NOT USED BY THE DECK'S ROAD LOOK, deliberately: the station photo is
   * already the backdrop there, so using it again on the label would print
   * the same picture twice at two sizes. That one falls back to its printed
   * pressing.
   */
  static func cover(station id: String?) -> Image? {
    station(id) ?? lastPlayed()
  }

  /// The cover of the last song the app saw play, or nil if there wasn't one.
  static func lastPlayed() -> Image? {
    guard
      let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup),
      let data = try? Data(contentsOf: dir.appendingPathComponent(artworkFile)),
      let ui = UIImage(data: data)
    else { return nil }
    return Image(uiImage: ui)
  }
}

/**
 * The record.
 *
 * IT DOES NOT SPIN, AND IT CANNOT. iOS redraws a widget a handful of times a
 * day and the only thing allowed to move on its own is countdown text — true
 * of every app, not just this one. So this is drawn as a still record, which
 * is what a turntable looks like at a glance anyway.
 *
 * THE GROOVES ARE A TEXTURE, NOT A DIAGRAM. This drew nine rings once, on the
 * reasoning that a real density would be a grey smudge at widget size — and
 * the owner called it on 03.09: "improve the vinyls' design add grooved and a
 * bit of texture". Nine rings spaced wide apart read as a target printed on a
 * black disc. A record has hundreds, and what makes them read as CUT rather
 * than DRAWN is that each one is a dark trough with a hairline of light on the
 * wall the light falls on — the same finding the app's own Classic vinyl was
 * rebuilt around on 25.08.
 *
 * The pitch is held at ~1.7pt because below about 1.2 neighbouring rings
 * moire against the pixel grid, which is its own drawn-looking artefact.
 */
struct RecordView: View {
  /// The station's accent — the record's rim takes it, exactly as the app's
  /// Vinyl deck does, so the two cannot look like different objects.
  let accent: Color
  /// The last-played cover, drawn as the label. Nil falls back to a pressing.
  let label: Image?
  let size: CGFloat
  /// A printed label rather than a photographic one — the station's own
  /// pressing, which `pressing()` then prints the name and frequency onto.
  var plainLabel: Bool = false

  /// Pitch in points, not a count: the rings have to stay the same distance
  /// apart whatever the record's size, or a small one looks coarse beside a
  /// large one on the same Home Screen.
  private var pitch: CGFloat { 1.7 }
  private var innerEdge: CGFloat { 0.46 }   // where the label starts
  private var ringCount: Int {
    max(6, Int((size * (0.99 - innerEdge) / 2) / pitch))
  }

  var body: some View {
    ZStack {
      Circle().fill(Color(white: 0.045))
      // Every groove twice: the trough, then the lit wall just outside it.
      // One stroke alone is a line drawn on a surface; two is a cut into one.
      ForEach(0..<ringCount, id: \.self) { i in
        let d = size * 0.99 - CGFloat(i) * pitch * 2
        Circle()
          .stroke(Color.black.opacity(0.55), lineWidth: pitch * 0.62)
          .frame(width: d, height: d)
        Circle()
          .stroke(Color.white.opacity(0.055), lineWidth: 0.5)
          .frame(width: d + pitch * 0.66, height: d + pitch * 0.66)
      }
      // A single soft sheen. The app's deck learned the hard way that light
      // drawn as a hard-edged wedge reads as a drawn shape; falloff only.
      Circle()
        .fill(
          RadialGradient(
            colors: [.white.opacity(0.15), .clear],
            center: .init(x: 0.32, y: 0.24), startRadius: 0, endRadius: size * 0.62))
      // The raised lip a pressing has at its edge.
      Circle().stroke(Color.white.opacity(0.13), lineWidth: 1)
        .frame(width: size * 0.985, height: size * 0.985)
      // The label, and the album cover if there is one.
      Group {
        if let label {
          label.resizable().aspectRatio(contentMode: .fill)
        } else if plainLabel {
          Circle().fill(
            RadialGradient(colors: [Color(hex: "#2b3550"), Color(hex: "#141a29")],
                           center: .init(x: 0.38, y: 0.32),
                           startRadius: 0, endRadius: size * 0.30))
        } else {
          Circle().fill(accent.opacity(0.85))
        }
      }
      .frame(width: size * 0.42, height: size * 0.42)
      .clipShape(Circle())
      .overlay(Circle().stroke(Color.black.opacity(0.55), lineWidth: 1)
                 .frame(width: size * 0.42, height: size * 0.42))
      // Spindle hole — small, and the one place the backdrop shows through.
      Circle().fill(Color.black.opacity(0.55)).frame(width: size * 0.055, height: size * 0.055)
      Circle().stroke(accent.opacity(0.55), lineWidth: 0.8)
    }
    .frame(width: size, height: size)
  }
}
