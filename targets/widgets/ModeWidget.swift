import AppIntents
import SwiftUI
import WidgetKit

/**
 * THE MODE, AS AN OBJECT — a small tile carrying the thing itself.
 *
 * THREE LOOKS OF ONE IDEA, so one gallery row rather than three: the mirror
 * ball, the CD and the record all answer "your station's mode, drawn as the
 * object it is named after". The record joined them on 09.09 (owner: "the
 * vinyl square widget should be categorised in the 'look' section with the CD
 * and mirror ball") — it had been the Deck's own small family, in a different
 * row, answering the same question. THE DECK IS MEDIUM-ONLY NOW.
 *
 * NONE OF THEM SAYS ANYTHING IT CANNOT KNOW. The ball carries the station's
 * name; the CD carries no words at all (owner, 03.09: "the CD Mode should
 * remove all texts"); the record carries its frequency on the label, which is
 * the only thing naming the station once its name comes off. Nothing here
 * claims to be playing.
 *
 * ALL THREE FILL THE TILE. They were drawn small enough to leave room for a
 * caption underneath, which is backwards for a widget whose whole subject is
 * the object (owner, 09.09: "where it takes up most of the widget's space").
 *
 * THE DISC IS THE ONE PLACE THE SONG'S COVER COMES FIRST. Everything else in
 * the set draws the station's photograph, so a listener's own custom-station
 * picture shows up — but a disc with a record sleeve printed on it is the
 * whole idea of this one, and the owner kept it that way when she made that
 * call (03.09: "I'd rather keep the album art for the cd mode"). It falls
 * back to the station's photograph, so no cover still means a real picture.
 * See Art.songCover, which exists for this and nothing else.
 *
 * AND NEITHER SPINS. iOS redraws a widget a handful of times a day and only
 * countdown text may animate itself — true of every app. A still ball is what
 * one looks like in a photograph anyway.
 */
@available(iOSApplicationExtension 17.0, *)
enum ModeLook: String, AppEnum {
  case mirrorBall
  case cd
  case record

  static let defaultLook: ModeLook = .mirrorBall

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Look"
  static var caseDisplayRepresentations: [ModeLook: DisplayRepresentation] = [
    .mirrorBall: DisplayRepresentation(title: "Mirror ball",
                                       subtitle: "The ball, lit the way the app draws it"),
    .cd: DisplayRepresentation(title: "CD",
                               subtitle: "The last song, printed on a disc in its case"),
    .record: DisplayRepresentation(title: "Record",
                                   subtitle: "The station's own pressing, and nothing else"),
  ]
}

@available(iOSApplicationExtension 17.0, *)
struct ModeLookIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "The Mode"
  static var description = IntentDescription("Choose which object to show.")

  @Parameter(title: "Look", default: .mirrorBall)
  var look: ModeLook

  init() {}
  init(look: ModeLook) { self.look = look }
}

enum ModeStyle { case mirrorBall, cd, record }

struct ModeEntry: TimelineEntry {
  let date: Date
  let station: WidgetStation?
  let lastPlayed: LastPlayedInfo?
  let ready: Bool
  let style: ModeStyle
}

private func modeEntry(_ style: ModeStyle) -> ModeEntry {
  guard let snap = SnapshotStore.load() else {
    return ModeEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: style)
  }
  let station = snap.lastDrive ?? snap.onAir.first
  return ModeEntry(date: Date(), station: station, lastPlayed: snap.lastPlayed,
                   ready: true, style: style)
}

private func modeTimeline(_ style: ModeStyle) -> Timeline<ModeEntry> {
  Timeline(entries: [modeEntry(style)], policy: .after(Date().addingTimeInterval(3600)))
}

struct ModeProvider: TimelineProvider {
  func placeholder(in c: Context) -> ModeEntry {
    ModeEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .mirrorBall)
  }
  func getSnapshot(in c: Context, completion: @escaping (ModeEntry) -> Void) {
    completion(modeEntry(.mirrorBall))
  }
  func getTimeline(in c: Context, completion: @escaping (Timeline<ModeEntry>) -> Void) {
    completion(modeTimeline(.mirrorBall))
  }
}

