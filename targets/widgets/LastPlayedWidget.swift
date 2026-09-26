import AppIntents
import SwiftUI
import WidgetKit

/**
 * LAST PLAYED — the song, as an object.
 *
 * THREE LOOKS OF ONE IDEA, not three widgets. Each of these shows the same
 * thing: the last song the app saw, and which station it came from. They
 * differ only in what they pretend to be — a desktop CD player, a pocket
 * player, a ticket stub. That is exactly what a Look setting is for, and it
 * keeps the gallery at one row instead of three (the same reasoning as
 * DeckLook, written out there).
 *
 * THE PICTURE IS THE SONG'S OWN COVER, falling back to the station's
 * photograph when there isn't one. It was the other way round from 03.09 to
 * 20.09, on the owner's reasoning that a custom station's photograph would
 * otherwise never appear anywhere; On Air, Start Drive and the Deck's Road
 * look all show it now, so that no longer held, and a widget called LAST
 * PLAYED showing something other than the last played thing was the first
 * thing the app's only regular outside user noticed, twice. See
 * Art.songCover, which carries the full reversal.
 *
 * IT SAYS "LAST PLAYED" AND NEVER "NOW PLAYING", in every look. A widget is
 * redrawn a handful of times a day, so by the time anyone reads this the song
 * has usually changed — "now playing" would be wrong most of the time it was
 * seen. "Last played" is a claim about the PAST and stays true however stale
 * the widget gets. That one word is the whole honesty of this widget and is
 * the thing to protect if it is ever redrawn.
 *
 * WITH NOTHING REMEMBERED IT SAYS SO rather than inventing a song. A player
 * with an empty screen is a real state and reads fine; a made-up track does
 * not.
 */
@available(iOSApplicationExtension 17.0, *)
enum LastPlayedLook: String, AppEnum {
  /// The desktop CD player — the Y2K window the share cards already use.
  case cdPlayer
  /// A pocket player: a screen, a cover, and a control ring.
  case player
  /// The drive as a ticket stub, torn across the middle.
  case stub

  static let defaultLook: LastPlayedLook = .cdPlayer

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Look"
  static var caseDisplayRepresentations: [LastPlayedLook: DisplayRepresentation] = [
    .cdPlayer: DisplayRepresentation(title: "CD player",
                                     subtitle: "The song in a desktop window"),
    .player: DisplayRepresentation(title: "Pocket player",
                                   subtitle: "A little player with your station on its screen"),
    .stub: DisplayRepresentation(title: "Ticket stub",
                                 subtitle: "The drive as a printed stub"),
  ]
}

@available(iOSApplicationExtension 17.0, *)
struct LastPlayedLookIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Last Played"
  static var description = IntentDescription("Choose how the song is drawn.")

  @Parameter(title: "Look", default: .cdPlayer)
  var look: LastPlayedLook

  /// Which station this tile follows. Nil (and the sentinel's empty id) mean
  /// "my last station", which is what this widget did before pinning existed.
  /// The SONG is always the last one the app heard — pinning a station does
  /// not pin a song, because there is only ever one last song. See
  /// StationPick.swift.
  @Parameter(title: "Station")
  var station: StationEntity?

  init() {}
  init(look: LastPlayedLook) { self.look = look }
}

/// Version-agnostic, so the pre-17 fallback can name a look without importing
/// AppIntents — the same split DeckStyle makes for the Deck.
enum LastPlayedStyle { case cdPlayer, player, stub }

struct LastPlayedEntry: TimelineEntry {
  let date: Date
  let station: WidgetStation?
  let lastPlayed: LastPlayedInfo?
  let ready: Bool
  let style: LastPlayedStyle
}

// The pinned station arrives as a bare id, not a StationEntity: the entity is
// iOS 17 only and this is shared with the plain provider older phones get.
private func lpEntry(_ style: LastPlayedStyle, pinned: String? = nil) -> LastPlayedEntry {
  guard let snap = SnapshotStore.load() else {
    return LastPlayedEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: style)
  }
  // Pinned, else the last drive, else whatever is on air — so a first-time
  // listener gets a real station rather than an empty frame.
  return LastPlayedEntry(date: Date(), station: snap.station(pinned: pinned),
                         lastPlayed: snap.lastPlayed, ready: true, style: style)
}

private func lpTimeline(_ style: LastPlayedStyle, pinned: String? = nil) -> Timeline<LastPlayedEntry> {
  // One entry, refreshed in an hour. The song only changes when the app plays
  // one, and the app republishes the snapshot whenever it is backgrounded —
  // a far better signal than any schedule guessed at here.
  Timeline(entries: [lpEntry(style, pinned: pinned)],
           policy: .after(Date().addingTimeInterval(3600)))
}

struct LastPlayedProvider: TimelineProvider {
  func placeholder(in c: Context) -> LastPlayedEntry {
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
    lpEntry(.cdPlayer)
  }
  func getSnapshot(in c: Context, completion: @escaping (LastPlayedEntry) -> Void) {
    completion(lpEntry(.cdPlayer))
  }
  func getTimeline(in c: Context, completion: @escaping (Timeline<LastPlayedEntry>) -> Void) {
    completion(lpTimeline(.cdPlayer))
  }
}

@available(iOSApplicationExtension 17.0, *)
struct LastPlayedIntentProvider: AppIntentTimelineProvider {
  func placeholder(in c: Context) -> LastPlayedEntry {
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
    lpEntry(.cdPlayer)
  }
  func snapshot(for configuration: LastPlayedLookIntent, in c: Context) async -> LastPlayedEntry {
    lpEntry(style(configuration.look), pinned: configuration.station?.id)
  }
  func timeline(for configuration: LastPlayedLookIntent, in c: Context) async -> Timeline<LastPlayedEntry> {
    lpTimeline(style(configuration.look), pinned: configuration.station?.id)
  }
  private func style(_ look: LastPlayedLook) -> LastPlayedStyle {
    switch look {
    case .cdPlayer: return .cdPlayer
    case .player:   return .player
    case .stub:     return .stub
    }
  }
}

// ── the drawing ────────────────────────────────────────────────────────────

private let paper = Color(red: 0.969, green: 0.953, blue: 0.914)
private let paperDeep = Color(red: 0.914, green: 0.890, blue: 0.831)
private let paperInk = Color(red: 0.106, green: 0.122, blue: 0.153)
/// The Y2K window's greys, lifted straight from the share card so the two
/// cannot end up being different shades of the same joke.
private let face = Color(red: 0.765, green: 0.780, blue: 0.796)
private let faceLit = Color(red: 0.875, green: 0.890, blue: 0.902)
private let faceDim = Color(red: 0.506, green: 0.541, blue: 0.580)

