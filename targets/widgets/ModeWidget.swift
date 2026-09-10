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
   * central in the widget"). The name is now gone entirely (owner, 10.09:
   * "the mirror ball should remove the station name at the bottom") — she had
   * asked for the name once, on 09.09, and dropping it is a straight reversal
   * of that, kept because it is the newer instruction. Every other widget in
   * this row (the record, the CD) already carries no words at all, so the
   * ball now matches: JUST THE BALL, which is also what let it grow in the
   * first place.
   *
   * The stem hangs off the ball itself for the same reason as before: a ball
   * hangs from something, but that something must not push it down the tile.
   */
  private func ball(_ s: WidgetStation) -> some View {
    ZStack {
      // A GENUINE HALO, NOT A UNIFORM WASH (owner, 10.09: "a soft radial
      // purple halo behind it rather than the current more uniform purple
      // haze. The centre should glow and the corners should stay almost
      // black"). The old radius (150, against a ~158pt tile) meant the
      // gradient barely moved across the visible area — the corners sat at
      // about 75% of the way to black rather than genuinely dark, which is
      // exactly "uniform" rather than "glowing". A tighter radius plus a
      // brighter, more saturated core stop is what turns a wash into a glow.
      RadialGradient(colors: [Color(hex: "#4a3160"), Color(hex: "#241a2b"), Color(hex: "#050308")],
                     center: .init(x: 0.5, y: 0.34), startRadius: 0, endRadius: 100)
      BeamField()
      MirrorBall(size: 126, rows: 17, cols: 30)
        .overlay(alignment: .top) {
          // THIN AND METALLIC, FADING INTO THE GLOW (owner, 10.09: "make it
          // thinner and slightly metallic instead of the current thick
          // grey-purple strip. It could disappear subtly into the top glow").
          // A flat 1.5pt rectangle at one flat opacity reads as a drawn bar
          // at this scale; a wire is round and catches light along its
          // length, so it needs a highlight in its OWN middle rather than one
          // flat tone, and it must fade to nothing at both ends — into the
          // glow at the top, and short of where it meets the ball, so there
          // is no hard seam where metal supposedly meets chrome.
          LinearGradient(stops: [
            .init(color: .clear, location: 0),
            .init(color: Color(hex: "#c7d2e8").opacity(0.55), location: 0.35),
            .init(color: Color(hex: "#eef3ff").opacity(0.80), location: 0.55),
            .init(color: Color(hex: "#c7d2e8").opacity(0.40), location: 0.80),
            .init(color: .clear, location: 1),
          ], startPoint: .top, endPoint: .bottom)
            .frame(width: 1, height: 30).offset(y: -28)
        }
        // Nudged up by the small amount the stem needs, so the BALL reads as
        // centred rather than the ball-and-stem together.
        .offset(y: 4)
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
  // radius reach the tile's: JewelCase is inset 8 with a 16pt radius, i.e.
  // 24 against the tile's ~22, so it clears with a little to spare and is
  // still very nearly the whole tile.
  private func disc(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [Color(hex: "#1c1f26"), Color(hex: "#080a0e")],
                     startPoint: .topLeading, endPoint: .bottomTrailing)
      JewelCase()
      // A SOFT GLOW BEHIND THE DISC (owner, 10.09: "add a soft glow/shadow
      // behind the CD"). The disc already casts a contact shadow onto the
      // case, which is depth — this is light, the same distinction the app's
      // own decks draw everywhere else, so it is the station's own colour
      // rather than plain black. `.blur` is a real modifier here, unlike the
      // React Native SVG side of this app, which has none — so this is
      // genuine falloff rather than a stack of stepped rings.
      Circle().fill(s.accentColor.opacity(0.32))
        .frame(width: 138, height: 138)
        .blur(radius: 20)
        .offset(x: 6)
      // THE DISC ALL BUT FILLS THE CASE (owner, 10.09: "the CD is still quite
      // small, I wanted the CD to fit like the 3rd image where the edges are
      // close to the case"). 114 -> 124, and the ten points came from the two
      // things standing in its way rather than from wishful thinking:
      //
      //   THE HORIZONTAL IS THE BINDING AXIS, because the hinge eats one side.
      //   On a ~158pt tile the case now runs x 8..150, the spine takes 12 off
      //   the left, so the INTERIOR is x 20..150 — 130 wide, centred at 85,
      //   i.e. 6pt right of the tile's own centre, which is where the offset
      //   below comes from. A 124 disc there leaves ~3pt clear of the hinge
      //   and ~3pt clear of the far wall.
      //
      //   Vertically there is more room than that (~9pt top and bottom), and
      //   it is deliberately not spent: a disc squeezed to the case's top and
      //   bottom edges would foul the corner posts, which sit 7pt in.
      //
      // Centred on the case's INTERIOR rather than on the tile — dead centre
      // would leave the disc visibly closer to the hinge than to the far wall.
      CompactDisc(cover: Art.songCover(station: s.image), accent: s.accentColor, size: 124)
        .offset(x: 6)
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
      // NOT ONE WORD ON IT, AND AS BIG AS THE TILE ALLOWS (owner, 09.09:
      // "increase the size of the vinyl too, remove the station's text so
      // it's just the vinyl"). It carried the frequency on its label; a
      // record on its own is the whole idea of this look, and the station
      // still names itself on every other row in the gallery.
      //
      // 144 in a ~158pt tile leaves 7pt of room each side. The record's own
      // shadow needs somewhere to fall, which is what stops it going wider.
      RecordView(accent: s.accentColor, label: nil, size: 144, plainLabel: true)
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
        RadialGradient(colors: [Color(hex: "#332536"), Color(hex: "#150f1c")],
                       center: .init(x: 0.38, y: 0.30), startRadius: 0, endRadius: size * 0.62))
      ForEach(tiles, id: \.id) { t in
        Path { p in
          p.move(to: t.pts[0])
          for q in t.pts.dropFirst() { p.addLine(to: q) }
          p.closeSubpath()
        }
        .fill(t.tint)
      }
      // A HANDFUL OF TINY GLINTS ON THE BRIGHTEST TILES (owner, 10.09: "a
      // handful of very bright tiles or little star-like glints... don't put
      // them everywhere — maybe 3-6 around the brightest area"). Picked from
      // the SAME lighting model rather than guessed screen coordinates — the
      // five brightest tiles the reflection math already produced — so a
      // glint can never land somewhere the ball itself is dark. Built as pure
      // falloff (a soft dot plus two hairline arms transparent at both tips),
      // never a stroked shape: this file has already talked the CD's rim and
      // the app's own mirror ball out of a plain stroked circle, because a
      // hard edge on a light reads as a sticker rather than a shine.
      ForEach(Array(brightestTiles.enumerated()), id: \.offset) { _, t in
        Glint().position(t.center)
      }
      // THE RIM IS DIRECTIONAL LIGHT, NOT A DRAWN OUTLINE (owner, 10.09:
      // "softer edge lighting... a faint rim-light — especially violet on one
      // side and blue on the other — would separate it from the background",
      // and the same message's separate note that the tile's own light
      // outline "feels somewhat UI-like"). Both are this one stroke: a flat
      // `Circle().stroke(.white.opacity(x))` is one brightness the whole way
      // round, which is exactly a drawn ring — the file has already talked
      // the CD and the Pocket Player's rims out of that shape. An
      // `AngularGradient` sweep puts violet on one arc and icy blue on the
      // opposite one, fading to nothing everywhere else, so it reads as two
      // lamps catching the silhouette rather than a UI border.
      Circle().strokeBorder(
        AngularGradient(stops: [
          .init(color: Color(hex: "#b98cff").opacity(0.50), location: 0.00),
          .init(color: .clear, location: 0.20),
          .init(color: .clear, location: 0.44),
          .init(color: Color(hex: "#8fd8ff").opacity(0.46), location: 0.60),
          .init(color: .clear, location: 0.80),
          .init(color: Color(hex: "#b98cff").opacity(0.50), location: 1.00),
        ], center: .center, angle: .degrees(-35)), lineWidth: 1.6)
    }
    .frame(width: size, height: size)
    .shadow(color: Color(hex: "#e696e6").opacity(0.40), radius: 18)
  }

  /// A soft dot with two hairline arms, both fading to nothing at their own
  /// tips — the recipe the app's own mirror ball settled on for a shine that
  /// reads as light rather than as a sticker glued to the surface.
  private struct Glint: View {
    var body: some View {
      ZStack {
        Circle().fill(
          RadialGradient(colors: [.white.opacity(0.9), Color(hex: "#e4d6ff").opacity(0.3), .clear],
                         center: .center, startRadius: 0, endRadius: 4.5))
          .frame(width: 9, height: 9)
        LinearGradient(colors: [.clear, .white.opacity(0.85), .clear],
                       startPoint: .top, endPoint: .bottom).frame(width: 1, height: 12)
        LinearGradient(colors: [.clear, .white.opacity(0.85), .clear],
                       startPoint: .leading, endPoint: .trailing).frame(width: 12, height: 1)
      }
      .allowsHitTesting(false)
    }
  }

  private struct Tile { let id: Int; let pts: [CGPoint]; let center: CGPoint; let v: Double; let tint: Color }

  /// The five tiles the lighting model itself made brightest — see `Glint`.
  private var brightestTiles: [Tile] {
    Array(tiles.sorted { $0.v > $1.v }.prefix(5))
  }

  private var tiles: [Tile] {
    let r = size / 2, tilt = -0.16
    // GROUT, THINNED (owner, 10.09: "reduce the heavy tile outlines. The dark
    // grid around every mirror tile is quite dominant... lower-opacity so the
    // lighting becomes the focus"). Nothing here strokes a tile — the "grid"
    // is the ball's own dark body showing through the gap left by shrinking
    // every quad toward its own centre, so the grout is thinned by shrinking
    // LESS (0.91 -> 0.955, a narrower gap) and the body colour it reveals is
    // lifted a step (see the RadialGradient above) so what remains reads as a
    // seam rather than a black line.
    let shrink = 0.955
    let lamps: [(Double, Double, Double)] = [
      norm((-0.58, -0.55, 0.60)), norm((0.66, -0.10, 0.74)), norm((0.06, 0.62, 0.78)),
    ]
    // PINK -> VIOLET -> ICY BLUE, and the falloff between them is smoother
    // than the brightness itself (owner, 10.09: "a smoother pink -> violet ->
    // icy blue falloff... almost white/lavender in a few tiles"). Colour and
    // brightness now use TWO DIFFERENT lobes off the same reflection: `lw`
    // stays a steep pow(d,5.4) so the ball is still dark between the lamps —
    // "keep the outer tiles darker" — while `cw` is a wider pow(d,3) used only
    // for how far the TINT reaches. A steep colour lobe would patch the hue
    // in small hard-edged islands; a wide one lets neighbouring mirrors blend
    // from one hue into the next, which is what "smoother falloff" means.
    // Blending pink and icy blue at close range is also what produces the
    // pale lavender she asked for at the brightest catches, with no fourth
    // colour invented for it.
    let lampColors: [(Double, Double, Double)] = [
      (255, 145, 200), (185, 140, 255), (150, 215, 255),
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
        let center = CGPoint(x: quad.map(\.x).reduce(0, +) / 4,
                             y: quad.map(\.y).reduce(0, +) / 4)
        let n = norm((ax / 4, ay / 4, az / 4))
        let ndv = n.2                                    // n · (0,0,1)
        let refl = norm((2 * ndv * n.0, 2 * ndv * n.1, 2 * ndv * n.2 - 1))
        // STRONGER DEPTH: DARK BETWEEN THE LAMPS, WHITE-HOT WHERE THEY CATCH
        // (owner, 10.09: "keep the outer tiles darker, but make the centre
        // reflection much brighter... that will make it feel reflective
        // rather than painted"). MEASURED with a Python port of this exact
        // loop (scratchpad/ball/measure.py) rather than eyeballed: ambient
        // 0.23 -> 0.13 and the lamp gain 0.86 -> 1.15 moves the median off
        // 209 tiles 117.0 -> 91.2 (the ball reads darker overall — "outer
        // tiles darker") while mirrors above 245 (near-white) go 2.4% -> 4.8%
        // and mirrors carrying real colour 23.9% -> 34.0% (the smoother
        // falloff above). The exponent stays STEEP (6 -> 5.4, barely
        // softened) so the bright zone stays SMALL rather than spreading —
        // "a few tiles", not most of the ball.
        //
        // THIS IS STILL THE REFLECTION MODEL, NOT A SCREEN-SPACE SPOTLIGHT. A
        // positional brightness gradient was tried and measured first and
        // read exactly like the file's own standing warning against one: it
        // crushed the median to 64.8 and left NOTHING near-white, because
        // "distance from the tile's centre" does not correlate with which
        // mirror is actually catching a lamp. Contrast comes from the SAME
        // lamp maths that already decides colour, which is why a bright tile
        // and a coloured tile are so often the same tile.
        var b = 0.13
        var w: [Double] = []          // brightness weight — stays steep
        var cw: [Double] = []         // colour weight — wider, for the falloff
        for L in lamps {
          let d = max(0, refl.0 * L.0 + refl.1 * L.1 + refl.2 * L.2)
          let lw = pow(d, 5.4)
          w.append(lw)
          cw.append(pow(d, 3))
          b += 1.15 * lw
        }
        b += rnd() * 0.28          // each mirror catches its own bit of room
        b = min(1, max(0.05, b))
        let v = 0.10 + 0.90 * pow(b, 0.72)
        let cwsum = cw.reduce(0, +)
        var tint = Color(white: v)
        if cwsum > 0.002 {
          let g = 255.0 * v
          var cr = 0.0, cg = 0.0, cb = 0.0
          for (weight, lc) in zip(cw, lampColors) {
            cr += weight * lc.0; cg += weight * lc.1; cb += weight * lc.2
          }
          cr /= cwsum; cg /= cwsum; cb /= cwsum
          let k = min(1.0, cwsum * 1.4) * 0.78
          tint = Color(red:   min(1, max(0, (g * (1 - k) + cr * k) / 255)),
                       green: min(1, max(0, (g * (1 - k) + cg * k) / 255)),
                       blue:  min(1, max(0, (g * (1 - k) + cb * k) / 255)))
        }
        out.append(Tile(id: i * cols + j, pts: quad, center: center, v: v, tint: tint))
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
        // THE OUTER STROKE, LIGHTENED (owner, 10.09: "reduce the heavy outer
        // frame/borders"). 2pt at 0.30 is a genuinely bold line at this
        // scale; the plastic is already carried by the fill and the diagonal
        // sweep below, so the stroke only needs to mark the edge, not draw
        // it. Halved on both counts.
        .overlay(RoundedRectangle(cornerRadius: caseRadius).stroke(.white.opacity(0.16), lineWidth: 1))

      // hinge spine — the tabs down it are the "side buttons" (owner, 10.09:
      // "make the side buttons more subtle"), quieted the same way as the
      // frame: less fill, less stroke.
      HStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.04)],
                       startPoint: .leading, endPoint: .trailing)
          .frame(width: 12)
          .overlay(HStack { Spacer(); Rectangle().fill(.white.opacity(0.20)).frame(width: 1) })
          .overlay(
            VStack(spacing: 14) {
              ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 2)
                  .fill(.white.opacity(0.09))
                  .overlay(RoundedRectangle(cornerRadius: 2).stroke(.white.opacity(0.14), lineWidth: 1))
                  .frame(width: 8, height: 19)
              }
            })
        Spacer(minLength: 0)
      }

      // corner posts, also quieted with the rest of the frame
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
  ///
  /// TIGHTENED AGAIN 10.09 to make room for a bigger disc (owner: "the CD is
  /// still quite small, I wanted the CD to fit like the 3rd image where the
  /// edges are close to the case"). 8 + 16 = 24 still clears the tile, and
  /// the two points the case gives up go straight to the disc.
  private var caseInset: CGFloat { 8 }
  private var caseRadius: CGFloat { 16 }

  private func post(_ corner: Alignment) -> some View {
    let top = corner == .topLeading || corner == .topTrailing
    let leading = corner == .topLeading || corner == .bottomLeading
    return ZStack {
      VStack { if !top { Spacer() }; Rectangle().frame(height: 1.8); if top { Spacer() } }
      HStack { if !leading { Spacer() }; Rectangle().frame(width: 1.8); if leading { Spacer() } }
    }
    .foregroundColor(.white.opacity(0.22))
    .frame(width: 15, height: 15)
  }
}