@available(iOSApplicationExtension 17.0, *)
struct ModeIntentProvider: AppIntentTimelineProvider {
  func placeholder(in c: Context) -> ModeEntry {
    ModeEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .mirrorBall)
  }
  func snapshot(for configuration: ModeLookIntent, in c: Context) async -> ModeEntry {
    modeEntry(style(configuration.look))
  }
  func timeline(for configuration: ModeLookIntent, in c: Context) async -> Timeline<ModeEntry> {
    modeTimeline(style(configuration.look))
  }
  private func style(_ look: ModeLook) -> ModeStyle {
    switch look {
    case .mirrorBall: return .mirrorBall
    case .cd:         return .cd
    case .record:     return .record
    }
  }
}

// ── the drawing ────────────────────────────────────────────────────────────

struct ModeView: View {
  var entry: ModeEntry

  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      switch entry.style {
      case .mirrorBall: ball(s)
      case .cd:         disc(s)
      case .record:     record(s)
      }
    }
  }

  /**
   * THE BALL IS CENTRED IN THE TILE, NOT STACKED ABOVE A CAPTION.
   *
   * It used to sit in a VStack with its stem, a spacer and the station's name,
   * which came to about 162pt inside a ~158pt tile — so the ball was squeezed
   * to 108 AND pushed high, which is what the owner saw ("let it sit more
   * central in the widget"). The name is now an OVERLAY at the foot rather
   * than a row that has to be paid for out of the ball's height, so the ball
   * takes the whole tile to centre itself in and can be much larger.
   *
   * The stem hangs off the ball itself for the same reason: a ball hangs from
   * something, but that something must not push it down the tile.
   */
  private func ball(_ s: WidgetStation) -> some View {
    ZStack {
      RadialGradient(colors: [Color(hex: "#241a2b"), Color(hex: "#07050b")],
                     center: .init(x: 0.5, y: 0.34), startRadius: 0, endRadius: 150)
      BeamField()
      MirrorBall(size: 126, rows: 17, cols: 30)
        .overlay(alignment: .top) {
          Rectangle().fill(.white.opacity(0.30))
            .frame(width: 1.5, height: 30).offset(y: -28)
        }
        // Nudged up by the small amount the stem needs, so the BALL reads as
        // centred rather than the ball-and-stem together.
        .offset(y: 4)
      VStack {
        Spacer(minLength: 0)
        Text(s.name).font(.system(size: 13, weight: .heavy))
          .foregroundColor(.white).lineLimit(1).minimumScaleFactor(0.7)
          .shadow(color: .black.opacity(0.75), radius: 5)
          .padding(.horizontal, 10).padding(.bottom, 9)
      }
    }
    .widgetURL(s.url(mode: "disco"))
  }

  // NOT ONE WORD ON IT. The disc carries a picture and nothing else; the
  // case is what says which app it belongs to.
  //
  // HOW BIG THE CASE CAN BE IS SET BY THE TILE'S OWN CORNERS, not by taste.
  // A widget clips its content to a rounded rectangle of about 22pt radius,
  // so a case drawn with a 4pt radius close to the edge has its four corners
  // sliced off — which is the owner's "ensure the CD case is not cut off from
  // the widget shape". A corner survives when its own inset plus its own
  // radius reach the tile's: JewelCase is inset 10 with a 14pt radius, i.e.
  // 24 against the tile's ~22, so it clears with a little to spare and is
  // still very nearly the whole tile.
  private func disc(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [Color(hex: "#1c1f26"), Color(hex: "#080a0e")],
                     startPoint: .topLeading, endPoint: .bottomTrailing)
      JewelCase()
      // Centred on the case's own interior rather than on the tile: the hinge
      // spine takes 17pt off the left, so dead centre would leave the disc
      // visibly closer to the hinge than to the opposite wall.
      CompactDisc(cover: Art.songCover(station: s.image), accent: s.accentColor, size: 110)
        .offset(x: 8)
    }
    .widgetURL(s.url(mode: "cd"))
  }

  /**
   * THE RECORD, AND NOTHING ELSE (owner, 09.09: "remove the station's text so
   * it's just the vinyl").
   *
   * This tile used to be the Deck's own small family, sitting in a different
   * gallery row from the ball and the disc even though it answers exactly the
   * same question — "your mode, as the object it is named after". It belongs
   * here, and moving it is what let the record grow: with no caption to pay
   * for it takes the whole tile.
   *
   * The frequency stays ON the label, because with the station's name gone it
   * is the only thing naming the station, and the label is the one place on a
   * record where type belongs.
   */
  private func record(_ s: WidgetStation) -> some View {
    ZStack {
      RadialGradient(colors: [Color(hex: "#1a1a1f"), Color(hex: "#08080a")],
                     center: .init(x: 0.38, y: 0.30), startRadius: 0, endRadius: 150)
      ZStack {
        RecordView(accent: s.accentColor, label: nil, size: 132, plainLabel: true)
        DialText(dial: s.dial, size: 132 * 0.105, color: Color(hex: "#ffe7c2"))
      }
    }
    .widgetURL(s.url(mode: "vinyl"))
  }
}