struct LastPlayedView: View {
  var entry: LastPlayedEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      // ── THE TALL TILE ─────────────────────────────────────────────────
      // Ethan, 23.09, with a mockup of his own: the Pocket Player "as a
      // Face", drawn tall with the screen above and the wheel below. The
      // owner picked that arrangement off `docs/design/big_tiles.py`.
      //
      // ALL THREE LOOKS GET A TALL ARRANGEMENT, and that is not generosity
      // — `.supportedFamilies` sits on the WIDGET, not on the look, so a
      // size offered for the player is offered for the CD window and the
      // stub as well. Without a tall arrangement those two would be drawn
      // stretched at a size the gallery advertises, which reads as a bug
      // rather than a choice.
      //
      // THE TALL VERSIONS SHARE THEIR PARTS WITH THE WIDE ONES rather than
      // being redrawn (`playerScreen`, `cdTitleBar`, `cdBody`, `caseMetal`,
      // `controlWheel`): they are one look at two sizes, which is the whole
      // claim the gallery row makes, and a second copy of a drawing is a
      // second thing that can drift from the one being judged.
      if family == .systemLarge {
        switch entry.style {
        case .cdPlayer: cdPlayerTall(s)
        case .player:   playerTall(s)
        case .stub:     stubTall(s)
        }
      } else {
        switch entry.style {
        case .cdPlayer: cdPlayer(s)
        case .player:   player(s)
        case .stub:     stub(s)
        }
      }
    }
  }

  // ── THE CD PLAYER ───────────────────────────────────────────────────────
  // Owner, 03.09: "make sure the card isn't [floating] inside the bubble.
  // Create the Winamp as if it's the shape of the widget." So the window IS
  // the widget — the title bar runs to the edges and the bevel is the
  // widget's own rim, rather than a little grey card sitting inside a rounded
  // rectangle with a gap all round it.
  private func cdPlayer(_ s: WidgetStation) -> some View {
    ZStack(alignment: .topLeading) {
      // THE FACE CATCHES THE LIGHT AT THE TOP AND DOES NOT DARKEN AT THE FOOT.
      //
      // Owner, 14.09: "the winamp widget still has that bottom vignette -
      // could we remove it? i really don't know where this is coming from."
      // She could not find it because it was never a layer — the foot BAND
      // came off on 09.09 when she first asked, and what was left is this
      // gradient's own last stop, `faceDim.opacity(0.30)`, which shades the
      // bottom of the panel from inside the fill that makes it plastic. Two
      // different things wearing the same appearance, which is exactly why
      // removing one of them looked like nothing had happened.
      //
      // The top lift stays: a moulded panel is lit from above and 03.09 added
      // this shading precisely because dropping the raised rim had left the
      // window reading flat. Only the darkening goes, so the face runs even
      // from just below the title bar to the bottom edge.
      LinearGradient(colors: [faceLit.opacity(0.55), face, face, face],
                     startPoint: .top, endPoint: .bottom)
      // NO FRAME AROUND THE WINDOW. This drew a raised bevel round the whole
      // widget and inset the title bar by 4pt, which left a grey rectangle
      // between the widget's own edge and the orange — the owner called it
      // twice: "make sure that this is gone and that the card is the shape of
      // the widget itself." The window IS the widget, so the title bar runs
      // into the top corners and the body runs into the bottom ones.
      //
      // The raised/sunken language is not lost by dropping it: it lives on
      // the BUTTONS and the FIELDS inside, which is where anyone reads it.
      VStack(spacing: 0) {
        cdTitleBar(s)
        cdBody(s, cover: 106)
      }

      // ── THE EDGES ───────────────────────────────────────────────────────
      // Owner, 03.09: "create shadowing on the edges of the winamp - so it
      // looks less flat." Losing the raised frame in the previous round is
      // what flattened it, and the frame is not coming back — she asked for
      // that gone twice.
      //
      // SO THIS IS SHADING, NOT A RIM: every one of these is a gradient that
      // fades to nothing INWARD, so there is no edge anywhere for the eye to
      // catch. A hard-edged stroke at the boundary is exactly the rectangle
      // border that was removed, however thin it is drawn — the app's own
      // decks learned the same thing about light (25.08: any light drawn as a
      // hard-edged shape eventually reads as a drawn artefact).
      WindowShading()
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /// THE TITLE BAR, SHARED BY BOTH SIZES. The tall window is the same
  /// window, so its bar has to be the same bar — drawn twice it is two
  /// things that can drift, which is how a look ends up with two versions
  /// of itself in one gallery row.
  ///
  /// `big` IS THE LARGE TILE'S OWN SIZE, AND IT EXISTS BECAUSE NOT HAVING IT
  /// WAS A FAULT. Owner, 25.09: "the texts needs to scale larger — they're
  /// currently really small compared to how much empty space there is." She
  /// is right, and it is the mirror image of the case-furniture fault found
  /// the day before: that one multiplied moulded detail by `k` when it should
  /// not have been scaled at all, and this one scaled NOTHING — the bar and
  /// the fields are shared with the medium window, so they set at 15/11/12pt
  /// on a tile whose value boxes are nearly twice as wide and which carries
  /// four rows instead of two. The box grew and the type did not.
  ///
  /// MEASURED AGAINST THE APP'S OWN Y2K SHARE CARD, which is what she is
  /// comparing it to: its field box is 64 tall with 34px type (0.53 of the
  /// row) and its title bar 66 with 38px (0.58). The widget's were 26 with
  /// 12pt (0.46) and 32 with 15pt (0.47).
  private func cdTitleBar(_ s: WidgetStation, big: Bool = false,
                         k: CGFloat = 1) -> some View {
    // `k` DEFAULTS TO 1, so the medium window is provably unchanged rather
    // than trusted — the same rule the 25.09 round used when the two sizes
    // started sharing this bar.
    HStack(spacing: 8 * k) {
      discGlyph(size: (big ? 20 : 18) * k)
      // NOT hardcoded white: the bar is the station's own colour now, so
      // a cream station gets near-black lettering and a navy one white.
      // See titleBarInk in Snapshot.swift for why that is measured.
      Text("Cruise FM").font(pixelFont((big ? 19 : 15) * k)).foregroundColor(s.titleBarInk)
      Spacer(minLength: 4 * k)
      ForEach(["_", "[]", "X"], id: \.self) { c in
        ZStack {
          face
          bevel(raised: true, width: 2)
          Text(c).font(pixelFont((big ? 11 : 10) * k)).foregroundColor(paperInk)
        }
        .frame(width: (big ? 22 : 20) * k, height: (big ? 19 : 17) * k)
      }
    }
    .padding(.horizontal, 10 * k)
    .frame(height: (big ? 36 : 32) * k)
    // THE STATION'S OWN COLOUR (owner, 09.09: "im not sure where that
    // yellow top banner is coming from — change it to the colour of the
    // chosen station"). It replaces the prototype's fixed gold.
    //
    // IT IS A DERIVED RAMP, NOT THE ACCENT ITSELF, and the reason is a
    // bug that already shipped once: build 42 dropped the station's
    // accent into the MIDDLE stop of the gold, which broke the one-way
    // dark-to-light ramp a title bar needs AND put a near-white band
    // under white type for a pale custom station. `titleBarRamp` takes
    // the station's hue and saturation and replaces the brightness
    // outright, then pulls the whole ramp down if its bright end would
    // out-shine the gold — so white type here is never worse than on the
    // look that was signed off. MEASURED across the palette: the gold's
    // bright end is 2.22:1 against white and the worst station is 2.37.
    .background(s.titleBarRamp)
  }

  /// The window's contents: the cover, the two fields and the foot row.
  /// `cover` is the only thing that differs between the two sizes.
  private func cdBody(_ s: WidgetStation, cover: CGFloat) -> some View {
    HStack(alignment: .top, spacing: 11) {
      ZStack {
        Color.white
        bevel(raised: false, width: 2)
        if let art = Art.songCover(station: s.image) {
          art.resizable().aspectRatio(contentMode: .fill).padding(3)
        } else {
          // Neither a cover nor a photograph: a custom station with no
          // picture. Its own colour, not a grey slab.
          s.gradient.padding(3)
        }
      }
      .frame(width: cover, height: cover)
      .clipped()

      VStack(alignment: .leading, spacing: 7) {
        field("Artist:", entry.lastPlayed?.artist ?? "—")
        field("Track:", entry.lastPlayed?.title ?? "—")
        Spacer(minLength: 0)
        HStack(spacing: 9) {
          ZStack {
            face
            bevel(raised: true, width: 2)
            Triangle().fill(paperInk).frame(width: 11, height: 13).offset(x: 1)
          }
          .frame(width: 52, height: 27)
          // faceDim is a grey tuned for the chrome around it, and against
          // the panel it sat at roughly 1.9:1 — present, unreadable, and
          // reading as disabled rather than quiet. paperInk at 0.62 is the
          // same ink the fields use, stepped back.
          Text("\(s.name) · \(s.dial)").font(pixelFont(10))
            .foregroundColor(paperInk.opacity(0.62)).lineLimit(1)
        }
      }
    }
    .padding(.horizontal, 12)
    .padding(.top, 4)
    .padding(.bottom, 12)
  }

  /// `arrow` draws the dropdown tip a period dialog puts on a combo box. It
  /// is window furniture and claims nothing — unlike a slider or a state
  /// toggle, a tip does not assert a value we would have to know.
  private func field(_ caption: String, _ value: String, arrow: Bool = false,
                     h: CGFloat = 26, cap: CGFloat = 11, val: CGFloat = 12,
                     capW: CGFloat = 52, k: CGFloat = 1) -> some View {
    // `k` defaults to 1, so the medium window's two fields are byte-identical
    // arithmetic — the sizes it passes are already explicit.
    HStack(spacing: 7 * k) {
      // 52, AND IT WAS MEASURED OFF THE ttf's OWN hmtx RATHER THAN GUESSED,
      // twice now. At 11pt in DotGothic16: "Artist:" 38.50, "Track:" 33.00,
      // "Mode:" 27.50 and — the one that moved this number — "Station:"
      // 44.00. It was 46, which is 2pt of headroom on the longest caption,
      // and 40 before that, where 1.5pt of headroom on "Artist:" was spent
      // truncating it to "Arti···". `fixedSize` on top of that: this is a
      // static label, so it must never be the thing that gives way — if
      // anything has to shrink it is the value beside it, which is free to.
      Text(caption).font(pixelFont(cap)).foregroundColor(paperInk)
        .fixedSize().frame(width: capW, alignment: .leading)
      ZStack {
        Color.white
        bevel(raised: false, width: 2)
        HStack(spacing: 0) {
          Text(value).font(pixelFont(val)).foregroundColor(.black)
            .lineLimit(1).padding(.horizontal, 7 * k)
            .frame(maxWidth: .infinity, alignment: .leading)
          if arrow {
            ZStack {
              face
              bevel(raised: true, width: 2)
              // THE TARGET'S OWN SHAPE, not a character. A "\u{25BC}" would
              // depend on the system font covering it, and this extension
              // cannot be compiled or rendered here to find out it does not —
              // a triangle turned over cannot fail that way.
              Triangle().fill(paperInk).frame(width: 7 * k, height: 5 * k)
                .rotationEffect(.degrees(180))
            }
            .frame(width: h - 8 * k, height: h - 6 * k)
            .padding(.trailing, 3 * k)
          }
        }
      }
      .frame(height: h)
    }
  }

  /// The little rainbow disc in the title bar — a CD seen face-on.
  private func discGlyph(size: CGFloat) -> some View {
    ZStack {
      Circle().fill(
        AngularGradient(colors: [Color(hex: "#8fd8ff"), Color(hex: "#c9a7ff"), Color(hex: "#ffb4dc"),
                                 Color(hex: "#ffe1a3"), Color(hex: "#b9ffd9"), Color(hex: "#8fd8ff")],
                        center: .center))
      Circle().stroke(.white.opacity(0.6), lineWidth: 1.5)
      Circle().fill(face).frame(width: size * 0.34, height: size * 0.34)
    }
    .frame(width: size, height: size)
  }

  /// Raised or sunken chrome, as two inset strokes. SwiftUI has no inset box
  /// shadow, so the bevel is drawn as borders on the shape itself.
  private func bevel(raised: Bool, width: CGFloat) -> some View {
    let lit = raised ? Color.white : faceDim
    let dim = raised ? faceDim : Color.white
    return ZStack {
      VStack(spacing: 0) { lit.frame(height: width); Spacer(minLength: 0); dim.frame(height: width) }
      HStack(spacing: 0) { lit.frame(width: width); Spacer(minLength: 0); dim.frame(width: width) }
    }
    .allowsHitTesting(false)
  }

  // ── THE POCKET PLAYER ───────────────────────────────────────────────────
  // The owner's own idea, from a photograph of an iPod.
  //
  // IT IS DRAWN AS *A* PLAYER, NOT AS AN iPOD, AND THAT IS DELIBERATE. The
  // recognisable part of that object is a click wheel with four printed
  // commands and a MENU above them; that is Apple's own industrial design,
  // and this app is submitted to Apple. So the wheel here is a plain ring
  // with no printing on it and the proportions are the widget's own. The
  // nostalgia survives the change; the trade-dress problem does not.
  //
  // AND THE RING DOES NOTHING, ON PURPOSE. A widget can carry real buttons
  // since iOS 17, but Cruise FM does not play the audio — Spotify and Apple
  // Music do — so a skip button would have to reach a music service from
  // inside this extension, which is its own round of work. Until then the
  // ring is ornament, the way the cassette's reels are ornament, and it is
  // kept plain rather than made the hero so it does not read as a control
  // that is broken.
  private func player(_ s: WidgetStation) -> some View {
    ZStack {
      caseMetal
      HStack(spacing: 0) {
        playerScreen(s, cover: 74, title: 17, artist: 12, eyebrow: 7.5,
                     dialSize: 10, pad: 10)
          .padding(.vertical, 14)
          .padding(.leading, 14)
        // SMALLER THAN IT WAS (112 / 17), because it was winning an argument
        // it should not have been in: at 112 plus its padding the ring took
        // 146 of the widget's 338 points — 43% of the tile for something that
        // is deliberately ornament — and the SONG, which is what this widget
        // is about, was left with about 73 and printed "Breaka…". This gives
        // the title back 24 points and costs the ring nothing anyone reads.
        controlWheel(diameter: 96)
          .padding(.horizontal, 13)
      }
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /**
   * THE SAME PLAYER, STOOD UP (Ethan, 23.09, with a mockup of his own: the
   * Pocket Player "as a Face"). The owner picked this arrangement over a
   * cover-led one off `docs/design/big_tiles.py`: the screen keeps the
   * cover BESIDE the words, exactly as the wide tile does, and the wheel
   * moves from the right-hand side to underneath.
   *
   * SO IT IS ONE OBJECT AT TWO SIZES, NOT TWO LOOKS. Every part comes from
   * the same three helpers the wide tile uses, and the only things that
   * differ are the numbers handed to them — which is what stops the tall
   * version quietly becoming a different player over the next few rounds.
   *
   * THE HEIGHTS ARE SPENT DELIBERATELY: screen 172, wheel 128, 12 between
   * them and 14 of case all round comes to 340 of a 354pt tile, so there is
   * 14pt of slack and nothing has to be compressed to fit. Drawn any other
   * way round — a taller screen, a smaller wheel — the wheel stops reading
   * as the object it is and becomes a button.
   */
  private func playerTall(_ s: WidgetStation) -> some View {
    ZStack {
      caseMetal
      VStack(spacing: 12) {
        playerScreen(s, cover: 108, title: 20, artist: 13, eyebrow: 8.5,
                     dialSize: 11, pad: 14)
          .frame(height: 172)
        controlWheel(diameter: 128)
      }
      .padding(14)
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /// THE BRUSHED-SILVER CASE, shared by both sizes (owner, 09.09: "the
  /// surface is looking too flat, enhance detail with silver and shading").
  /// The old face was one four-stop diagonal ramp across the whole widget,
  /// which is a painted panel — a real metal case is lit from ABOVE, catches
  /// one broad sheen across its middle, and turns out of the light at every
  /// edge.
  ///
  /// EVERY LAYER IS FALLOFF AND NOTHING IS A STROKE, which is this file's
  /// own rule (03.09): a hard edge anywhere on the face reads as a drawn
  /// border, and the owner has now made that note twice about the Winamp.
  /// The sheen fades to nothing at both ends for the same reason.
  private var caseMetal: some View {
    ZStack {
      LinearGradient(colors: [Color(white: 0.97), Color(white: 0.90),
                              Color(white: 0.83), Color(white: 0.78)],
                     startPoint: .top, endPoint: .bottom)
      LinearGradient(stops: [
        .init(color: .clear, location: 0.10),
        .init(color: .white.opacity(0.42), location: 0.32),
        .init(color: .clear, location: 0.54),
      ], startPoint: .topLeading, endPoint: .bottomTrailing)
      LinearGradient(stops: [
        .init(color: .clear, location: 0.58),
        .init(color: .white.opacity(0.20), location: 0.74),
        .init(color: .clear, location: 0.92),
      ], startPoint: .topLeading, endPoint: .bottomTrailing)
      MetalShading()
    }
  }

  /// The sunken screen. One helper for both sizes — see `playerTall`.
  private func playerScreen(_ s: WidgetStation, cover: CGFloat, title: CGFloat,
                            artist: CGFloat, eyebrow: CGFloat,
                            dialSize: CGFloat, pad: CGFloat) -> some View {
    ZStack {
      RoundedRectangle(cornerRadius: 5).fill(Color(hex: "#0a0c12"))
      // THE SCREEN IS SUNK INTO THE CASE, so its surround is dark where the
      // metal turns down into the well and lit where it comes back up on the
      // far side. One even grey stroke reads as a drawn box.
      RoundedRectangle(cornerRadius: 5).stroke(
        LinearGradient(colors: [Color(white: 0.34), Color(white: 0.58),
                                Color(white: 0.96)],
                       startPoint: .top, endPoint: .bottom), lineWidth: 2)

      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .top, spacing: 11) {
          playerCover(s, size: cover)
          VStack(alignment: .leading, spacing: 4) {
            Text(entry.lastPlayed?.title ?? s.name)
              .font(.system(size: title, weight: .heavy))
              .foregroundColor(.white).lineLimit(2).minimumScaleFactor(0.7)
            if let lp = entry.lastPlayed {
              Text(lp.artist).font(.system(size: artist))
                .foregroundColor(.white.opacity(0.66)).lineLimit(1)
            }
          }
          Spacer(minLength: 0)
        }
        Spacer(minLength: 4)
        // NO PROGRESS BAR. A bar claims a position in a song, and the only
        // thing known here is that this played at some point.
        HStack {
          Text("LAST PLAYED").font(.system(size: eyebrow, weight: .heavy)).tracking(1.3)
            .foregroundColor(.white.opacity(0.48))
          Spacer(minLength: 4)
          DialText(dial: s.dial, size: dialSize, color: .white.opacity(0.58))
        }
      }
      .padding(pad)
    }
  }

  /// THE COVER, SIZED THEN CLIPPED — and the order is the fix for a bug that
  /// shipped in build 43.
  ///
  ///     art.resizable().aspectRatio(contentMode: .fill)
  ///       .clipShape(RoundedRectangle(cornerRadius: 3))
  ///     ...
  ///     .frame(width: 74, height: 74)
  ///
  /// `.clipShape` there trims the image to ITS OWN bounds, which `.fill` has
  /// already made larger than the slot, so it clips nothing at all; and
  /// `.frame` on the ZStack fixes the size this stack REPORTS without
  /// clipping what is drawn inside it. So a 74pt slot drew a photograph a
  /// widget and a half tall, over the tile's rounded corners and across
  /// LAST PLAYED. `cruiseBackdrop` gives the image a box that accepts the
  /// proposal, and the corner rounding moves onto the stack where it bites.
  private func playerCover(_ s: WidgetStation, size: CGFloat) -> some View {
    ZStack {
      RoundedRectangle(cornerRadius: 3).fill(Color(white: 0.16))
      if let art = Art.songCover(station: s.image) {
        art.cruiseBackdrop()
      } else {
        s.gradient
      }
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: 3))
  }

  /// THE CONTROL: A PLAIN RING, DELIBERATELY UNLABELLED.
  ///
  /// The recognisable part of an iPod is a click wheel with four printed
  /// commands and a MENU above them; that is Apple's own industrial design,
  /// and this app is submitted to Apple. So the wheel here carries no
  /// printing and the proportions are the widget's own. The nostalgia
  /// survives the change; the trade-dress problem does not.
  ///
  /// AND THE RING DOES NOTHING, ON PURPOSE. A widget can carry real buttons
  /// since iOS 17, but Cruise FM does not play the audio — Spotify and Apple
  /// Music do — so a skip button would have to reach a music service from
  /// inside this extension, which is its own round of work. Until then it is
  /// ornament, the way the cassette's reels are, and it is kept plain rather
  /// than made the hero so it cannot read as a control that is broken.
  ///
  /// EVERY PART IS A SHARE OF THE DIAMETER, so the tall tile's larger wheel
  /// is the same wheel rather than a second drawing: at 96 these are exactly
  /// the numbers the medium tile shipped with (46, 40, 14, 34, 52).
  private func controlWheel(diameter d: CGFloat) -> some View {
    ZStack {
      Circle().fill(
        LinearGradient(colors: [Color(white: 0.99), Color(white: 0.86), Color(white: 0.77)],
                       startPoint: .topLeading, endPoint: .bottomTrailing))
      // A MACHINED RING IS BRIGHT WHERE THE LAMP IS AND DARK OPPOSITE, so
      // its edge is a sweep rather than one flat line — the same argument
      // that took the record's rim off a plain stroke on 04.09.
      Circle().strokeBorder(
        AngularGradient(stops: [
          .init(color: .white.opacity(0.95), location: 0),
          .init(color: .black.opacity(0.10), location: 0.30),
          .init(color: .white.opacity(0.55), location: 0.56),
          .init(color: .black.opacity(0.14), location: 0.82),
          .init(color: .white.opacity(0.95), location: 1),
        ], center: .center, angle: .degrees(-130)), lineWidth: 1.6)
      // the dish: the wheel's face falls away toward its middle
      Circle().fill(
        RadialGradient(colors: [.black.opacity(0.13), .clear],
                       center: .center, startRadius: 0, endRadius: d * 0.479))
      Circle().fill(
        LinearGradient(colors: [Color(white: 0.97), Color(white: 0.86), Color(white: 0.80)],
                       startPoint: .top, endPoint: .bottom))
        .frame(width: d * 0.417, height: d * 0.417)
      // the hub sits proud: a lit crown, a shadow under its far side
      Circle().strokeBorder(
        LinearGradient(colors: [.white.opacity(0.90), .black.opacity(0.12)],
                       startPoint: .top, endPoint: .bottom), lineWidth: 1.2)
        .frame(width: d * 0.417, height: d * 0.417)
      Circle().fill(
        RadialGradient(colors: [.clear, .black.opacity(0.16)],
                       center: .init(x: 0.5, y: 0.16),
                       startRadius: d * 0.146, endRadius: d * 0.354))
        .frame(width: d * 0.542, height: d * 0.542)
    }
    .frame(width: d, height: d)
  }

  // ── THE STUB ────────────────────────────────────────────────────────────
  // THE TICKET IS A BOARDING PASS NOW (owner, 09.09: "the barcode is way too
  // long... rearrange the ticket so the dotted line runs vertically, and the
  // barcode is vertical and on the right — like a plane ticket. The text sits
  // on the left"). She picked arrangement B off `docs/design/ticket.py`, drawn
  // at this widget's real 338x158: the tear runs the FULL height, so the
  // counterfoil is a genuinely detachable stub carrying its own slice of the
  // banner rather than a strip hanging under one.
  //
  // THAT ALSO FIXES THE BARCODE BY GEOMETRY RATHER THAN BY TUNING. Across the
  // ticket's width it had to be 46 bars to read as printed at all, which is
  // the "far too long" she photographed; down a 58pt counterfoil the same
  // idea needs a couple of dozen and cannot compete with the song, because it
  // no longer shares an axis with it.
  private func stub(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [paper, paperDeep], startPoint: .top, endPoint: .bottom)

      HStack(spacing: 0) {
        // ── the half you keep ──────────────────────────────────────────────
        VStack(alignment: .leading, spacing: 0) {
          HStack {
            Text("CRUISE FM").font(.system(size: 10, weight: .heavy)).tracking(1.6)
              .foregroundColor(.white)
            Spacer()
            Text("ADMIT ONE").font(.system(size: 8, weight: .heavy)).tracking(1.4)
              .foregroundColor(.white.opacity(0.45))
          }
          .padding(.horizontal, 15)
          .frame(height: 30)
          .background(paperInk)

          VStack(alignment: .leading, spacing: 0) {
            Text("LAST PLAYED").font(.system(size: 8, design: .monospaced)).tracking(1.6)
              .foregroundColor(paperInk.opacity(0.45))
            if let lp = entry.lastPlayed {
              Text(lp.title).font(.system(size: 21, weight: .heavy))
                .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.6)
                .padding(.top, 1)
              Text(lp.artist).font(.system(size: 14))
                .foregroundColor(paperInk.opacity(0.62)).lineLimit(1).minimumScaleFactor(0.7)
            } else {
              Text(s.tagline).font(.system(size: 14))
                .foregroundColor(paperInk.opacity(0.55)).lineLimit(2).padding(.top, 2)
            }

            Spacer(minLength: 4)

            // The station and its dial sit at the foot, where a pass prints
            // the route. The dial is NOT ink-aligned here: nothing is stacked
            // above or below it, so there is no column for it to line up with.
            HStack(alignment: .bottom) {
              VStack(alignment: .leading, spacing: 1) {
                Text("STATION").font(.system(size: 8, design: .monospaced)).tracking(1.6)
                  .foregroundColor(paperInk.opacity(0.45))
                Text(s.name).font(.system(size: 15, weight: .heavy))
                  .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.7)
              }
              Spacer(minLength: 6)
              DialText(dial: s.dial, size: 14, color: paperInk)
            }
          }
          .padding(.horizontal, 14)
          .padding(.top, 10)
          .padding(.bottom, 11)
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        tear

        // ── the counterfoil ────────────────────────────────────────────────
        VStack(spacing: 0) {
          paperInk.frame(height: 30)
          barcode.padding(.top, 9).padding(.bottom, 3)
          Text(splitDial(s.dial).number).font(dialFont(9))
            .foregroundColor(paperInk.opacity(0.55))
            .padding(.bottom, 8)
        }
        .frame(width: 58)
      }
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /// THE TEAR RUNS THE WHOLE HEIGHT, and it changes colour half way down
  /// because what it crosses changes. Over the paper it is ink; over the
  /// banner an ink dash on an ink ground is invisible, so that stretch is
  /// white — the same hairline the prototype puts between the two halves of
  /// the banner. One colour the whole way would simply vanish at the top.
  ///
  /// Drawn as a stack of real dashes rather than a masked rule: a mask that
  /// does not size exactly to its host shifts the pattern, and there is no
  /// compiler here to catch it. The notches deliberately hang half off each
  /// edge — the tile clips them, which is what makes them read as bitten out.
  private var tear: some View {
    ZStack {
      VStack(spacing: 0) {
        dashes(4, color: .white.opacity(0.18)).frame(height: 30)
        dashes(15, color: paperInk.opacity(0.30)).frame(maxHeight: .infinity)
      }
      VStack(spacing: 0) {
        notch.offset(y: -6.5)
        Spacer(minLength: 0)
        notch.offset(y: 6.5)
      }
    }
    .frame(width: 1)
  }

  private var notch: some View {
    Circle().fill(Color.black.opacity(0.30)).frame(width: 13, height: 13)
  }

  private func dashes(_ count: Int, color: Color) -> some View {
    VStack(spacing: 4) {
      ForEach(0..<count, id: \.self) { _ in
        Rectangle().fill(color).frame(width: 1, height: 5)
      }
    }
  }

  /// THE BARCODE STANDS UP, down the counterfoil, which is where a boarding
  /// pass keeps it. Flexible spacers between the bars let it fill whatever
  /// height it is handed, so the count is not tied to the widget's size.
  private var barcode: some View {
    VStack(spacing: 0) {
      ForEach(0..<24, id: \.self) { i in
        Rectangle().fill(paperInk)
          .frame(width: i % 4 == 0 ? 22 : 30, height: i % 3 == 0 ? 3 : 2)
        if i < 23 { Spacer(minLength: 0.5) }
      }
    }
    .frame(maxHeight: .infinity)
  }

  // ── THE TALL ARRANGEMENTS ──────────────────────────────────────────────

  /**
   * THE CD PLAYER, TALL — the window IS the tile, and it carries the share
   * card's own right-hand cluster.
   *
   * THIS IS THE THIRD ROUND ON THIS LOOK AND EACH ONE REVERSED THE LAST ON
   * THE OWNER'S OWN EVIDENCE, so the reasoning is worth keeping in order.
   * 24.09 argued a Winamp window is a wide, short thing, so the honest tall
   * version is the window plus a record shelf under it — and it spent about
   * 60% of the tile on a disc in a lit room. 25.09 she put that on a phone
   * beside the app's Y2K SHARE CARD and the card plainly reads more like a
   * player: it fills its frame with WINDOW. That round made it a window and
   * left three faults, which she named in one message:
   *
   *   "Leave the progress bar out then and keep 'last played'. I want to
   *    have these contents on the right hand side. The designs are still
   *    missing a lot of details — there's too much empty space. Lastly the
   *    texts needs to scale larger."
   *
   * THE STRIP ABOVE THE TITLE BAR AND THE GAP AT THE FOOT WERE ONE FAULT.
   * The VStack was shorter than the tile, so SwiftUI centred it — which put
   * a band of window above the bar and an empty band below the last field.
   * It is pinned with `.frame(maxHeight: .infinity, alignment: .top)` and
   * the body's own Spacer, so the bar sits on the tile's top edge.
   *
   * AND THE WINDOW RUNS TO THE TILE'S OWN EDGE, which is what the MEDIUM
   * window has always done — "make sure that this is gone and that the card
   * is the shape of the widget itself", said twice. The tall one had drifted
   * to a 13pt border of room, so the two sizes of one look disagreed about
   * the most visible thing about them. The room gradients that border used
   * to show are gone with it rather than left underneath: a layer nothing
   * can reveal is a layer that will be tuned by somebody one day.
   */
  private func cdPlayerTall(_ s: WidgetStation) -> some View {
    GeometryReader { geo in
      let k = cdTallScale(geo.size)
      ZStack(alignment: .topLeading) {
        // The same face as the medium window, for the same reason: lit at
        // the top because a moulded panel is lit from above, and NOT
        // darkened at the foot (the vignette came off on 14.09).
        LinearGradient(colors: [faceLit.opacity(0.55), face, face, face],
                       startPoint: .top, endPoint: .bottom)
        VStack(spacing: 0) {
          cdTitleBar(s, big: true, k: k)
          cdBodyTall(s, k: k, tileH: geo.size.height)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        WindowShading()
      }
      // A GeometryReader ALIGNS ITS CONTENT TOP-LEADING, not centre, and the
      // face behind this window is greedy — without an explicit frame the
      // whole ZStack sizes to its largest child and hangs off two edges.
      // That is the fault that moved two Mode tiles on 15.09.
      .frame(width: geo.size.width, height: geo.size.height)
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /**
   * HOW BIG THIS WINDOW IS DRAWN — owner, 26.09, with the large tile on her
   * Home Screen: "it's looking a bit compressed at the top leaving an awkward
   * gap at the bottom. Can we space them out."
   *
   * SHE WAS LOOKING AT ONE FAULT WITH ONE CAUSE, AND IT WAS COUNTABLE BEFORE
   * ANYTHING WAS DRAWN. Every size in this window was a FIXED number of
   * points, and they added to 346 tall by 338 wide — which is the large tile
   * on a 393-wide iPhone, exactly. WidgetKit hands a large widget a different
   * box on every screen:
   *
   *   329 x 345  (SE, 13 mini)   346pt of content is 1pt OVER the tile
   *   338 x 354  (14/15/16)      exact, both axes — the one it was drawn for
   *   360 x 379  (Plus, XS Max)  33pt dead at the foot, 22pt dead at the right
   *   364 x 382  (Pro Max)       36pt dead at the foot, 26pt dead at the right
   *
   * It all collected at the FOOT because the stack is pinned with
   * `.frame(maxHeight: .infinity, alignment: .top)` — which is how 25.09
   * removed a strip ABOVE the title bar. So re-centring would simply have put
   * that strip back; the room has to be redistributed instead.
   *
   * SO THE CHOICE WAS ONE NUMBER, and she picked D off a four-way sheet
   * (`docs/design/cd_window_tall.py`): of the 36 spare points, how many go to
   * making things BIGGER and how many to putting AIR between them. B spent
   * them all on air, C all on size, D splits it — grow 4% and keep 22pt as
   * air, about 7pt at each of the three seams.
   *
   * THE CAP IS WHAT MAKES IT D RATHER THAN C. Without it this is the Mode
   * tile's own rule (14.09, `k = min(width, height) / 158`) and the window
   * simply fills the tile, leaving the gaps as tight as they are today. 1.04
   * is the share of the growth she chose to spend; the rest stays as air.
   *
   * AND IT SCALES DOWN AS WELL AS UP, which is the half no amount of air
   * could have fixed: on the smallest phone `fit` is 0.973, so the window
   * comes down to meet a tile its fixed sizes were 1pt too tall for.
   */
  private func cdTallScale(_ size: CGSize) -> CGFloat {
    min(size.width / 338, size.height / 354, 1.04)
  }

  /**
   * THE TALL WINDOW'S CONTENTS — cover and the full control cluster across
   * the top, four labelled fields the width of the window beneath, and the
   * one row the share card spends on a scrub bar spent on LAST PLAYED.
   *
   * WHAT COMES ACROSS FROM HER CARD, AND WHAT CANNOT. Every exclusion here
   * is this app's own honesty rule rather than a drawing problem, and the
   * list is SHORTER than the one written on 24.09 — that note said shuffle
   * and repeat "cannot come across", which was narrower than it needed to
   * be and is corrected below.
   *
   *   THE SCRUB BAR: no, and she dropped it herself once the reason was
   *   plain. A widget is redrawn a handful of times a day and the snapshot
   *   carries no duration, so NEITHER number on that row is available. The
   *   Y2K card had its own decorative bar taken to zero on 12.08 for the
   *   same reason: "a bar sitting 42% along beside them says two different
   *   things at once."
   *
   *   THE VOLUME: the + and − keys and the WELL come across; the green
   *   LEVEL inside it does not. We do not know the volume, and a bar drawn
   *   at a guessed height is an invented readout — exactly the rule she had
   *   just applied to the progress bar. An empty trough is furniture.
   *
   *   SHUFFLE, REPEAT AND THE HEART: drawn as plain unlit keys. The app
   *   does track shuffle and repeat, and since this tile is about the song
   *   LAST played, a past-tense readout would be honest if the snapshot
   *   carried them — it does not today, and her own card draws them unlit
   *   too. The heart stays unlit for good: nothing in this app has ever
   *   stored a liked song.
   *
   *   LAST PLAYED · <time>: the one fact this tile genuinely has, and the
   *   thing it is named after. `LastPlayed.at` is already stored by the app;
   *   the WORDING is decided in JS and sent as a string, the way `modeName`
   *   and the schedule's own labels are, so the extension never owns a
   *   second copy of a formatting rule.
   *
   * COUNTED RATHER THAN EYEBALLED. At k = 1, i.e. on the 338x354 tile these
   * numbers were chosen for and signed off on 25.09:
   *
   *   title bar        36    (title 19pt, was 15)
   *   body top pad      8
   *   top row         124    (cover 124 square | cluster 180 wide)
   *   air              10
   *   four fields     138    (4 x 30, 3 x 6 between; caption 14, value 16)
   *   LAST PLAYED      20
   *   body bottom pad  10
   *   ─────────────────────
   *                   346, and the tile is 354, so 8 points are spare.
   *
   * EVERY ONE OF THOSE IS NOW `x k`, AND THE SPARE POINTS ARE SHARED RATHER
   * THAN DUMPED. They used to sit in one Spacer above the foot row, which is
   * fine at 8 and is a visible dead band at 36 — see `cdTallScale` for why
   * the number differs by phone. The leftover is split three ways: under the
   * title bar, under the picture, and above LAST PLAYED. The third share is
   * the Spacer, which is deliberately NOT given an explicit height — it takes
   * whatever the other two leave, so a rounding error lands there instead of
   * overflowing the window, which would clip in silence.
   *
   * AND THE TOP ROW IS SPREAD RATHER THAN GAPPED. The cover and the cluster
   * used to sit 10pt apart; on a tile wider than 338 that left a dead column
   * beside the keys while the fields below ran the window's full width. A
   * Spacer between them puts the cluster's right edge on the fields' right
   * edge at any width — AND REPRODUCES THE SHIPPED GAP EXACTLY where it was
   * drawn: 338 - 24 of padding is 314, less cover 124 and cluster 180 is 10.
   *
   * The cluster's own three rows each come to 180: CD 40 + deck 80 + volume
   * 46 with 7 between; pause 88 | shuffle 41 | repeat 41 with 5; five 32pt
   * keys with 5.
   */
  private func cdBodyTall(_ s: WidgetStation, k: CGFloat, tileH: CGFloat) -> some View {
    let cover = 124 * k
    let fieldH = 30 * k, fieldGap = 6 * k
    let topPad = 8 * k, gap1 = 10 * k, botPad = 10 * k
    let used = 36 * k + topPad + cover + gap1
             + (4 * fieldH + 3 * fieldGap) + 20 * k + botPad
    // A third each to the three seams. `max(0,...)` because on the smallest
    // phone there is nothing to share, and a negative here would pull the
    // stack up rather than leaving the Spacer to absorb it.
    let air = max(0, (tileH - used) / 3)

    return VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top, spacing: 0) {
        ZStack {
          Color.white
          bevel(raised: false, width: 2)
          if let art = Art.songCover(station: s.image) {
            art.resizable().aspectRatio(contentMode: .fill).padding(3 * k)
          } else {
            // Neither a cover nor a photograph: a custom station with no
            // picture. Its own colour, not a grey slab.
            s.gradient.padding(3 * k)
          }
        }
        .frame(width: cover, height: cover)
        .clipped()

        Spacer(minLength: 0)
        cdCluster(k: k)
      }

      VStack(spacing: fieldGap) {
        field("Artist:", entry.lastPlayed?.artist ?? "—", arrow: true,
              h: fieldH, cap: 14 * k, val: 16 * k, capW: 64 * k, k: k)
        field("Track:", entry.lastPlayed?.title ?? "—", arrow: true,
              h: fieldH, cap: 14 * k, val: 16 * k, capW: 64 * k, k: k)
        field("Station:", "\(s.name) · \(s.dial)", arrow: true,
              h: fieldH, cap: 14 * k, val: 16 * k, capW: 64 * k, k: k)
        // The app's own label for the deck, sent in the snapshot rather than
        // mapped here — see `modeName` in Snapshot.swift for why.
        field("Mode:", s.modeName ?? "—", arrow: true,
              h: fieldH, cap: 14 * k, val: 16 * k, capW: 64 * k, k: k)
      }
      .padding(.top, gap1 + air)

      // The third share of the air. Left to take what the other two leave.
      Spacer(minLength: 0)

      HStack(spacing: 6 * k) {
        Text("LAST PLAYED").font(pixelFont(12 * k)).foregroundColor(paperInk.opacity(0.66))
        Spacer(minLength: 4 * k)
        // Absent on a phone whose app has not run since this field was added,
        // and on one that has never played anything — the caption alone is
        // still true, so there is nothing to hide.
        if let when = entry.lastPlayed?.playedAt {
          Text(when).font(pixelFont(15 * k)).foregroundColor(paperInk)
        }
      }
      .frame(height: 20 * k)
    }
    .padding(.horizontal, 12 * k)
    .padding(.top, topPad + air)
    .padding(.bottom, botPad)
  }

  /**
   * THE SHARE CARD'S RIGHT-HAND BLOCK, 180 x 124 — owner, 25.09: "I want to
   * have these contents on the right hand side."
   *
   * IT TAKES NOTHING FROM THE SNAPSHOT ON PURPOSE. Every part of it is
   * either window furniture (the keys, the trough) or decoration (the CD,
   * the tape deck), so there is nothing here that can be stale, and nothing
   * that reads as a control that is broken — which is the settled rule for
   * this target (03.09, the Pocket Player's deliberately unlabelled wheel).
   * The three keys this replaces left most of a 180 x 124 block empty, which
   * is the "too much empty space" she named.
   */
  private func cdCluster(k: CGFloat) -> some View {
    VStack(spacing: 9 * k) {
      HStack(spacing: 7 * k) {
        discGlyph(size: 40 * k)
        deckGlyph(width: 80 * k, height: 40 * k, k: k)
        volumeBlock(width: 46 * k, height: 40 * k, k: k)
      }
      .frame(height: 44 * k)

      HStack(spacing: 5 * k) {
        winKey(.pause, width: 88 * k, height: 30 * k, k: k)
        winKey(.shuffle, width: 41 * k, height: 30 * k, k: k)
        winKey(.repeatAll, width: 41 * k, height: 30 * k, k: k)
      }

      HStack(spacing: 5 * k) {
        winKey(.prev, width: 32 * k, height: 32 * k, k: k)
        winKey(.rewind, width: 32 * k, height: 32 * k, k: k)
        winKey(.forward, width: 32 * k, height: 32 * k, k: k)
        winKey(.next, width: 32 * k, height: 32 * k, k: k)
        winKey(.heart, width: 32 * k, height: 32 * k, k: k)
      }
    }
    // THE CLUSTER IS NEVER STRETCHED TO MATCH A TALLER PICTURE, and that was
    // drawn before it was believed (26.09 sheet): pulled taller, its three
    // key rows spread and read as scattered. It keeps the height three rows
    // of keys need, which is why the picture can only grow by scaling.
    .frame(width: 180 * k, height: 124 * k)
  }

  /// The little rack tape deck off the share card, seen slightly from above.
  /// PURE DECORATION, AND HONEST AS DECORATION — unlike a level bar it
  /// asserts no value, so it cannot go stale.
  private func deckGlyph(width: CGFloat, height: CGFloat, k: CGFloat = 1) -> some View {
    // HAIRLINES ARE NOT SCALED, which is the 20.09 rule: a 1pt stroke is a
    // 1pt stroke at every size, and every bevel here stays as it is.
    ZStack {
      face
      bevel(raised: true, width: 2)
      VStack(spacing: 0) {
        HStack(spacing: 4 * k) {
          // the power lamp
          Rectangle().fill(Color(hex: "#e5433c"))
            .frame(width: 5 * k, height: 4 * k)
            .overlay(Rectangle().stroke(Color(hex: "#7c1f1c"), lineWidth: 1))
          // the cassette window, sunken and dark, with both hubs showing
          ZStack {
            Color(hex: "#3b4046")
            bevel(raised: false, width: 1.5)
            HStack(spacing: 0) {
              Spacer(minLength: 0)
              Circle().fill(Color(hex: "#8a9097")).frame(width: 4 * k, height: 4 * k)
              Spacer(minLength: 0)
              Circle().fill(Color(hex: "#8a9097")).frame(width: 4 * k, height: 4 * k)
              Spacer(minLength: 0)
            }
          }
          .frame(height: 13 * k)
        }
        Spacer(minLength: 2 * k)
        // the row of little keys along the foot
        HStack(spacing: 1) {
          ForEach(0..<8, id: \.self) { _ in
            ZStack { face; bevel(raised: true, width: 1) }
          }
        }
        .frame(height: 7 * k)
      }
      .padding(4 * k)
    }
    .frame(width: width, height: height)
  }

  /// + and − over an EMPTY well. The well is the point: it is the shape the
  /// share card draws, with nothing in it, because the volume is not
  /// something this extension can know. See the note on `cdBodyTall`.
  private func volumeBlock(width: CGFloat, height: CGFloat, k: CGFloat = 1) -> some View {
    let keyW = width - 16 * k, keyH = (height - 4 * k) / 2
    return HStack(spacing: 4 * k) {
      VStack(spacing: 4 * k) {
        winKey(.plus, width: keyW, height: keyH, k: k)
        winKey(.minus, width: keyW, height: keyH, k: k)
      }
      ZStack {
        Color(hex: "#a9adb3")
        bevel(raised: false, width: 2)
      }
      .frame(width: 12 * k)
    }
    .frame(width: width, height: height)
  }

  private enum WinKey {
    case play, pause, prev, next, rewind, forward
    case shuffle, repeatAll, heart, plus, minus
  }

  /// One key. ORNAMENT, and drawn quiet on purpose — a period key is a
  /// raised face with a dark glyph on it, and nothing here claims to be a
  /// control. Every glyph is a SHAPE rather than a character: this extension
  /// cannot be compiled or rendered here, so a codepoint the system font
  /// happens not to cover would ship as a hollow box with nothing logged
  /// anywhere. It is also what the medium window's own play key already does.
  private func winKey(_ kind: WinKey, width: CGFloat, height: CGFloat,
                      k: CGFloat = 1) -> some View {
    // `g` scales for free, because the frame it is taken from is already
    // scaled — which is why shuffle, repeat and the heart need nothing here.
    let g = min(width, height)
    return ZStack {
      face
      bevel(raised: true, width: 2)
      switch kind {
      case .play:
        Triangle().fill(paperInk).frame(width: 10 * k, height: 12 * k).offset(x: 1 * k)
      case .pause:
        HStack(spacing: 3 * k) {
          Rectangle().fill(paperInk).frame(width: 3 * k, height: 11 * k)
          Rectangle().fill(paperInk).frame(width: 3 * k, height: 11 * k)
        }
      case .prev, .next:
        HStack(spacing: 1.5 * k) {
          if kind == .prev { Rectangle().fill(paperInk).frame(width: 2 * k, height: 10 * k) }
          Triangle().fill(paperInk).frame(width: 7 * k, height: 9 * k)
            .rotationEffect(.degrees(kind == .prev ? 180 : 0))
          if kind == .next { Rectangle().fill(paperInk).frame(width: 2 * k, height: 10 * k) }
        }
      case .rewind, .forward:
        HStack(spacing: 1 * k) {
          Triangle().fill(paperInk).frame(width: 7 * k, height: 9 * k)
          Triangle().fill(paperInk).frame(width: 7 * k, height: 9 * k)
        }
        // A rewind key is the forward key turned round, which is how every
        // mirrored glyph in this app is built rather than a second drawing.
        .rotationEffect(.degrees(kind == .rewind ? 180 : 0))
      case .shuffle:
        ShuffleGlyph().stroke(paperInk, style: StrokeStyle(lineWidth: g * 0.10,
                                                           lineCap: .round, lineJoin: .round))
          .frame(width: g * 0.56, height: g * 0.56)
      case .repeatAll:
        RepeatGlyph().stroke(paperInk, style: StrokeStyle(lineWidth: g * 0.10,
                                                          lineCap: .round, lineJoin: .round))
          .frame(width: g * 0.56, height: g * 0.56)
      case .heart:
        HeartGlyph().fill(paperInk).frame(width: g * 0.50, height: g * 0.50)
      case .plus, .minus:
        ZStack {
          Rectangle().fill(paperInk).frame(width: 11 * k, height: 2 * k)
          if kind == .plus { Rectangle().fill(paperInk).frame(width: 2 * k, height: 11 * k) }
        }
      }
    }
    .frame(width: width, height: height)
  }

  /**
   * THE STUB, TALL — and the tear turns with the tile.
   *
   * The medium ticket is a boarding pass: the tear runs the full HEIGHT and
   * the counterfoil is a column down the right, which is what a wide stub
   * does. Stand the same ticket up and that stops being true — a tall stub
   * tears ACROSS, and the counterfoil becomes its foot. Keeping the vertical
   * tear would have left a 58pt column running the whole 354pt of the tile,
   * which is a bookmark rather than a ticket.
   *
   * THE PICTURE IS THE HEIGHT THE MEDIUM TILE NEVER HAD. There is no room
   * for one at 158pt tall, so the wide ticket is type alone; here the cover
   * sits under the banner and the song is printed beneath it, which is the
   * order a real pass puts them in.
   */
  private func stubTall(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [paper, paperDeep], startPoint: .top, endPoint: .bottom)

      VStack(spacing: 0) {
        HStack {
          Text("CRUISE FM").font(.system(size: 11, weight: .heavy)).tracking(1.6)
            .foregroundColor(.white)
          Spacer(minLength: 6)
          // The dial in the banner rather than at the foot: on a tall ticket
          // the head is where a pass prints the flight, and the station's
          // name takes the counterfoil below.
          DialText(dial: s.dial, size: 15, color: Color(hex: "#FF9A2E"))
        }
        .padding(.horizontal, 16)
        .frame(height: 38)
        .background(paperInk)

        // 168, AND THE 58 IT GAINED CAME OUT OF A GAP NOBODY MEANT TO LEAVE
        // (owner, 26.09: "is there any way to enlarge the album cover").
        // Every block in this stack is a fixed height except the Spacer below
        // the song, so ALL the tile's leftover room landed there: banner 38 +
        // air 14 + picture 110 + air 14 + song 64 + tear 13 + counterfoil 56
        // is 309 of 354, i.e. a 45pt dead band sitting between the artist line
        // and the tear. Closing it answers her other ask in the same move —
        // "drag the song title and artist name closer to the dotted line" —
        // because the two are one fault, not two.
        //
        // AND THE TITLE HAD TO DROP TO ONE LINE FOR THE PICTURE TO GROW AT
        // ALL. At lineLimit(2) a long song costs another 29pt, which caps the
        // picture at 126 before the counterfoil is pushed off the tile. The
        // MEDIUM stub already sets lineLimit(1) with minimumScaleFactor(0.6),
        // so a long title shrinks rather than wraps; taking the same rule here
        // is what buys these 58 points.
        //
        // COUNTED, NOT EYEBALLED: banner 38 + air 12 + picture 168 + air 11 +
        // song 57 + tear 13 + counterfoil 52 is 351 of 354, and the 3 left
        // over is the Spacer's, so nothing is compressed to fit.
        ZStack {
          if let art = Art.songCover(station: s.image) {
            art.cruiseBackdrop()
          } else {
            // A custom station with neither a cover nor a photograph: its
            // own colour, which is a real picture rather than a hole.
            s.gradient
          }
        }
        .frame(height: 168)
        .clipped()
        .padding(.horizontal, 12)
        .padding(.top, 12)

        VStack(alignment: .leading, spacing: 0) {
          Text("LAST PLAYED").font(.system(size: 8, design: .monospaced)).tracking(1.6)
            .foregroundColor(paperInk.opacity(0.45))
          if let lp = entry.lastPlayed {
            // ONE LINE, SHRINKING RATHER THAN WRAPPING — see the note above
            // the picture. This is the medium stub's own rule.
            Text(lp.title).font(.system(size: 22, weight: .heavy))
              .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.6)
              .padding(.top, 2)
            Text(lp.artist).font(.system(size: 14))
              .foregroundColor(paperInk.opacity(0.62)).lineLimit(1).minimumScaleFactor(0.7)
              .padding(.top, 2)
          } else {
            // The fallback is capped at two lines for the same reason: a
            // third would eat the slack the Spacer below needs.
            Text(s.tagline).font(.system(size: 14))
              .foregroundColor(paperInk.opacity(0.55)).lineLimit(2).padding(.top, 2)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 15)
        .padding(.top, 11)

        // minLength 0, NOT 8. This spacer is the one flexible thing in the
        // stack, so whatever 8 it was given became a floor under the dead
        // band — and it is also the only give a slightly taller line of type
        // has to take, so it must be allowed to close completely.
        Spacer(minLength: 0)

        tearAcross

        HStack(alignment: .bottom) {
          VStack(alignment: .leading, spacing: 2) {
            Text("STATION").font(.system(size: 8, design: .monospaced)).tracking(1.6)
              .foregroundColor(paperInk.opacity(0.45))
            Text(s.name).font(.system(size: 16, weight: .heavy))
              .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.7)
          }
          Spacer(minLength: 8)
          codeLines
        }
        .padding(.horizontal, 15)
        .padding(.top, 10)
        .padding(.bottom, 11)
      }
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /// The tear, laid on its side. Real dashes rather than a masked rule, for
  /// the reason the vertical one gives: a mask that does not size exactly to
  /// its host shifts the pattern, and there is no compiler here to catch it.
  /// The notches hang half off each edge and the tile clips them, which is
  /// what makes them read as bitten out rather than drawn on.
  private var tearAcross: some View {
    ZStack {
      HStack(spacing: 0) {
        ForEach(0..<24, id: \.self) { i in
          Rectangle().fill(paperInk.opacity(0.30)).frame(width: 6, height: 1)
          if i < 23 { Spacer(minLength: 0.5) }
        }
      }
      HStack(spacing: 0) {
        notch.offset(x: -6.5)
        Spacer(minLength: 0)
        notch.offset(x: 6.5)
      }
    }
    .frame(height: 13)
  }

  /// NOT A BARCODE — a rule of hairlines, and the distinction is the whole
  /// point of it (owner, 26.09: "shorten the barcode? The barcode lines
  /// should also compress — it must look like lines rather than a barcode").
  ///
  /// THE OLD ONE WAS LONG BECAUSE IT WAS TOLD TO FILL. Its bars sat in an
  /// HStack of FLEXIBLE spacers next to a `Spacer(minLength: 8)`, so it took
  /// whatever width the station's name left it — about 180pt — and 26 bars at
  /// two widths and two heights are a real code's own proportions, which is
  /// exactly why it read as one.
  ///
  /// AND A BARCODE CANNOT BE SHORTENED INTO SOMETHING ELSE, which is the same
  /// finding the medium ticket produced from the other end on 10.09: it took
  /// 46 bars before it read as printed at all, fewer being an ICON of a
  /// barcode. So this stops trying: 28 hairlines, one width, one height, a
  /// FIXED 1pt gap rather than a flexible one so nothing can stretch it, and
  /// 55pt wide however much room is going.
  ///
  /// It is the last thing in a `.bottom`-aligned row, so it lands in the
  /// tile's own bottom-right corner, which is where she asked for it.
  private var codeLines: some View {
    HStack(spacing: 1) {
      ForEach(0..<28, id: \.self) { _ in
        Rectangle().fill(paperInk).frame(width: 1, height: 15)
      }
    }
    .frame(height: 15)
  }
}

/// The light on a moulded panel: a catch along the top and the two sides
/// turning out of the light. Gradients only — see the note at the call site.
///
/// THERE IS NO FOOT BAND, and its absence is a decision (owner, 09.09:
/// "remove the bottom shading -- its not necessary"). It was added on 03.09
/// to give the window depth after the raised rim came off, and on a tile that
/// now fills its own edges it only darkened the row the song sits on. The top
/// catch and the two sides carry the moulding on their own.
private struct WindowShading: View {
  var body: some View {
    ZStack {
      // top: the edge nearest the light
      VStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.34), .clear], startPoint: .top, endPoint: .bottom)
          .frame(height: 10)
        Spacer(minLength: 0)
      }
      // sides: turning out of the light, the right harder than the left
      HStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.16), .clear], startPoint: .leading, endPoint: .trailing)
          .frame(width: 12)
        Spacer(minLength: 0)
        LinearGradient(colors: [.clear, .black.opacity(0.18)], startPoint: .leading, endPoint: .trailing)
          .frame(width: 14)
      }
    }
    .allowsHitTesting(false)
  }
}

