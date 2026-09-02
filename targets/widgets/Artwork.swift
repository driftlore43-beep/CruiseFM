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

  /// The blurred backdrop for a built-in station, or nil for a custom one.
  static func station(_ id: String?) -> Image? {
    guard let id, let ui = UIImage(named: id) else { return nil }
    return Image(uiImage: ui)
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
 * The grooves are concentric rings rather than a texture because at widget
 * size (~70pt) a texture reads as noise; the app's own deck draws 26 of them
 * across a 350pt platter, and the same density here would be a grey smudge.
 */
struct RecordView: View {
  /// The station's accent — the record's rim and grooves take it, exactly as
  /// the app's Vinyl deck does, so the two cannot look like different objects.
  let accent: Color
  /// The last-played cover, drawn as the label. Nil falls back to the accent.
  let label: Image?
  let size: CGFloat

  private var grooveCount: Int { size > 90 ? 9 : 6 }

  var body: some View {
    ZStack {
      Circle().fill(Color(white: 0.055))
      // Grooves: dark cuts with a hairline of light on the outer wall, which
      // is what makes them read as pressed in rather than drawn on.
      ForEach(0..<grooveCount, id: \.self) { i in
        let t = CGFloat(i) / CGFloat(grooveCount)
        let d = size * (0.99 - t * 0.42)
        Circle()
          .stroke(accent.opacity(0.10 + 0.05 * (1 - t)), lineWidth: 0.6)
          .frame(width: d, height: d)
      }
      // A single soft sheen. The app's deck learned the hard way that light
      // drawn as a hard-edged wedge reads as a drawn shape; falloff only.
      Circle()
        .fill(
          RadialGradient(
            colors: [.white.opacity(0.16), .clear],
            center: .init(x: 0.32, y: 0.24), startRadius: 0, endRadius: size * 0.62))
      // The label, and the album cover if there is one.
      Group {
        if let label {
          label.resizable().aspectRatio(contentMode: .fill)
        } else {
          Circle().fill(accent.opacity(0.85))
        }
      }
      .frame(width: size * 0.42, height: size * 0.42)
      .clipShape(Circle())
      // Spindle hole — small, and the one place the backdrop shows through.
      Circle().fill(Color.black.opacity(0.55)).frame(width: size * 0.055, height: size * 0.055)
      Circle().stroke(accent.opacity(0.55), lineWidth: 0.8)
    }
    .frame(width: size, height: size)
  }
}