/// Beams thrown off the ball. Fixed, never turning — a lamp is bolted to the
/// room, and there is nothing here that could animate anyway.
private struct BeamField: View {
  var body: some View {
    ZStack {
      ForEach(Array([(-74.0, 0.15), (-48.0, 0.10), (-20.0, 0.13),
                     (14.0, 0.09), (42.0, 0.14), (68.0, 0.10)].enumerated()),
              id: \.offset) { _, b in
        LinearGradient(colors: [Color(hex: "#d6e6ff").opacity(b.1), .clear],
                       startPoint: .top, endPoint: .bottom)
          .frame(width: 1.2, height: 190)
          .rotationEffect(.degrees(b.0), anchor: .top)
          .offset(y: -46)
      }
    }
    .allowsHitTesting(false)
  }
}

/**
 * The ball, built the way the APP builds it (owner, 03.09: "mirror ball needs
 * to reflect the same as it is on the app").
 *
 * It is a real sphere projection, not a grid of squares squeezed at the edges:
 * each mirror is a quad between two latitudes and two longitudes, back-face
 * culled, so rows compress toward the poles and columns converge on their own.
 *
 * BRIGHTNESS COMES FROM WHERE A MIRROR POINTS, NOT WHERE IT SITS. The
 * reflection direction is r = 2(n·v)n − v, and a mirror is bright when that
 * points at one of three fixed lamps. Neighbours point about eleven degrees
 * apart and reflection doubles that, so they land on completely different
 * parts of the room and come out wildly different — the dark-beside-bright
 * checkerboard is what reads as chrome. A positional gradient, which is what
 * this drew before, reads as a painted sphere.
 *
 * BRICK BOND (alternate rows offset half a column) is how a real ball is
 * built, and it also stops the columns stacking into continuous vertical
 * seams that read as a drawn grid.
 *
 * Everything here is computed once in `tiles` and never animated.
 */
struct MirrorBall: View {
  let size: CGFloat
  var rows: Int = 15
  var cols: Int = 26

  var body: some View {
    ZStack {
      // The body warms with the lamps — the prototype's party ball sits on
      // #332536, not the neutral #2a2c33 an unlit one does.
      Circle().fill(
        RadialGradient(colors: [Color(hex: "#332536"), Color(hex: "#0d0812")],
                       center: .init(x: 0.38, y: 0.30), startRadius: 0, endRadius: size * 0.62))
      ForEach(tiles, id: \.id) { t in
        Path { p in
          p.move(to: t.pts[0])
          for q in t.pts.dropFirst() { p.addLine(to: q) }
          p.closeSubpath()
        }
        .fill(t.tint)
      }
      Circle().stroke(.white.opacity(0.10), lineWidth: 1)
    }
    .frame(width: size, height: size)
    .shadow(color: Color(hex: "#e696e6").opacity(0.40), radius: 18)
  }

  private struct Tile { let id: Int; let pts: [CGPoint]; let v: Double; let tint: Color }