/// The light on a brushed metal case. Heavier than `WindowShading` in both
/// directions, because a metal edge catches harder than a moulded plastic one
/// and the shadow under it is sharper. Still pure falloff — nothing here is a
/// stroke, so there is no boundary anywhere to read as a drawn border.
private struct MetalShading: View {
  var body: some View {
    ZStack {
      VStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
          .frame(height: 9)
        Spacer(minLength: 0)
        LinearGradient(colors: [.clear, .black.opacity(0.20)], startPoint: .top, endPoint: .bottom)
          .frame(height: 14)
      }
      HStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.30), .clear], startPoint: .leading, endPoint: .trailing)
          .frame(width: 10)
        Spacer(minLength: 0)
        LinearGradient(colors: [.clear, .black.opacity(0.16)], startPoint: .leading, endPoint: .trailing)
          .frame(width: 12)
      }
    }
    .allowsHitTesting(false)
  }
}

/// A play triangle. `Path` rather than an SF Symbol so it matches the blunt,
/// square-cornered look of the rest of the window chrome.
struct Triangle: Shape {
  func path(in r: CGRect) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: r.minX, y: r.minY))
    p.addLine(to: CGPoint(x: r.maxX, y: r.midY))
    p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
    p.closeSubpath()
    return p
  }
}