/**
 * ONE SPECTRAL FAN OFF A DISC.
 *
 * The colour comes from a RADIAL gradient — violet at the inner tracks out to
 * red at the rim, which is the direction a grating actually spreads a
 * spectrum — and an ANGULAR gradient is used only as a MASK, so the fan
 * exists over one arc and is absent everywhere else.
 *
 * BOTH GRADIENTS FADE TO NOTHING AT THEIR OWN EDGES, which is this target's
 * standing rule for anything that is light: the spectrum fades before the hub
 * and before the rim, and the wedge fades to clear on both flanks. A hard
 * boundary on a light reads as a sticker, and this file has already talked the
 * CD's rim, the mirror ball's rim and the ball's glints out of exactly that.
 *
 * `bearing` is where the fan points, in degrees clockwise from straight up.
 * `spread` is how much of the disc it covers, in degrees.
 */
private struct DiffractionFan: View {
  let size: CGFloat
  let bearing: Double
  let spread: Double
  let strength: Double

  var body: some View {
    Circle()
      .fill(RadialGradient(stops: [
        .init(color: .clear, location: 0.00),
        .init(color: Color(hex: "#5b3bff").opacity(0.45), location: 0.12),
        .init(color: Color(hex: "#2bc0ff"), location: 0.28),
        .init(color: Color(hex: "#48ffc0"), location: 0.43),
        .init(color: Color(hex: "#ffe86b"), location: 0.58),
        .init(color: Color(hex: "#ff8a3c"), location: 0.72),
        .init(color: Color(hex: "#ff4d8f").opacity(0.55), location: 0.87),
        .init(color: .clear, location: 1.00),
      ], center: .center, startRadius: size * 0.13, endRadius: size * 0.52))
      // The trailing-closure `mask(alignment:content:)`, not the older
      // `mask(_:)` that takes a view — that one has been deprecated since
      // iOS 15, and a deprecation warning in a build log is one more line
      // to read past when something real goes wrong.
      .mask {
        // The wedge is built with its peak at location 0.5 and the whole
        // gradient then TURNED so that 0.5 lands on the bearing — an
        // AngularGradient's location 0 sits at its own `angle`, so half a
        // turn back is what puts the peak where it was asked for. Writing
        // the wedge across the 0/1 seam instead would need two stop runs and
        // is the kind of thing that is invisibly wrong without a compiler to
        // argue with.
        Circle().fill(
          AngularGradient(stops: wedgeStops(), center: .center,
                          angle: .degrees(bearing - 180)))
      }
      .blendMode(.screen)
      .opacity(strength)
  }