  private var tiles: [Tile] {
    let r = size / 2, tilt = -0.16, shrink = 0.91
    let lamps: [(Double, Double, Double)] = [
      norm((-0.58, -0.55, 0.60)), norm((0.66, -0.10, 0.74)), norm((0.06, 0.62, 0.78)),
    ]
    // ONE COLOUR PER LAMP — pink, blue, purple. Owner, 03.09: "reflect off
    // pretty pink, blue and purple colours - as if it's a party happening."
    // The prototype has carried this since round 3 and the Swift never did:
    // every tile was filled `Color(white:)`, so the ball shipped as plain
    // silver and she photographed it that way.
    //
    // THE TINT GOES WHERE THE LIGHT LANDS, WHICH IS THE WHOLE RULE. A mirror
    // no lamp catches stays silver; one caught square-on goes nearly its
    // lamp's own colour; one between two blends — the same weights that
    // already decide its brightness, carried into colour. That keeps the
    // material neutral chrome and puts the mood entirely in the lighting,
    // which is the app's own Mirror Ball rule (round 20, and round 22's
    // "nothing structural on this ball may carry a hue").
    let lampColors: [(Double, Double, Double)] = [
      (255, 120, 190), (120, 175, 255), (190, 125, 255),
    ]
    var out: [Tile] = []
    var seed = 11
    func rnd() -> Double {                   // a fixed shuffle, so the ball is
      seed = (seed &* 1103515245 &+ 12345) & 0x7fffffff   // the same every draw
      return Double(seed % 1000) / 1000.0 - 0.5
    }
    for i in 0..<rows {
      let la0 = .pi * (Double(i) / Double(rows)) - .pi / 2
      let la1 = .pi * (Double(i + 1) / Double(rows)) - .pi / 2
      let bond = i % 2 == 0 ? 0.0 : 0.5
      for j in 0..<cols {
        let lo0 = 2 * .pi * ((Double(j) + bond) / Double(cols))
        let lo1 = 2 * .pi * ((Double(j) + 1 + bond) / Double(cols))
        var pts: [CGPoint] = []
        var ax = 0.0, ay = 0.0, az = 0.0
        var visible = true
        for (la, lo) in [(la0, lo0), (la0, lo1), (la1, lo1), (la1, lo0)] {
          let x = cos(la) * sin(lo), y = sin(la), z = cos(la) * cos(lo)
          let yt = y * cos(tilt) - z * sin(tilt)
          let zt = y * sin(tilt) + z * cos(tilt)
          if zt < 0.03 { visible = false; break }        // back-face cull
          pts.append(CGPoint(x: x, y: yt))
          ax += x; ay += yt; az += zt
        }
        guard visible, pts.count == 4 else { continue }
        // Shrink toward the tile's own centre — the GAP is the grid.
        let mx = pts.map(\.x).reduce(0, +) / 4, my = pts.map(\.y).reduce(0, +) / 4
        let quad = pts.map { CGPoint(x: r + (mx + ($0.x - mx) * shrink) * r,
                                     y: r - (my + ($0.y - my) * shrink) * r) }
        let n = norm((ax / 4, ay / 4, az / 4))
        let ndv = n.2                                    // n · (0,0,1)
        let refl = norm((2 * ndv * n.0, 2 * ndv * n.1, 2 * ndv * n.2 - 1))
        // LIGHTER, AND WITH MORE COLOUR IN THE CATCHES (owner, 09.09: "lighten
        // up the tiles, enhance details on the reflections"). MEASURED across
        // all 209 visible mirrors rather than eyeballed: median brightness
        // 104.5 -> 117.0, mirrors above 200 3.3% -> 9.1%, mirrors carrying a
        // lamp's colour 18.2% -> 26.3%, mean colour spread 8.6 -> 15.7.
        //
        // THE LOBE WIDENS RATHER THAN THE FLOOR RISING, and that is the whole
        // trick — the app's own ball proved on 18.08 that lifting the ambient
        // alone raises the median AND kills the highlights (its share above
        // 200 fell 4.1% -> 0.6%, i.e. a uniform grey sphere). A wider lobe
        // means MORE MIRRORS CATCHING A LAMP, so the median, the highlights
        // and the colour all rise together and a lit mirror stays plainly
        // brighter than its neighbour, which is the cue that reads as chrome.
        // The extra scatter is the other half of that: neighbouring mirrors
        // reflect different parts of the room, so they must disagree.
        var b = 0.23
        var w: [Double] = []
        for L in lamps {
          let d = max(0, refl.0 * L.0 + refl.1 * L.1 + refl.2 * L.2)
          let lw = pow(d, 6)
          w.append(lw)
          b += 0.86 * lw
        }
        b += rnd() * 0.36          // each mirror catches its own bit of room
        b = min(1, max(0.05, b))
        let v = 0.10 + 0.90 * pow(b, 0.72)
        let wsum = w.reduce(0, +)
        var tint = Color(white: v)
        if wsum > 0.002 {
          let g = 255.0 * v
          var cr = 0.0, cg = 0.0, cb = 0.0
          for (weight, lc) in zip(w, lampColors) {
            cr += weight * lc.0; cg += weight * lc.1; cb += weight * lc.2
          }
          cr /= wsum; cg /= wsum; cb /= wsum
          let k = min(1.0, wsum * 2.0) * 0.78
          tint = Color(red:   min(1, max(0, (g * (1 - k) + cr * k) / 255)),
                       green: min(1, max(0, (g * (1 - k) + cg * k) / 255)),
                       blue:  min(1, max(0, (g * (1 - k) + cb * k) / 255)))
        }
        out.append(Tile(id: i * cols + j, pts: quad, v: v, tint: tint))
      }
    }
    return out
  }