/**
 * THE THREE GLYPHS THE WINDOW'S KEYS NEED THAT A TRIANGLE CANNOT DRAW.
 *
 * ALL STRAIGHT LINES AND CURVES IN A 24-UNIT BOX, NEVER A CHARACTER. This
 * extension cannot be compiled or rendered in the environment it is written
 * in, so a codepoint the system font happens not to cover would ship as a
 * hollow box with nothing logged anywhere — which is exactly what happened
 * to the station icons in build 39, and why `field` draws its dropdown tip
 * as a turned-over Triangle rather than asking for "\u{25BC}".
 *
 * AND THE LOOP IS SQUARE-CORNERED ON PURPOSE, not merely to avoid an arc:
 * `Triangle`'s own note already establishes the house style here as "the
 * blunt, square-cornered look of the rest of the window chrome". An arc
 * would also have to be trusted sight-unseen, since SwiftUI's `clockwise`
 * is expressed in a flipped coordinate system and a wrong one draws the
 * long way round.
 */

/// Two crossing runs, each ending in a chevron — never a close-box X, which
/// is the shape sitting in the title bar three rows above it.
struct ShuffleGlyph: Shape {
  func path(in r: CGRect) -> Path {
    let s = min(r.width, r.height) / 24
    let ox = r.midX - 12 * s, oy = r.midY - 12 * s
    func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
    var path = Path()
    path.move(to: p(2, 6));  path.addLine(to: p(7, 6))
    path.addLine(to: p(17, 18)); path.addLine(to: p(21, 18))
    path.move(to: p(18, 15)); path.addLine(to: p(21, 18)); path.addLine(to: p(18, 21))
    path.move(to: p(2, 18)); path.addLine(to: p(7, 18))
    path.addLine(to: p(17, 6)); path.addLine(to: p(21, 6))
    path.move(to: p(18, 3)); path.addLine(to: p(21, 6)); path.addLine(to: p(18, 9))
    return path
  }
}