  private func wedgeStops() -> [Gradient.Stop] {
    let half = CGFloat(spread) / 720
    return [
      .init(color: .clear, location: 0),
      .init(color: .clear, location: max(0, 0.5 - half)),
      .init(color: .white.opacity(0.35), location: max(0, 0.5 - half * 0.55)),
      .init(color: .white, location: 0.5),
      .init(color: .white.opacity(0.35), location: min(1, 0.5 + half * 0.55)),
      .init(color: .clear, location: min(1, 0.5 + half)),
      .init(color: .clear, location: 1),
    ]
  }
}

/// A disc with the last cover printed on it, under the diffraction the plastic
/// throws. The rainbow sits OVER the art rather than under it, because a CD's
/// sheen is on its surface — the app's own CD deck settled this on 03.08.
struct CompactDisc: View {
  let cover: Image?
  let accent: Color

  /// The pressed rings, EASED (owner, 10.09: "ease on the CD's crevices' CDs
  /// are that textured" — she means the opposite of "are", the grooves read
  /// as a target printed on the disc rather than the near-invisible sheen a
  /// real pressing has). A real CD's data pitch is a few hundred nanometres —
  /// thousands of grooves per millimetre, far below anything a screen can
  /// resolve, so what a photo of one actually shows is a soft, barely-there
  /// shimmer, not rings you could count. This halves the opacity (0.08 ->
  /// 0.04) and widens the pitch (0.045 -> 0.07 of the radius), which is what
  /// turns individually countable rings into texture.
  ///
  /// Built here rather than inline so the locations are unambiguously
  /// CGFloat — an implicit Double bridge is the kind of thing that compiles
  /// locally and costs a build cycle when it does not, and Swift cannot be
  /// compiled in the environment this is written in.
  private func ringStops() -> [Gradient.Stop] {
    var out: [Gradient.Stop] = []
    var t: CGFloat = 0
    while t < 1 {
      out.append(Gradient.Stop(color: .white.opacity(0.04), location: t))
      out.append(Gradient.Stop(color: .clear, location: min(1, t + 0.035)))
      t += 0.07
    }
    return out
  }
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle().fill(Color(white: 0.08))
      if let cover {
        // NOT AS DARK AS THE OLD OVERLAY-BLEND VERSION NEEDED, because that
        // reasoning no longer applies. The rainbow used to be a full-circle
        // OVERLAY wash covering the whole face, which mutes against a bright
        // ground — hence pushing the art down first. It is confined to a
        // couple of narrow SCREEN-blend fans now (10.09, the diffraction
        // rebuild), which only ever brighten, so darkening the art ahead of
        // it just cost the cover: measured on the prototype
        // (docs/design/cd_widget.py), the old -0.30/0.80 pair put the disc's
        // median luminance at 45 against the pre-rebuild look's 102 — the
        // photo was closer to lost than "personal". -0.14/0.95 lands at 96,
        // matching the old look, while the fans still read clearly because
        // they no longer have a wash to fight.
        cover.resizable().aspectRatio(contentMode: .fill)
          .frame(width: size, height: size)
          .clipShape(Circle())
          // PUSHED FURTHER DOWN AND DESATURATED since the rainbow stopped
          // covering the whole face: with only two fans on it, a bright
          // saturated photograph reads as a picture with some colour laid
          // over it rather than as a disc. The art is still plainly the
          // cover — it is printed under a mirror, and that is what a printed
          // face under a mirror looks like.
          .brightness(-0.14).saturation(0.95)
      } else {
        Circle().fill(accent.opacity(0.55))
      }
      // ── THE RAINBOW IS DIFFRACTION, NOT A COLOUR WHEEL ────────────────
      //
      // Owner, 10.09: "the rainbow light effect is currently just painted on
      // where in reality it should look like the last image", with a
      // photograph of a real disc beside it.
      //
      // SHE IS DESCRIBING A GEOMETRY MISTAKE RATHER THAN A COLOUR ONE, and
      // that is why no amount of tuning the old version fixed it. What shipped
      // was TWO FULL-CIRCLE AngularGradients — six hues wrapped evenly all the
      // way round the face. That is a colour wheel, and a colour wheel is a
      // pattern printed on a disc.
      //
      // A CD's tracks are concentric, so the disc is a circular DIFFRACTION
      // GRATING, and a grating does two things an angular wheel does neither
      // of:
      //
      //   THE SPECTRUM RUNS ALONG THE RADIUS. The angle a wavelength leaves at
      //   depends on the track spacing, so violet through red spreads OUTWARD
      //   from the hub — never around it.
      //
      //   IT IS LOCALISED IN ANGLE. Only the arc of the disc oriented right
      //   for the lamp throws colour at the eye at all; everywhere else is
      //   plain mirror. That is why the reference photograph is a couple of
      //   bright fans on silver rather than an even ring of colour.
      //
      // So the RADIAL gradient carries the spectrum and an ANGULAR gradient is
      // used as a MASK to confine it to a fan, which is the exact inversion of
      // what was here before.
      DiffractionFan(size: size, bearing: 34, spread: 84, strength: 0.95)
      DiffractionFan(size: size, bearing: 214, spread: 72, strength: 0.78)
      // A third, much fainter fan — a real disc catches a weaker second source
      // (a window, a wall) as well as the main one, and one lone fan reads as
      // a mistake rather than as light.
      DiffractionFan(size: size, bearing: 128, spread: 44, strength: 0.34)