  private func norm(_ v: (Double, Double, Double)) -> (Double, Double, Double) {
    let m = (v.0 * v.0 + v.1 * v.1 + v.2 * v.2).squareRoot()
    return m == 0 ? v : (v.0 / m, v.1 / m, v.2 / m)
  }
}

/**
 * The jewel case. Owner, 03.09: "don't forget the case it usually is in."
 *
 * WHAT MAKES IT READ AS A CASE is the hinge spine down one side and the four
 * corner posts that hold the tray — not the pane of plastic. The first
 * attempt had only the pane and a couple of floating blocks, and read as
 * glass laid over a disc.
 */
private struct JewelCase: View {
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: caseRadius)
        .fill(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.02), .white.opacity(0.10)],
                             startPoint: .topLeading, endPoint: .bottomTrailing))
        .overlay(RoundedRectangle(cornerRadius: caseRadius).stroke(.white.opacity(0.30), lineWidth: 2))

      // hinge spine
      HStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.04)],
                       startPoint: .leading, endPoint: .trailing)
          .frame(width: 17)
          .overlay(HStack { Spacer(); Rectangle().fill(.white.opacity(0.20)).frame(width: 1) })
          .overlay(
            VStack(spacing: 14) {
              ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 2)
                  .fill(.white.opacity(0.16))
                  .overlay(RoundedRectangle(cornerRadius: 2).stroke(.white.opacity(0.24), lineWidth: 1))
                  .frame(width: 11, height: 19)
              }
            })
        Spacer(minLength: 0)
      }

      // corner posts
      VStack {
        HStack { post(.topLeading); Spacer(); post(.topTrailing) }
        Spacer()
        HStack { post(.bottomLeading); Spacer(); post(.bottomTrailing) }
      }
      .padding(7)

      // one diagonal sweep of light on the plastic
      RoundedRectangle(cornerRadius: caseRadius)
        .fill(LinearGradient(stops: [
          .init(color: .white.opacity(0.20), location: 0.04),
          .init(color: .clear, location: 0.26),
          .init(color: .clear, location: 0.74),
          .init(color: .white.opacity(0.10), location: 0.96),
        ], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
    .padding(caseInset)
    .allowsHitTesting(false)
  }

  /// A CORNER SURVIVES WHEN ITS INSET PLUS ITS RADIUS REACH THE TILE'S.
  /// A widget clips to a rounded rectangle of roughly 22pt, so the old
  /// 4pt-radius case sitting 11pt in had its four corners sliced off by the
  /// tile — the owner's "ensure the CD case is not cut off from the widget
  /// shape". 10 + 14 = 24 clears it, and a real slimline case has generous
  /// corners anyway (the app's own CD deck settled that on 03.08).
  private var caseInset: CGFloat { 10 }
  private var caseRadius: CGFloat { 14 }

  private func post(_ corner: Alignment) -> some View {
    let top = corner == .topLeading || corner == .topTrailing
    let leading = corner == .topLeading || corner == .bottomLeading
    return ZStack {
      VStack { if !top { Spacer() }; Rectangle().frame(height: 2.5); if top { Spacer() } }
      HStack { if !leading { Spacer() }; Rectangle().frame(width: 2.5); if leading { Spacer() } }
    }
    .foregroundColor(.white.opacity(0.34))
    .frame(width: 15, height: 15)
  }
}