/// A loop with a gap in each side and an arrow at the end of each run, so it
/// reads as travel rather than as a rectangle.
struct RepeatGlyph: Shape {
  func path(in r: CGRect) -> Path {
    let s = min(r.width, r.height) / 24
    let ox = r.midX - 12 * s, oy = r.midY - 12 * s
    func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
    var path = Path()
    // up the left, across the top, part-way down the right
    path.move(to: p(5, 13)); path.addLine(to: p(5, 5))
    path.addLine(to: p(19, 5)); path.addLine(to: p(19, 10))
    path.move(to: p(16, 7)); path.addLine(to: p(19, 10)); path.addLine(to: p(22, 7))
    // down the right, across the foot, part-way up the left
    path.move(to: p(19, 11)); path.addLine(to: p(19, 19))
    path.addLine(to: p(5, 19)); path.addLine(to: p(5, 14))
    path.move(to: p(2, 17)); path.addLine(to: p(5, 14)); path.addLine(to: p(8, 17))
    return path
  }
}

/// PORTED FROM THE APP'S OWN SHARE CARD rather than drawn again — the same
/// two curves, its 68-unit geometry scaled to 24 — so the widget's heart and
/// the card's are one shape at two sizes.
struct HeartGlyph: Shape {
  func path(in r: CGRect) -> Path {
    let s = min(r.width, r.height) / 24
    let ox = r.midX - 12 * s, oy = r.midY - 12 * s
    func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
    var path = Path()
    path.move(to: p(12, 17.6))
    path.addCurve(to: p(12, 9.2), control1: p(2.5, 11.3), control2: p(6.4, 3.9))
    path.addCurve(to: p(12, 17.6), control1: p(17.6, 3.9), control2: p(21.5, 11.3))
    path.closeSubpath()
    return path
  }
}

// ── the two configurations ─────────────────────────────────────────────────
// Same split as the Deck: 17 and later get the look setting, older phones get
// the default look. They share a `kind` so the gallery shows one row.

@available(iOSApplicationExtension 17.0, *)
struct LastPlayedConfigurableWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "CruiseLastPlayed", intent: LastPlayedLookIntent.self,
                           provider: LastPlayedIntentProvider()) { entry in
      LastPlayedView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("Last Played")
    .description("The last song you heard. Long-press to change the look, or pin it to a station.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .cruiseFullBleed()
  }
}

struct LastPlayedWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseLastPlayed", provider: LastPlayedProvider()) { entry in
      LastPlayedView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("Last Played")
    .description("The last song you heard, in a desktop CD player.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .cruiseFullBleed()
  }
}