      // AND THE FACE BETWEEN THE FANS HAS TO READ AS METAL, or the fans are
      // simply sitting on a photograph. Neutral on purpose — no hue anywhere
      // in it, which is the same rule the app's mirror ball settled on (28.07:
      // the material carries no colour, the LIGHT does).
      Circle().fill(
        AngularGradient(stops: [
          .init(color: .white.opacity(0.20), location: 0.00),
          .init(color: .white.opacity(0.02), location: 0.17),
          .init(color: .white.opacity(0.26), location: 0.34),
          .init(color: .white.opacity(0.04), location: 0.55),
          .init(color: .white.opacity(0.22), location: 0.74),
          .init(color: .white.opacity(0.03), location: 0.88),
          .init(color: .white.opacity(0.20), location: 1.00),
        ], center: .center, angle: .degrees(-30)))
        .blendMode(.screen)
        .opacity(0.55)

      // The pressed rings. Fine enough to read as texture rather than as
      // drawn circles — the same pitch rule the app's Classic vinyl settled
      // on (25.08): below about 1.2pt apart they moiré, above ~4 they read
      // as a target printed on a disc.
      Circle().fill(
        RadialGradient(stops: ringStops(), center: .center,
                       startRadius: 0, endRadius: size / 2))
      // THE SPECULAR SWEEP, TIGHTENED for a crisper gloss rather than a broad
      // soft wash — a narrower, brighter streak is what a genuine reflective
      // sheen looks like, against a wide dim one that reads as a general
      // brightening of the face.
      Circle().fill(
        LinearGradient(stops: [
          .init(color: .white.opacity(0.52), location: 0.04),
          .init(color: .clear, location: 0.20),
          .init(color: .clear, location: 0.72),
          .init(color: .white.opacity(0.30), location: 0.95),
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

      // THE STACKING RING IS GONE (owner, 10.09: "remove the circle that's
      // between the centre and the edge"). It was the moulded step a real CD
      // carries so a stack of discs never touches face to face — true of the
      // object, and still the wrong thing to draw here: at this size a real
      // feature and a decorative ring look identical, and hers is the more
      // honest read. One fewer drawn circle is also one fewer thing to be
      // told is "UI-like" (the rim went through exactly this on 10.09).

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
          .init(color: .white.opacity(0.62), location: 0),
          .init(color: .white.opacity(0.08), location: 0.28),
          .init(color: .white.opacity(0.40), location: 0.55),
          .init(color: .white.opacity(0.05), location: 0.80),
          .init(color: .white.opacity(0.62), location: 1),
        ], center: .center, angle: .degrees(-125)), lineWidth: 1.2)
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