/// A disc with the last cover printed on it, under the diffraction the plastic
/// throws. The rainbow sits OVER the art rather than under it, because a CD's
/// sheen is on its surface — the app's own CD deck settled this on 03.08.
struct CompactDisc: View {
  let cover: Image?
  let accent: Color

  /// The pressed rings, as explicit stops. Built here rather than inline so
  /// the locations are unambiguously CGFloat — an implicit Double bridge is
  /// the kind of thing that compiles locally and costs a build cycle when it
  /// does not, and Swift cannot be compiled in the environment this is
  /// written in.
  private func ringStops() -> [Gradient.Stop] {
    var out: [Gradient.Stop] = []
    var t: CGFloat = 0
    while t < 1 {
      out.append(Gradient.Stop(color: .white.opacity(0.08), location: t))
      out.append(Gradient.Stop(color: .clear, location: min(1, t + 0.0225)))
      t += 0.045
    }
    return out
  }
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle().fill(Color(white: 0.08))
      if let cover {
        // DARKER THAN LOOKS RIGHT ON ITS OWN, deliberately. The rainbow is an
        // `overlay` blend, which mutes against a bright ground — the disc
        // shipped as a pale wash for exactly this reason, and no amount of
        // opacity on the gradient fixes it while the photo underneath is
        // near full brightness. The prototype takes the art to .72 first,
        // and that is what gives the sheen something to sit on.
        cover.resizable().aspectRatio(contentMode: .fill)
          .frame(width: size, height: size)
          .clipShape(Circle())
          .brightness(-0.22).saturation(1.15)
      } else {
        Circle().fill(accent.opacity(0.55))
      }
      // TWO PASSES, NOT ONE. `overlay` carries the hue but darkens as it goes;
      // a second, weaker pass in `screen` puts the light back without washing
      // the colour out. Offset 180° from the first so the two do not stack
      // their own peaks on top of each other.
      Circle().fill(
        AngularGradient(colors: [Color(hex: "#6ad0ff"), Color(hex: "#b98cff"), Color(hex: "#ff9ad0"),
                                 Color(hex: "#ffd68a"), Color(hex: "#a8ffcf"), Color(hex: "#6ad0ff")],
                        center: .center, angle: .degrees(20)))
        .blendMode(.overlay)
      Circle().fill(
        AngularGradient(colors: [Color(hex: "#6ad0ff"), Color(hex: "#b98cff"), Color(hex: "#ff9ad0"),
                                 Color(hex: "#ffd68a"), Color(hex: "#a8ffcf"), Color(hex: "#6ad0ff")],
                        center: .center, angle: .degrees(200)))
        .blendMode(.screen)
        .opacity(0.5)
      // The pressed rings. Fine enough to read as texture rather than as
      // drawn circles — the same pitch rule the app's Classic vinyl settled
      // on (25.08): below about 1.2pt apart they moiré, above ~4 they read
      // as a target printed on a disc.
      Circle().fill(
        RadialGradient(stops: ringStops(), center: .center,
                       startRadius: 0, endRadius: size / 2))
      // the single specular sweep
      Circle().fill(
        LinearGradient(stops: [
          .init(color: .white.opacity(0.34), location: 0.05),
          .init(color: .clear, location: 0.28),
          .init(color: .clear, location: 0.68),
          .init(color: .white.opacity(0.20), location: 0.92),
        ], startPoint: .topLeading, endPoint: .bottomTrailing))

