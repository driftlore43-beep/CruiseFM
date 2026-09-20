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
 * THE DISC DRAWS THE SONG'S COVER, because a disc with a record sleeve
 * printed on it is the whole idea of this one — the owner's call on 03.09
 * ("I'd rather keep the album art for the cd mode"), made when it was the
 * ONLY widget that did, and it was the one she was right about: the Last
 * Played looks joined it on 20.09. It falls back to the station's
 * photograph, so no cover still means a real picture. See Art.songCover.
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
  let station = snap.lastDrive ?? snap.currentOnAir()
  return ModeEntry(date: Date(), station: station, lastPlayed: snap.lastPlayed,
                   ready: true, style: style)
}

private func modeTimeline(_ style: ModeStyle) -> Timeline<ModeEntry> {
  Timeline(entries: [modeEntry(style)], policy: .after(Date().addingTimeInterval(3600)))
}

struct ModeProvider: TimelineProvider {
  func placeholder(in c: Context) -> ModeEntry {
    // A REAL ENTRY, NOT AN EMPTY ONE.
    //
    // WidgetKit draws `placeholder` REDACTED — every piece of text becomes a
    // grey capsule — so a placeholder built from nothing renders as a blank
    // grey tile, which is precisely what the owner reports on an iPad (14.09)
    // and could not find a cause for. A tile stuck on its placeholder and a
    // tile that failed outright look identical from the outside.
    //
    // Reading the snapshot here costs one synchronous read of shared
    // UserDefaults, which the timeline does anyway, and it makes the two
    // cases tell themselves apart: a widget stuck on its placeholder now
    // shows real content, so if a grey tile fills in, the drawing was never
    // the problem — it never received a timeline.
    modeEntry(.mirrorBall)
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
    // A REAL ENTRY, NOT AN EMPTY ONE.
    //
    // WidgetKit draws `placeholder` REDACTED — every piece of text becomes a
    // grey capsule — so a placeholder built from nothing renders as a blank
    // grey tile, which is precisely what the owner reports on an iPad (14.09)
    // and could not find a cause for. A tile stuck on its placeholder and a
    // tile that failed outright look identical from the outside.
    //
    // Reading the snapshot here costs one synchronous read of shared
    // UserDefaults, which the timeline does anyway, and it makes the two
    // cases tell themselves apart: a widget stuck on its placeholder now
    // shows real content, so if a grey tile fills in, the drawing was never
    // the problem — it never received a timeline.
    modeEntry(.mirrorBall)
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

  /**
   * EVERY SIZE IN THIS TILE IS A SHARE OF THE TILE, NOT A NUMBER OF POINTS.
   *
   * They were all constants tuned against an iPhone's ~158pt small widget —
   * and a small widget is NOT 158 points everywhere. On a 768x1024 iPad it is
   * about 141, which is SMALLER than a phone's, so a record drawn at a fixed
   * 144 was wider than the tile it sat in. Owner, 14.09: "the vinyl is a bit
   * too big in the square widget - it's currently just touching the edges."
   *
   * The CD had the same fault one layer in and it is worth naming, because it
   * is not visible as an overflow: the jewel case fills the tile and so
   * shrinks with it, while the disc inside it did not — on a 141pt tile a
   * fixed 132 disc is wider than the case's own 119pt interior, so it ran
   * over the hinge and the far wall.
   *
   * `k` is the tile's own size against that 158pt reference, so an iPhone
   * gets exactly the numbers that were approved (k = 1) and every other
   * device gets the same DESIGN rather than the same measurements. It is the
   * widget-side version of the rule the decks learned on 13.09: a number
   * tuned against a phone must never be the thing deciding another screen's
   * layout.
   */
  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      GeometryReader { geo in
        let k = min(geo.size.width, geo.size.height) / 158
        // THE EXPLICIT FRAME IS LOAD-BEARING, AND ITS ABSENCE IS WHAT DROPPED
        // THE BALL AND THE DISC DOWN THEIR TILES (owner, 15.09: "the small
        // widgets for Mirror ball and CD have shifted its position").
        //
        // A GeometryReader aligns its content to `.topLeading`, NOT centre —
        // and two of these three heroes contain a child that INSISTS on being
        // bigger than the tile: the ball's BeamField is 190k tall (the beams
        // radiate past the ball, deliberately) and the CD's glow carries an
        // explicit 192k square. A ZStack takes the union of its children, so
        // those ZStacks are ~190k and ~192k rather than the tile's size, and
        // pinned to the top-leading corner the whole overflow hangs off the
        // bottom and the right — which moves the object's centre down by half
        // of it. MEASURED off her screenshots at 12-15% of the tile low, with
        // the arithmetic predicting 12.7%.
        //
        // IT IS A REGRESSION FROM 14.09's `k`, which is what introduced the
        // GeometryReader; before that the same oversized ZStack was centred
        // by the ordinary layout, so the overflow was split evenly above and
        // below and nothing moved. THE CONTROL IS THE RECORD: its background
        // gradient carries no frame, so it is greedy, cannot overflow, and is
        // the one look of the three she did not report.
        //
        // Framing to `geo.size` restores the centring without shrinking any
        // of it — the beams are meant to run past the ball, and the widget's
        // own rounded rect does the clipping, as it always has.
        Group {
          switch entry.style {
          case .mirrorBall: ball(s, k: k)
          case .cd:         disc(s, k: k)
          case .record:     record(s, k: k)
          }
        }
        .frame(width: geo.size.width, height: geo.size.height)
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
  private func ball(_ s: WidgetStation, k: CGFloat) -> some View {
    ZStack {
      // A GENUINE HALO, NOT A UNIFORM WASH (owner, 10.09: "a soft radial
      // purple halo behind it rather than the current more uniform purple
      // haze. The centre should glow and the corners should stay almost
      // black"). The old radius (150, against a ~158pt tile) meant the
      // gradient barely moved across the visible area — the corners sat at
      // about 75% of the way to black rather than genuinely dark, which is
      // exactly "uniform" rather than "glowing". A tighter radius plus a
      // brighter, more saturated core stop is what turns a wash into a glow.
      //
      // AND THE COLOUR IS THE STATION'S NOW, not a fixed purple (owner,
      // 13.09). The whole derivation, and why a colourless station correctly
      // comes out silver-to-black, is on `ballHalo` in Snapshot.swift.
      s.ballHalo(k)
      BeamField(k: k)
      // THE BALL CENTRES ON THE TILE, NOT THE BALL-AND-STEM TOGETHER (owner,
      // 15.09: "the mirror ball is dropped down"). It used to carry
      // `.offset(y: 4 * k)`, on the reasoning that the stem hangs above the
      // ball so the two read as centred together — which is true of the
      // SILHOUETTE and false of what anyone looks at. The stem is a 1pt
      // hairline fading to nothing at both ends; the ball is 126pt of chrome.
      // Weighting the layout toward the thing you cannot see put the thing
      // you can 4pt low in its square.
      //
      // Same call as the CD's 6pt sidestep the same day, and the same reason:
      // a widget is read as a tile among tiles, so the TILE's edges are what
      // the eye centres against. Where the object and the frame disagree, the
      // frame wins (03.08).
      MirrorBall(size: 126 * k, rows: 17, cols: 30, eqColors: s.eqColors, accent: s.accent)
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
            .frame(width: 1, height: 30 * k).offset(y: -28 * k)
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
  // radius reach the tile's: JewelCase is inset 8 with a 16pt radius, i.e.
  // 24 against the tile's ~22, so it clears with a little to spare and is
  // still very nearly the whole tile.
  private func disc(_ s: WidgetStation, k: CGFloat) -> some View {
    ZStack {
      LinearGradient(colors: [Color(hex: "#1c1f26"), Color(hex: "#080a0e")],
                     startPoint: .topLeading, endPoint: .bottomTrailing)
      JewelCase()
      // A SOFT GLOW BEHIND THE DISC (owner, 10.09: "add a soft glow/shadow
      // behind the CD"). The disc already casts a contact shadow onto the
      // case, which is depth — this is light, the same distinction the app's
      // own decks draw everywhere else, so it is the station's own colour
      // rather than plain black.
      //
      // DRAWN AS FALLOFF RATHER THAN AS A BLUR (14.09). It was a filled
      // circle with `.blur(radius: 20)`, and a blur is the one thing in this
      // tile that forces the renderer to draw to an offscreen buffer and
      // filter it — by some way the most expensive operation in the target,
      // in the one look the owner reports coming up blank on an iPad while
      // the mirror ball beside it, which has no offscreen work at all, draws
      // fine. THAT IS NOT A DIAGNOSIS and it is not offered as one; nothing
      // is crashing, so the honest reading is that the render is being given
      // up on rather than failing, and this removes the biggest single reason
      // it might be. A radial gradient IS the blur of a filled circle, so the
      // look is the same — it is what the app's own React Native side has
      // always used, having no blur at all.
      RadialGradient(
        stops: [
          .init(color: s.accentColor.opacity(0.32), location: 0.00),
          .init(color: s.accentColor.opacity(0.26), location: 0.52),
          .init(color: s.accentColor.opacity(0.10), location: 0.80),
          .init(color: s.accentColor.opacity(0.00), location: 1.00),
        ],
        center: .center, startRadius: 0, endRadius: 96 * k)
        .frame(width: 192 * k, height: 192 * k)
      // THE DISC ALL BUT FILLS THE CASE (owner, 10.09: "the CD is still quite
      // small... the edges are close to the case"), grown again with case
      // option D's slimmer frame (owner, 11.09 "D"). 124 -> 132:
      //
      //   THE HORIZONTAL IS THE BINDING AXIS, because the hinge eats one side.
      //   With the frame at inset 5 the case runs x 5..153 on a ~158pt tile
      //   and the spine takes 12 off the left, so the case's INTERIOR is
      //   x 17..153 — 136 wide, centred at 85, i.e. 6pt right of the tile's
      //   own centre.
      //
      //   Vertically there is room to spare and it is deliberately not spent:
      //   a disc squeezed to the edges would foul the corner clips, at 6pt in.
      //
      // CENTRED ON THE TILE, NOT ON THE CASE'S INTERIOR (owner, 15.09: "the
      // widget sits a bit in the right for iPhone"). This REVERSES 10.09's
      // own reasoning — that dead centre would leave the disc visibly closer
      // to the hinge than to the far wall — and it reverses it on evidence
      // rather than on taste.
      //
      // MEASURED OFF HER SCREENSHOT: the disc's centre sat 20px right of the
      // tile's on a 523px render, i.e. exactly the 6pt asked for here, so the
      // geometry was doing precisely what it was told. What the same shot
      // also shows is that THE SPINE IT IS CLEARING DOES NOT READ AT ALL —
      // luminance across the case's left band runs 72.7, 72.5, 72.3, 72.4,
      // 72.0, 71.1, 68.5 from x 2 to x 24, i.e. dead flat, with no trace of
      // the 12pt gradient strip, its two hairlines, the frosted CRUISE FM
      // spine or the knuckles. Quieted to the level the owner asked for on
      // 10.09 ("reduce the heavy outer frame/borders") and washed over by the
      // disc's own accent glow, the hinge is simply not a wall the eye can
      // see — so the offset bought nothing and cost a disc that plainly sits
      // off centre in its square.
      //
      // WHERE THE OBJECT AND THE FRAME DISAGREE, THE FRAME WINS: a widget is
      // read as a tile among other tiles, and the tile's own edges are what
      // the eye centres against. The same call the drag classifier made on
      // 03.08 — intent over physics.
      //
      // The disc is 0.74 opaque, so where it now crosses the spine's inner
      // ~4pt the hinge reads THROUGH the pressing, which is what a CD sitting
      // in its tray beside the hinge actually looks like.
      CompactDisc(cover: Art.songCover(station: s.image), accent: s.accentColor, size: 132 * k)
        // A CLEAR PRESSING, NOT A SOLID PUCK (owner, 14.09: "add some
        // transparency to the CD widget"). The app's own CD deck has drawn a
        // translucent disc since 25.07 — the drive shows through it, which is
        // most of what makes it read as an object — and this one was fully
        // opaque. 0.74 lets the case's hinge and clips show through the
        // pressing the way the prototype does; the honest cost is brightness
        // (median luminance 91 -> 73 on the prototype), which is what
        // transparency over a dark case means, and the stronger rainbow
        // above is what keeps it from reading merely dimmer.
        .opacity(0.74)
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
  private func record(_ s: WidgetStation, k: CGFloat) -> some View {
    ZStack {
      RadialGradient(colors: [Color(hex: "#1a1a1f"), Color(hex: "#08080a")],
                     center: .init(x: 0.38, y: 0.30), startRadius: 0, endRadius: 150 * k)
      // NOT ONE WORD ON IT, AND AS BIG AS THE TILE ALLOWS (owner, 09.09:
      // "increase the size of the vinyl too, remove the station's text so
      // it's just the vinyl"). It carried the frequency on its label; a
      // record on its own is the whole idea of this look, and the station
      // still names itself on every other row in the gallery.
      //
      // 139 OF THE TILE, WHATEVER THE TILE IS — see the note on `body`. It
      // was a flat 144, which leaves 7pt each side on an iPhone and is WIDER
      // THAN THE WHOLE TILE on a 141pt iPad, where the owner found it
      // "currently just touching the edges" (14.09). 144 -> 139 is also the
      // fraction off she asked for, so even at k = 1 there is a little more
      // air than before; the record's own shadow needs somewhere to fall,
      // which is what stops it going wider again.
      RecordView(accent: s.accentColor, label: nil, size: 139 * k, plainLabel: true)
    }
    .widgetURL(s.url(mode: "vinyl"))
  }
}

/// Beams thrown off the ball. Fixed, never turning — a lamp is bolted to the
/// room, and there is nothing here that could animate anyway.
private struct BeamField: View {
  /// The tile's size against the 158pt reference the beams were drawn at —
  /// see the note on ModeView's body. A beam is part of the object, so it
  /// shrinks with it rather than staying a fixed number of points long.
  var k: CGFloat = 1
  var body: some View {
    ZStack {
      ForEach(Array([(-74.0, 0.15), (-48.0, 0.10), (-20.0, 0.13),
                     (14.0, 0.09), (42.0, 0.14), (68.0, 0.10)].enumerated()),
              id: \.offset) { _, b in
        LinearGradient(colors: [Color(hex: "#d6e6ff").opacity(b.1), .clear],
                       startPoint: .top, endPoint: .bottom)
          .frame(width: 1.2, height: 190 * k)
          .rotationEffect(.degrees(b.0), anchor: .top)
          .offset(y: -46 * k)
      }
    }
    .allowsHitTesting(false)
  }
}

/**
 * THE BALL, ON THE APP'S OWN RECIPE — not a lookalike, this time genuinely.
 *
 * MEASURED BEFORE BEING REWRITTEN (owner: "still looks flat"). The earlier
 * version here keyed brightness to a dot-product against three FIXED lamp
 * colours plus a small UNIFORM random wobble, and spread colour on a WIDER
 * lobe than brightness — both backwards from `MirrorBallFlipbook.tsx`, which
 * is what the app actually draws. Ported that recipe's per-tile shading to a
 * single static frame (`docs/design/ball_widget.py` — a WidgetKit tile can
 * never turn, so the honest target is what the app's ball looks like PAUSED:
 * chrome and fixed lamps, no flashing overlay) and measured 209 tiles: the
 * old model here has 14.8% of tiles below 0.22 luminance, the app's real one
 * has 24.9% — "flat" against "chrome", in one number. Owner: "wider, and
 * more colourful — the one on the right", i.e. the app's own recipe with no
 * glints (five static stars read as pasted on the moment real texture
 * carries the surface, which is her own reading of the earlier round: "don't
 * add any nice feature").
 *
 * IT IS STILL A REAL SPHERE PROJECTION, UNCHANGED: each mirror a quad between
 * two latitudes and two longitudes, back-face culled, brick bond, shrink
 * toward each tile's own centre for the grout. None of that was the fault.
 *
 * BRIGHTNESS IS TWO SEPARATE LOBES OFF THE SAME REFLECTION r = 2(n·v)n − v,
 * kept structurally apart rather than traded off against each other. A WIDE
 * lobe decides how far a tile lifts toward white; a NARROW one, tracked
 * independently (it can pick a DIFFERENT lamp from the one the wide lobe is
 * responding to), decides how much of that lamp's own colour rides along. A
 * tile can be bright without being coloured; colour never spreads further
 * than the brightness that earns it.
 *
 * AND EVERY TILE CARRIES ITS OWN TEXTURE, independent of the lamps: a 3D
 * lattice value noise sampled over the REFLECTION direction — not the tile's
 * screen position, the same "a mirror's character comes from what it points
 * at, not where it sits" rule the whole recipe runs on — pushed toward the
 * ENDS of its range rather than left clustered round the mean. That is the
 * chrome: real mirrors each catching a different, unremarkable bit of a dim
 * room. It is exactly what the old model never had — its only per-tile
 * variance was a flat random wobble riding a near-uniform ambient floor.
 *
 * THE KEY LAMP IS NEAR-WHITE; the other two carry the mood. Colour itself
 * comes from the STATION'S OWN eqColors when the snapshot carries them (see
 * `eqTriple`) — this widget's earlier fixed pink/violet/icy-blue set was a
 * placeholder for a station that had never sent its real palette across.
 */
struct MirrorBall: View {
  let size: CGFloat
  var rows: Int = 15
  var cols: Int = 26
  /// The station's own three eqColors — the real hues MirrorBallFlipbook.tsx
  /// builds its palette from. Nil on a snapshot cut before this field
  /// existed, in which case `eqTriple` falls back to a ramp off `accent`
  /// alone.
  var eqColors: [String]?
  var accent: String = "#7B38E0"

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
        .fill(t.fill.opacity(t.opacity))
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

  private struct Tile { let id: Int; let pts: [CGPoint]; let fill: Color; let opacity: Double }

  private struct AppLamp { let d: (Double, Double, Double); let power: Double; let sat: Double }

  /// The three fixed lamps `MirrorBallFlipbook.tsx` shades against. The key
  /// lamp (index 0, sat 0.06) is essentially white — it is what makes the
  /// material read as silver rather than a coloured sphere; the other two
  /// carry the station's own mood.
  private var lamps: [AppLamp] {
    [AppLamp(d: norm((-0.52, 0.62, 0.59)), power: 1.00, sat: 0.06),
     AppLamp(d: norm((0.66, 0.28, 0.70)), power: 0.72, sat: 0.52),
     AppLamp(d: norm((-0.18, -0.55, 0.81)), power: 0.58, sat: 0.40)]
  }

  /// The metal ramp a shaded tile reads its final grey off — the app's own
  /// seven-stop scale, walked by a tile's combined brightness `t`.
  private let shadeAnchors = ["#0a0a0b", "#191a1b", "#343537", "#646568",
                              "#a2a3a5", "#dcdcde", "#ffffff"]

  private func mixRGB(_ a: (Double, Double, Double), _ b: (Double, Double, Double), _ t: Double)
    -> (Double, Double, Double) {
    (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t, a.2 + (b.2 - a.2) * t)
  }

  private func shadeAt(_ t: Double) -> (Double, Double, Double) {
    let x = max(0, min(1, t)) * Double(shadeAnchors.count - 1)
    let i = min(shadeAnchors.count - 2, Int(x))
    return mixRGB(rgbOf(shadeAnchors[i]), rgbOf(shadeAnchors[i + 1]), x - Double(i))
  }

  /// The three hues the palette below is built from — the station's own
  /// eqColors when the snapshot carries them, or a light/base/deep ramp off
  /// `accent` alone otherwise. The same convention `rampFromColor()` already
  /// uses in the app for a custom station that only ever chose one colour.
  private var eqTriple: [(Double, Double, Double)] {
    if let eq = eqColors, eq.count == 3 { return eq.map { rgbOf($0) } }
    let a = rgbOf(accent)
    return [mixRGB(a, (1, 1, 1), 0.30), a, mixRGB(a, rgbOf("#161617"), 0.34)]
  }

  /// A NINE-ENTRY PALETTE — each of the station's three hues at its own
  /// colour, lightened, and deepened — the same construction
  /// MirrorBallFlipbook.tsx runs off a station's real eqColors.
  private var palette: [(Double, Double, Double)] {
    var out: [(Double, Double, Double)] = []
    for base in eqTriple {
      out.append(base)
      out.append(mixRGB(base, (1, 1, 1), 0.28))
      out.append(mixRGB(base, rgbOf("#161617"), 0.42))
    }
    return out
  }

  private func hash01(_ n: Double) -> Double {
    let x = sin(n * 12.9898) * 43758.5453
    return x - floor(x)
  }
  private func lattice(_ i: Double, _ j: Double, _ k: Double) -> Double {
    hash01(i * 127.1 + j * 311.7 + k * 74.7)
  }
  private func smoothstepT(_ t: Double) -> Double { t * t * (3 - 2 * t) }

  /// Trilinear 3D value noise over the REFLECTION direction, not the tile's
  /// own screen position — the chrome texture belongs to what a mirror
  /// catches, not to where it hangs on the ball.
  private func envNoise(_ x: Double, _ y: Double, _ z: Double, scale: Double) -> Double {
    let X = x * scale, Y = y * scale, Z = z * scale
    let i = floor(X), j = floor(Y), k = floor(Z)
    let fx = smoothstepT(X - i), fy = smoothstepT(Y - j), fz = smoothstepT(Z - k)
    var acc = 0.0
    for dz in 0...1 {
      for dy in 0...1 {
        for dx in 0...1 {
          let w = (dx == 1 ? fx : 1 - fx) * (dy == 1 ? fy : 1 - fy) * (dz == 1 ? fz : 1 - fz)
          acc += w * lattice(i + Double(dx), j + Double(dy), k + Double(dz))
        }
      }
    }
    return acc
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
    // seam rather than a black line. UNCHANGED by this round.
    let shrink = 0.955
    let pal = palette
    let key = lamps[0].d
    var out: [Tile] = []
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
        let env = envNoise(refl.0, refl.1, refl.2, scale: 3.1)

        // THE TWO LOBES — see the struct's own doc comment. `flare` (wide,
        // pow 10) is the brightest match across all three lamps; `cLobe`
        // (narrow, pow 28) is tracked SEPARATELY, so the lamp that wins the
        // colour need not be the one that wins the brightness.
        var flare = 0.0, cLobe = 0.0, flareHue = 0, flareSat = 0.0
        for (idx, L) in lamps.enumerated() {
          let dot = refl.0 * L.d.0 + refl.1 * L.d.1 + refl.2 * L.d.2
          guard dot > 0 else { continue }
          let wide = pow(dot, 10) * L.power
          if wide > flare { flare = wide }
          let narrow = pow(dot, 28) * L.power
          if narrow > cLobe { cLobe = narrow; flareHue = idx; flareSat = L.sat }
        }
        let lambert = max(0, n.0 * key.0 + n.1 * key.1 + n.2 * key.2)
        let depth = min(1, n.2 * 1.35)
        // PUSHED TOWARD THE ENDS OF ITS RANGE, not left clustered round the
        // mean — a real mirror is either catching something or it isn't.
        let sign = env - 0.5 >= 0 ? 1.0 : -1.0
        let spread = sign * pow(abs(env - 0.5) * 2, 0.68) * 0.5
        let t = max(0, min(1, 0.34 + lambert * 0.22 + spread * 0.80 + flare * 1.20))
        let hueIdx = (flareHue * 3 + Int(env * Double(pal.count))) % pal.count
        let hue = pal[hueIdx]
        let lifted = mixRGB(hue, (1, 1, 1), 0.30)
        let cast = cLobe > 0.06 ? min(0.72, cLobe * flareSat * 2.4) : 0.0
        let baseT = cast > 0 ? min(1, t + cast * 0.42) : t
        let fillRGB = cast > 0 ? mixRGB(shadeAt(baseT), lifted, cast) : shadeAt(t)
        // OPACITY, NOT A PRE-BLENDED COLOUR: SwiftUI already composites this
        // fill over the body Circle beneath it (source-over alpha blending),
        // which is exactly the same arithmetic the prototype does by hand
        // against a flat backdrop — there is nothing to gain by doing it
        // twice.
        let op = min(1, (0.56 + 0.50 * t) * (0.82 + 0.18 * depth))
        out.append(Tile(id: i * cols + j, pts: quad,
                        fill: Color(red: fillRGB.0, green: fillRGB.1, blue: fillRGB.2),
                        opacity: op))
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
      // ── the glass body ──
      RoundedRectangle(cornerRadius: caseRadius)
        .fill(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.02), .white.opacity(0.10)],
                             startPoint: .topLeading, endPoint: .bottomTrailing))
        // The outer stroke marks the edge, not draws it (owner, 10.09:
        // "reduce the heavy outer frame/borders"); the plastic is carried by
        // the fill, the bevel and the sweeps below.
        .overlay(RoundedRectangle(cornerRadius: caseRadius).stroke(.white.opacity(0.14), lineWidth: 1))

      // ── INNER BEVEL (case option D, owner 11.09 "D"): a dark line on the
      // wall and a highlight just inside it, so the plastic reads with real
      // depth rather than as a flat panel. ──
      RoundedRectangle(cornerRadius: caseRadius - 1).inset(by: 1)
        .stroke(Color(hex: "#05070e").opacity(0.26), lineWidth: 1)
      RoundedRectangle(cornerRadius: caseRadius - 3).inset(by: 3)
        .stroke(.white.opacity(0.12), lineWidth: 1)

      // ── BARREL HINGE down the spine (case option D): a rod with two
      // knuckles and their pins, plus a frosted CRUISE FM spine, in place of
      // the old three flat tabs. ──
      HStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.04)],
                       startPoint: .leading, endPoint: .trailing)
          .frame(width: 12)
          .overlay(HStack { Spacer(); Rectangle().fill(.white.opacity(0.20)).frame(width: 1) })
          .overlay(
            Text("CRUISE FM")
              .font(.system(size: 4.5, weight: .semibold, design: .monospaced))
              .tracking(1.5)
              .foregroundColor(.white.opacity(0.28))
              .fixedSize()
              .rotationEffect(.degrees(-90)))
          .overlay(Rectangle().fill(.white.opacity(0.26)).frame(width: 1).padding(.vertical, 18))
          .overlay(
            VStack(spacing: 20) {
              ForEach(0..<2, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 4.5)
                  .fill(.white.opacity(0.14))
                  .overlay(RoundedRectangle(cornerRadius: 4.5).stroke(.white.opacity(0.26), lineWidth: 1))
                  .frame(width: 9, height: 24)
                  .overlay(
                    Circle().fill(Color(hex: "#0a0c12").opacity(0.55))
                      .frame(width: 4.4, height: 4.4)
                      .overlay(Circle().stroke(.white.opacity(0.34), lineWidth: 0.7)))
              }
            })
        Spacer(minLength: 0)
      }

      // ── moulded corner clips (case option D): quieter glossy brackets ──
      VStack {
        HStack { clip(.topLeading); Spacer(); clip(.topTrailing) }
        Spacer()
        HStack { clip(.bottomLeading); Spacer(); clip(.bottomTrailing) }
      }
      .padding(6)

      // ── DUAL sweep of light on the plastic + a crisp top-edge glass
      // highlight (case option D) ──
      RoundedRectangle(cornerRadius: caseRadius)
        .fill(LinearGradient(stops: [
          .init(color: .white.opacity(0.20), location: 0.04),
          .init(color: .clear, location: 0.26),
          .init(color: .clear, location: 0.74),
          .init(color: .white.opacity(0.10), location: 0.96),
        ], startPoint: .topLeading, endPoint: .bottomTrailing))
      RoundedRectangle(cornerRadius: caseRadius)
        .fill(LinearGradient(stops: [
          .init(color: .white.opacity(0.10), location: 0.0),
          .init(color: .clear, location: 0.34),
        ], startPoint: .topTrailing, endPoint: .bottomLeading))
    }
    .padding(caseInset)
    .allowsHitTesting(false)
  }

  /// SLIMMER FRAME (case option D, owner 11.09 "D"): 5 + 13 = 18. The old rule
  /// of thumb — inset + radius should reach the tile's ~22pt clip so the
  /// corners are not sliced — is SUFFICIENT, not necessary: a 13pt-radius
  /// corner sitting 5pt in still falls entirely inside the tile's 22pt-radius
  /// clip (its nearest point to the tile corner is ~18.7pt from the clip's
  /// corner centre, inside 22), so no corner is lost and the three points off
  /// the frame go straight to a bigger disc.
  private var caseInset: CGFloat { 5 }
  private var caseRadius: CGFloat { 13 }

  /// A glossy moulded corner clip — two rounded ribs meeting at the corner,
  /// thicker and brighter than the old hairline L so it reads as a reinforced
  /// plastic corner (case option D).
  private func clip(_ corner: Alignment) -> some View {
    let top = corner == .topLeading || corner == .topTrailing
    let leading = corner == .topLeading || corner == .bottomLeading
    return ZStack {
      VStack { if !top { Spacer() }; RoundedRectangle(cornerRadius: 1.6).frame(height: 3.2); if top { Spacer() } }
      HStack { if !leading { Spacer() }; RoundedRectangle(cornerRadius: 1.6).frame(width: 3.2); if leading { Spacer() } }
    }
    .foregroundColor(.white.opacity(0.44))
    .frame(width: 17, height: 17)
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
  // Each beam carries its OWN spectrum so the two sides of the disc are not
  // identical (owner 11.09, below). Defaults to the pink/purple `warm` set.
  var spectrum: [Gradient.Stop] = DiffractionFan.warmStops

  // LIGHT, ASYMMETRIC SPECTRA 11.09 (owner: "keep [the smooth gradient] — but
  // add in a faint of orange, make sure the colours aren't exactly the same on
  // the disc... one side has orange, the other side doesn't but has turquoise.
  // Keeping shades of pink and purple the main colours. Keep the colours light,
  // not heavily saturated.") Pink and purple lead every beam; the WARM beam
  // adds a faint orange at its inner edge, the COOL beam a soft turquoise at
  // its outer edge, the faint middle beam neither. Every stop is a pastel at
  // reduced opacity so the face stays light rather than a saturated rainbow.
  static let warmStops: [Gradient.Stop] = [
    .init(color: .clear, location: 0.00),
    .init(color: Color(hex: "#ffbc8a").opacity(0.48), location: 0.12),  // faint orange, locked to B
    .init(color: Color(hex: "#ff9fd4").opacity(0.72), location: 0.30),  // light pink
    .init(color: Color(hex: "#ff88cc").opacity(0.80), location: 0.55),  // pink
    .init(color: Color(hex: "#c3a8ff").opacity(0.76), location: 0.80),  // lavender
    .init(color: Color(hex: "#d6c6ff").opacity(0.42), location: 0.94),  // pale lavender
    .init(color: .clear, location: 1.00),
  ]
  static let coolStops: [Gradient.Stop] = [
    .init(color: .clear, location: 0.00),
    .init(color: Color(hex: "#ff9fd4").opacity(0.70), location: 0.12),  // light pink
    .init(color: Color(hex: "#ff88cc").opacity(0.80), location: 0.34),  // pink
    .init(color: Color(hex: "#c3a8ff").opacity(0.76), location: 0.58),  // lavender
    .init(color: Color(hex: "#a3e6dc").opacity(0.58), location: 0.80),  // soft turquoise
    .init(color: Color(hex: "#c6efe8").opacity(0.32), location: 0.94),  // pale turquoise
    .init(color: .clear, location: 1.00),
  ]
  static let pinkStops: [Gradient.Stop] = [   // faint middle beam, no accent
    .init(color: .clear, location: 0.00),
    .init(color: Color(hex: "#ff9fd4").opacity(0.66), location: 0.15),
    .init(color: Color(hex: "#ff88cc").opacity(0.76), location: 0.50),
    .init(color: Color(hex: "#c3a8ff").opacity(0.64), location: 0.82),
    .init(color: .clear, location: 1.00),
  ]

  var body: some View {
    ZStack {
      Circle()
        .fill(RadialGradient(stops: spectrum, center: .center,
                             startRadius: size * 0.13, endRadius: size * 0.52))
      // THE TRACKS CATCH THE FAN'S LIGHT (owner, 11.09: "make them more
      // visible near the reflected area on the rainbow"). The SAME pitch and
      // phase as the disc's base tracks (pressedRingStops), so this reads as
      // those tracks lit rather than a second set beating against them.
      // Screened over the spectrum inside this group, so the colour is broken
      // into the fine concentric lines a real pressing shows most where it
      // throws a rainbow. The hub graphic covers the inner turns.
      Circle()
        .fill(RadialGradient(stops: pressedRingStops(0.60), center: .center,
                             startRadius: 0, endRadius: size / 2))
        .blendMode(.screen)
    }
    // Flatten the spectrum + tracks before the wedge mask and the outer
    // screen apply, so the inner `.screen` composites against the spectrum
    // rather than against the disc behind the whole fan.
    .compositingGroup()
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

/// The pressed CD's fine concentric tracks, as gradient stops. A real disc's
/// data pitch is a few hundred nanometres — far below anything a screen can
/// resolve — so what a photo shows is a soft shimmer, not rings you could
/// count. HAIRLINES 11.09 (owner: "reduce the groove thickness significantly —
/// make them hairline thickness"): a tighter 0.06 pitch with the lit band only
/// 0.006 wide, roughly a single pixel per groove.
///
/// Shared by two callers at the SAME pitch and phase so they align instead of
/// beating: the disc's faint base layer everywhere (low opacity), and each
/// DiffractionFan's brighter tracks inside its own wedge (owner: "make them
/// more visible near the reflected area on the rainbow") — a real pressing
/// shows its tracks most where the rainbow lands.
///
/// A free function rather than inline so the locations are unambiguously
/// CGFloat — an implicit Double bridge is the kind of thing that compiles
/// locally and costs a build cycle when it does not, and Swift cannot be
/// compiled in the environment this is written in.
fileprivate func pressedRingStops(_ opacity: Double) -> [Gradient.Stop] {
  var out: [Gradient.Stop] = []
  var t: CGFloat = 0
  while t < 1 {
    out.append(Gradient.Stop(color: .white.opacity(opacity), location: t))
    out.append(Gradient.Stop(color: .clear, location: min(1, t + 0.006)))
    t += 0.06
  }
  return out
}

/// A disc with the last cover printed on it, under the diffraction the plastic
/// throws. The rainbow sits OVER the art rather than under it, because a CD's
/// sheen is on its surface — the app's own CD deck settled this on 03.08.
struct CompactDisc: View {
  let cover: Image?
  let accent: Color

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
          // ONLY A FAINT TINT UNDER THE MIRROR now that a clear-silver lift
          // sits over the whole face (below, 11.09). Darkening the art hard
          // was what made a clear disc read as a dark print; -0.10/0.92
          // leaves the cover just legible under the silver rather than
          // carrying the disc's brightness itself.
          .brightness(-0.10).saturation(0.92)
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
      // The two main beams are NO LONGER IDENTICAL (owner 11.09): the warm
      // beam carries the faint orange, the cool beam the turquoise, both
      // pink/purple-led and lighter than before so the face stays soft.
      //
      // WIDER AND AT FULL STRENGTH (owner, 14.09: "the rainbow reflective
      // effect is also missing, or it's not as visible"). Prototyped first in
      // docs/design/cd_widget.py, with the numbers written as SwiftUI will
      // draw them — `strength` lands as `.opacity`, which clamps at 1, so a
      // mockup leaning on a multiplier past that would be showing something
      // the widget cannot do. Measured on the prototype: the share of the
      // disc carrying real colour goes 19.7% -> 42.4% and mean saturation
      // 0.108 -> 0.170, most of it from the silver wash below coming down
      // rather than from the fans themselves, which were already near full.
      DiffractionFan(size: size, bearing: 34, spread: 104, strength: 1.00,
                     spectrum: DiffractionFan.warmStops)
      DiffractionFan(size: size, bearing: 214, spread: 92, strength: 1.00,
                     spectrum: DiffractionFan.coolStops)
      // A third, much fainter fan — a real disc catches a weaker second source
      // (a window, a wall) as well as the main one, and one lone fan reads as
      // a mistake rather than as light. Pink/purple only, no accent.
      DiffractionFan(size: size, bearing: 128, spread: 56, strength: 0.39,
                     spectrum: DiffractionFan.pinkStops)

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

      // ── THE CLEAR-SILVER LIFT ─────────────────────────────────────────
      //
      // Owner, 11.09: "can the CD look more whiter — it currently looks too
      // dark for a clear CD". A pressed disc's data land is bright silver
      // metal, not a dark print, and the night-photo cover underneath was
      // holding the whole face down (measured on the prototype
      // docs/design/cd_widget.py, B's median luminance sat at ~48).
      //
      // A uniform silver SCREEN over the face lifts the darks toward silver
      // while the fans and the specular sweep keep their own brightness
      // (screen keeps the lighter of the two), so the disc reads as a clear
      // pressing without washing the rainbow back into the flat colour-wheel
      // of the old build-45 look. On the prototype this moves B's median
      // luminance from ~48 to ~93 — a clear disc, the fans still localised.
      //
      // 0.42 -> 0.30 (14.09). This wash is the one thing that lifts a dark
      // cover toward metal AND the one thing that washes the rainbow out, so
      // it is the real dial for "the rainbow is not as visible" — the fans
      // above were already close to full. Dropped rather than removed: at
      // 0.30 the disc still reads as silver where no fan lands.
      Circle().fill(Color(white: 0.62))
        .blendMode(.screen)
        .opacity(0.30)

      // The base pressed tracks, faint everywhere on the silver (opacity
      // 0.015, thinned). The DiffractionFans lift these SAME tracks where the
      // rainbow lands, so what reads as "grooves in the rainbow" is the base
      // shimmer lit rather than a second set of lines.
      Circle().fill(
        RadialGradient(stops: pressedRingStops(0.015), center: .center,
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
