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
 * THE PICTURE IS THE STATION'S OWN PHOTOGRAPH, not the song's cover — the
 * owner's call (03.09) "so people can add their photos in", since a custom
 * station carries a picture the listener chose and a cover very often does
 * not exist at all. The WORDS still name the song, which is what the widget
 * is about. See Art.cover.
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

private func lpEntry(_ style: LastPlayedStyle) -> LastPlayedEntry {
  guard let snap = SnapshotStore.load() else {
    return LastPlayedEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: style)
  }
  // Never driven? Fall back to whatever is on air, so a first-time listener
  // gets a real station rather than an empty frame.
  let station = snap.lastDrive ?? snap.onAir.first
  return LastPlayedEntry(date: Date(), station: station, lastPlayed: snap.lastPlayed,
                         ready: true, style: style)
}

private func lpTimeline(_ style: LastPlayedStyle) -> Timeline<LastPlayedEntry> {
  // One entry, refreshed in an hour. The song only changes when the app plays
  // one, and the app republishes the snapshot whenever it is backgrounded —
  // a far better signal than any schedule guessed at here.
  Timeline(entries: [lpEntry(style)], policy: .after(Date().addingTimeInterval(3600)))
}

struct LastPlayedProvider: TimelineProvider {
  func placeholder(in c: Context) -> LastPlayedEntry {
    LastPlayedEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .cdPlayer)
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
    LastPlayedEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .cdPlayer)
  }
  func snapshot(for configuration: LastPlayedLookIntent, in c: Context) async -> LastPlayedEntry {
    lpEntry(style(configuration.look))
  }
  func timeline(for configuration: LastPlayedLookIntent, in c: Context) async -> Timeline<LastPlayedEntry> {
    lpTimeline(style(configuration.look))
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
      switch entry.style {
      case .cdPlayer: cdPlayer(s)
      case .player:   player(s)
      case .stub:     stub(s)
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
      // The face is not a flat fill: a moulded plastic panel is lit from
      // above, so it is faintly brighter at the top than at the foot.
      LinearGradient(colors: [faceLit.opacity(0.55), face, face,
                              faceDim.opacity(0.30)],
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
        // title bar
        HStack(spacing: 8) {
          discGlyph(size: 18)
          Text("Cruise FM").font(pixelFont(15)).foregroundColor(.white)
          Spacer(minLength: 4)
          ForEach(["_", "[]", "X"], id: \.self) { c in
            ZStack {
              face
              bevel(raised: true, width: 2)
              Text(c).font(pixelFont(10)).foregroundColor(paperInk)
            }
            .frame(width: 20, height: 17)
          }
        }
        .padding(.horizontal, 10)
        .frame(height: 32)
        .background(
          LinearGradient(colors: [Color(hex: "#7a4a12"), s.accentColor, Color(hex: "#e0a24e")],
                         startPoint: .leading, endPoint: .trailing))

        HStack(alignment: .top, spacing: 11) {
          ZStack {
            Color.white
            bevel(raised: false, width: 2)
            if let art = Art.cover(station: s.image) {
              art.resizable().aspectRatio(contentMode: .fill).padding(3)
            } else {
              // Neither a cover nor a photograph: a custom station with no
              // picture. Its own colour, not a grey slab.
              s.gradient.padding(3)
            }
          }
          .frame(width: 106, height: 106)
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
              Text("\(s.name) · \(s.dial)").font(pixelFont(10))
                .foregroundColor(faceDim).lineLimit(1)
            }
          }
        }
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .padding(.bottom, 12)
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

  private func field(_ caption: String, _ value: String) -> some View {
    HStack(spacing: 7) {
      Text(caption).font(pixelFont(11)).foregroundColor(paperInk).frame(width: 40, alignment: .leading)
      ZStack {
        Color.white
        bevel(raised: false, width: 2)
        Text(value).font(pixelFont(12)).foregroundColor(.black)
          .lineLimit(1).padding(.horizontal, 7)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      .frame(height: 26)
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
      LinearGradient(colors: [Color(white: 0.95), Color(white: 0.85),
                              Color(white: 0.93), Color(white: 0.79)],
                     startPoint: .topLeading, endPoint: .bottomTrailing)

      HStack(spacing: 0) {
        // the screen
        ZStack {
          RoundedRectangle(cornerRadius: 5).fill(Color(hex: "#0a0c12"))
          RoundedRectangle(cornerRadius: 5).stroke(Color(white: 0.62), lineWidth: 2)

          VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 11) {
              ZStack {
                RoundedRectangle(cornerRadius: 3).fill(Color(white: 0.16))
                if let art = Art.cover(station: s.image) {
                  art.resizable().aspectRatio(contentMode: .fill)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                } else {
                  s.gradient.clipShape(RoundedRectangle(cornerRadius: 3))
                }
              }
              .frame(width: 74, height: 74)

              VStack(alignment: .leading, spacing: 4) {
                Text(entry.lastPlayed?.title ?? s.name)
                  .font(.system(size: 17, weight: .heavy))
                  .foregroundColor(.white).lineLimit(2).minimumScaleFactor(0.7)
                if let lp = entry.lastPlayed {
                  Text(lp.artist).font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.66)).lineLimit(1)
                }
              }
              Spacer(minLength: 0)
            }
            Spacer(minLength: 4)
            // NO PROGRESS BAR. A bar claims a position in a song, and the
            // only thing known here is that this played at some point.
            HStack {
              Text("LAST PLAYED").font(.system(size: 7.5, weight: .heavy)).tracking(1.3)
                .foregroundColor(.white.opacity(0.48))
              Spacer(minLength: 4)
              DialText(dial: s.dial, size: 10, color: .white.opacity(0.58))
            }
          }
          .padding(10)
        }
        .padding(.vertical, 14)
        .padding(.leading, 14)

        // the control: a plain ring, deliberately unlabelled
        ZStack {
          Circle().fill(
            LinearGradient(colors: [Color(white: 0.99), Color(white: 0.86), Color(white: 0.77)],
                           startPoint: .topLeading, endPoint: .bottomTrailing))
          Circle().stroke(Color.black.opacity(0.07), lineWidth: 1)
          Circle().fill(
            LinearGradient(colors: [Color(white: 0.95), Color(white: 0.82)],
                           startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: 40, height: 40)
          Circle().stroke(Color.black.opacity(0.06), lineWidth: 1).frame(width: 40, height: 40)
        }
        .frame(width: 112, height: 112)
        .padding(.horizontal, 17)
      }
    }
    .widgetURL(s.url(mode: s.mode))
  }

  // ── THE STUB ────────────────────────────────────────────────────────────
  // The drive as a printed ticket. Owner, 03.09: "make the text bigger
  // especially the artist and the song name" — the song is the subject of
  // this widget, and it was set smaller than the station above it.
  private func stub(_ s: WidgetStation) -> some View {
    ZStack(alignment: .topLeading) {
      LinearGradient(colors: [paper, paperDeep], startPoint: .top, endPoint: .bottom)

      VStack(spacing: 0) {
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
          HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 1) {
              Text("STATION").font(.system(size: 8, design: .monospaced)).tracking(1.6)
                .foregroundColor(paperInk.opacity(0.45))
              Text(s.name).font(.system(size: 19, weight: .heavy))
                .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 6)
            DialText(dial: s.dial, size: 19, color: paperInk)
          }
          .padding(.horizontal, 15)
          .padding(.top, 9)

          Spacer(minLength: 4)
          // The tear: a dashed rule with a notch bitten out of each edge.
          ZStack {
            Rectangle().fill(paperInk.opacity(0.22)).frame(height: 1)
              .mask(HStack(spacing: 4) {
                ForEach(0..<40, id: \.self) { _ in Rectangle().frame(width: 5) }
              })
            HStack {
              Circle().fill(Color.black.opacity(0.30)).frame(width: 13, height: 13).offset(x: -6.5)
              Spacer()
              Circle().fill(Color.black.opacity(0.30)).frame(width: 13, height: 13).offset(x: 6.5)
            }
          }
          Spacer(minLength: 4)

          HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 1) {
              Text("LAST PLAYED").font(.system(size: 8, design: .monospaced)).tracking(1.6)
                .foregroundColor(paperInk.opacity(0.45))
              if let lp = entry.lastPlayed {
                Text(lp.title).font(.system(size: 21, weight: .heavy))
                  .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.6)
                Text(lp.artist).font(.system(size: 15))
                  .foregroundColor(paperInk.opacity(0.62)).lineLimit(1).minimumScaleFactor(0.7)
              } else {
                Text(s.tagline).font(.system(size: 14))
                  .foregroundColor(paperInk.opacity(0.55)).lineLimit(2)
              }
            }
            Spacer(minLength: 8)
            barcode
          }
          .padding(.horizontal, 15)
          .padding(.bottom, 12)
        }
      }
    }
    .widgetURL(s.url(mode: s.mode))
  }

  private var barcode: some View {
    HStack(alignment: .bottom, spacing: 1.5) {
      ForEach(0..<18, id: \.self) { i in
        Rectangle().fill(paperInk)
          .frame(width: i % 3 == 0 ? 2.5 : 1.5, height: i % 4 == 0 ? 20 : 27)
      }
    }
  }
}

/// The light on a moulded panel: a catch along the top, the surface falling
/// away at the foot, and the two sides turning out of the light. Gradients
/// only — see the note at the call site.
private struct WindowShading: View {
  var body: some View {
    ZStack {
      // top: the edge nearest the light
      VStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.34), .clear], startPoint: .top, endPoint: .bottom)
          .frame(height: 10)
        Spacer(minLength: 0)
      }
      // foot: the surface curving away
      VStack(spacing: 0) {
        Spacer(minLength: 0)
        LinearGradient(colors: [.clear, .black.opacity(0.22)], startPoint: .top, endPoint: .bottom)
          .frame(height: 18)
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
    .description("The last song you heard. Long-press to change the look — CD player, pocket player or ticket stub.")
    .supportedFamilies([.systemMedium])
  }
}

struct LastPlayedWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseLastPlayed", provider: LastPlayedProvider()) { entry in
      LastPlayedView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("Last Played")
    .description("The last song you heard, in a desktop CD player.")
    .supportedFamilies([.systemMedium])
  }
}