      // ── WHAT MAKES IT READ AS AN OBJECT RATHER THAN A PRINTED CIRCLE ────
      //
      // Owner, 09.09: "make sure that the CD has the same shading and
      // reflections as the one in the app. It currently lacks dimensions."
      // Everything below is either a REAL FEATURE OF A DISC or a lighting
      // behaviour — none of it is a mark drawn on top, which is the rule the
      // app's own decks arrived at (04.09: at this size premium can only come
      // from how the object behaves in light).

      // THE DISC IS DOMED, so it falls away at the rim. A flat fill lit
      // evenly is exactly what "lacks dimension" describes.
      Circle().fill(
        RadialGradient(stops: [
          .init(color: .clear, location: 0),
          .init(color: .clear, location: 0.72),
          .init(color: .black.opacity(0.30), location: 1),
        ], center: .init(x: 0.40, y: 0.34), startRadius: 0, endRadius: size * 0.56))

      // THE STACKING RING at 0.62R — the moulded step a real CD carries so a
      // stack of them never touches face to face. A trough with a lit wall
      // just outside it, which is what makes a step read as pressed in
      // rather than drawn on (the app's Classic vinyl grooves, 25.08).
      Circle().stroke(.black.opacity(0.34), lineWidth: 1.6)
        .frame(width: size * 0.62, height: size * 0.62)
      Circle().stroke(.white.opacity(0.26), lineWidth: 1)
        .frame(width: size * 0.655, height: size * 0.655)

      // THE CLEAR MIRROR BAND just outside the hub: a pressing is not coated
      // edge to edge, and that glassy land is the second-strongest cue after
      // the rainbow that this is a disc.
      Circle().stroke(.white.opacity(0.20), lineWidth: size * 0.035)
        .frame(width: size * 0.375, height: size * 0.375)

      // hub ring and the four gripper holes the tray's spindle grips by
      Circle().fill(Color(white: 0.88).opacity(0.60))
        .frame(width: size * 0.31, height: size * 0.31)
        .overlay(Circle().stroke(.white.opacity(0.45), lineWidth: 1)
                   .frame(width: size * 0.31, height: size * 0.31))
      ForEach(0..<4, id: \.self) { i in
        Circle().fill(.black.opacity(0.34))
          .frame(width: size * 0.030, height: size * 0.030)
          .offset(x: 0, y: -size * 0.1175)
          .rotationEffect(.degrees(Double(i) * 90 + 45))
      }
      Circle().fill(Color(hex: "#090a0e"))
        .frame(width: size * 0.14, height: size * 0.14)
        .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 1)
                   .frame(width: size * 0.14, height: size * 0.14))

      // THE RIM IS DIRECTIONAL. A `Circle().stroke(.white.opacity(x))` is one
      // brightness the whole way round, which is a drawn circle — this file
      // has now talked three components out of exactly that. An edge is
      // bright where the lamp is and dark opposite, so it is a sweep.
      Circle().strokeBorder(
        AngularGradient(stops: [
          .init(color: .white.opacity(0.55), location: 0),
          .init(color: .white.opacity(0.10), location: 0.28),
          .init(color: .white.opacity(0.34), location: 0.55),
          .init(color: .white.opacity(0.06), location: 0.80),
          .init(color: .white.opacity(0.55), location: 1),
        ], center: .center, angle: .degrees(-125)), lineWidth: 1.4)
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
    .shadow(color: .black.opacity(0.62), radius: 9, y: 5)
  }
}

// ── the two configurations ─────────────────────────────────────────────────

@available(iOSApplicationExtension 17.0, *)
struct ModeConfigurableWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "CruiseMode", intent: ModeLookIntent.self,
                           provider: ModeIntentProvider()) { entry in
      ModeView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("The Mode")
    .description("Your mode as an object. Long-press to switch between the mirror ball and the CD.")
    .supportedFamilies([.systemSmall])
    .cruiseFullBleed()
  }
}

struct ModeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseMode", provider: ModeProvider()) { entry in
      ModeView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("The Mode")
    .description("The mirror ball, lit the way the app draws it.")
    .supportedFamilies([.systemSmall])
    .cruiseFullBleed()
  }
}
