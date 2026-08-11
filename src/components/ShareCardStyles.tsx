import {
  Circle, ClipPath, Defs, G, Image as SvgImage,
  LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText,
} from 'react-native-svg';

import { DotMatrixGroup } from '@/components/DotMatrix';
import { useDsegFonts } from '@/components/StationIdentity';
import {
  CARD_W, CX, ModeHero, STAGE_H, STAGE_TOP, glowCol, mixHex, type Eq,
} from '@/components/ShareModeArt';
import type { Station } from '@/constants/stations';
import { stationDial, stationFrequency } from '@/constants/stations';
import type { NowPlaying } from '@/utils/useMusicPlayback';

/**
 * THE SHARE CARD'S DESIGN STYLES.
 *
 * Three, chosen by the owner out of eight prototypes (01.08): TICKET and
 * SLEEVE — things you could hold — and RECEIVER, the app's own hardware
 * language. Every style draws the SAME mode hero (ShareModeArt) and differs
 * only in how the card is FRAMED around it: the mode is the part nobody else
 * has, so it is never the variable.
 *
 * Rules, inherited from ShareCard and non-negotiable:
 *   • SVG primitives ONLY. The card is rasterised with <Svg>.toDataURL(), so
 *     no Views, no expo-linear-gradient, no fonts that aren't already loaded.
 *     That is what keeps the whole feature shippable over the air — capturing
 *     a normal View needs react-native-view-shot, a native module.
 *   • Gradient ids are namespaced with `uid`. Two <Svg> roots carrying the
 *     same id at once is a known way to get one of them rendering blank, and
 *     the sheet always has two on screen (preview + full-size capture copy).
 *   • Nothing animates. These are stills.
 *   • Every y position is derived from `cardH`, never hardcoded to 1350 —
 *     the same style has to lay out in both the 4:5 card and the 2:3 pin.
 */

// One width, two heights. 4:5 is what iMessage and WhatsApp show without
// cropping; 2:3 is Pinterest's shape, and a pin that isn't 2:3 gets squeezed
// in the feed.
export const CARD_H_CARD = 1350;
export const CARD_H_PIN = 1620;

export type ShareFormat = 'card' | 'pin';
export const FORMAT_H: Record<ShareFormat, number> = { card: CARD_H_CARD, pin: CARD_H_PIN };

export const SHARE_STYLES = [
  // Snapshot leads: a REAL capture of the running mode (owner, 27.07: "since
  // this is a more visual app… share this like a screenshot but in a card
  // form"). The chip only appears when a capture exists; Ticket is the
  // standing fallback — and with a capture, its window shows the real mode
  // too. Sleeve and Receiver were CUT on the owner's call (04.08, after
  // seeing snapshots on device): "I would actually remove the receiver and
  // sleeve mode and keep the snapshot and the ticket mode."
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'y2k', label: 'Y2K' },
] as const;

export type ShareStyleId = (typeof SHARE_STYLES)[number]['id'];
export const DEFAULT_SHARE_STYLE: ShareStyleId = 'ticket';

/** The address printed on every card. cruisefm.app was never registered
 *  (owner, 11.08) — a card that names a dead domain is worse than one that
 *  names none, since it is the only route a recipient has. Keep it in step
 *  with INSTALL_URL in ShareCard.tsx. */
const INSTALL_HOST = 'cruisefm.netlify.app';

/** A real screenshot of the running mode plus the trim lines computed at
 *  capture time from the live layout (see ModeActionRow.grabModeSnapshot).
 *  Structurally identical to ModeActionRow's ModeSnapshot — defined here too
 *  so ShareCard doesn't have to import from the file that imports it. */
export type SnapshotInfo = {
  uri: string; w: number; h: number;
  cropTopPt?: number; cropBotPt?: number;
  identBotPt?: number; songTopPt?: number;
};

// ── Snapshot-derived card geometry ───────────────────────────────────────────
// With a portrait capture, neither style uses the fixed 4:5/2:3 heights any
// more: the SNAPSHOT card hugs the picture (owner, 05.08: "only share the part
// that is snapshotted", with room at the bottom for cruisefm.app), and the
// TICKET derives its height from its picture band so the mode is never
// compressed ("get the ticket template as the same dimensions as the snapshot
// mode"). Everything here must agree between cardHeightFor() and the styles'
// own layout code — the height is computed once in the sheet and again when
// drawing, and the two must land on the same number.

/** Fraction fallbacks for captures that arrived without point crops. */
const CROP_TOP_FRAC = 0.120;
const CROP_BOT_FRAC = 0.118;

// Snapshot card: slim strips only. TOP is the air the eyebrow needed; BOT
// carries cruisefm.app; SIDE keeps the rounded frame reading as a frame.
const SNAP_SIDE = 20;
const SNAP_TOP = 40;
const SNAP_BOT = 108;

// Ticket card: header zone below the panel's own 44 margin, tear gap under
// the picture, and the counterfoil's fixed foot. The foot must hold the
// barcode (ends at tear+98) clear of the NOW PLAYING baseline (foot−208+…):
// at 330 the two nearly touched on the render. The header must hold the
// dial's dot-matrix (ends ~256) clear of the picture: at 214 the picture
// sat "just touching the bottom of the text" (owner, 05.08).
const TK_HEAD = 246;
const TK_TEAR = 34;
const TK_FOOT = 352;

/** The capture band the SNAPSHOT shows: everything between the status strip
 *  and the pill row — transport included, that is the point of the style. */
function snapBand(snap: SnapshotInfo) {
  const portrait = snap.h >= snap.w;
  const cropTop = portrait ? (snap.cropTopPt ?? snap.h * CROP_TOP_FRAC) / snap.h : 0;
  const cropBot = portrait ? (snap.cropBotPt ?? snap.h * CROP_BOT_FRAC) / snap.h : 0;
  return { cropTop, cropBot, visW: snap.w, visH: snap.h * (1 - cropTop - cropBot) };
}

/** The capture band the TICKET shows: the mode's OBJECT only — below the
 *  station identity (the header prints the station) and above the song block
 *  (the counterfoil prints the song; the scrub stays out, owner 05.08). */
function ticketBand(snap: SnapshotInfo) {
  const identBot = snap.identBotPt ?? snap.h * 0.148;
  const songTop = snap.songTopPt ?? snap.h * 0.36;
  return { identBot, bandH: Math.max(140, snap.h - identBot - songTop) };
}

/** The card's height for a given style/format/capture. The sheet sizes the
 *  preview and the export copy with this; the styles lay out against it. */
export function cardHeightFor(styleId: ShareStyleId, format: ShareFormat, snap?: SnapshotInfo | null): number {
  // Y2K draws no capture, so its shape is always the chosen format.
  if (styleId === 'y2k') return FORMAT_H[format];
  if (snap && snap.h >= snap.w) {
    if (styleId === 'snapshot') {
      const band = snapBand(snap);
      return Math.round(SNAP_TOP + ((CARD_W - SNAP_SIDE * 2) * band.visH) / band.visW + SNAP_BOT);
    }
    const { bandH } = ticketBand(snap);
    const PW = CARD_W - 88;
    return Math.round(44 + TK_HEAD + (PW * bandH) / snap.w + TK_TEAR + TK_FOOT + 44);
  }
  return FORMAT_H[format];
}

/** SVG <Text> does not wrap, so lines are worked out here. `perChar` is the
 *  average glyph width as a fraction of font size — 0.52 is about right for a
 *  bold sans face and errs on the safe side, since overflowing the card looks
 *  far worse than breaking a line early. */
export function wrapLines(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const perChar = fontSize * 0.52;
  const maxChars = Math.max(6, Math.floor(maxWidth / perChar));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (!lines.length) return [text.slice(0, maxChars)];
  // Anything that didn't fit gets an ellipsis on the last line.
  const used = lines.join(' ');
  if (used.length < text.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  }
  return lines;
}

/** A size that keeps a single line inside `maxWidth`, so a long station name
 *  never wraps a display line onto two. */
function fitSize(text: string, ideal: number, maxWidth: number, floor = 30): number {
  if (!text.length) return ideal;
  return Math.max(floor, Math.min(ideal, maxWidth / (text.length * 0.53)));
}

function clip(text: string, chars: number): string {
  return text.length > chars ? `${text.slice(0, chars - 1).trimEnd()}…` : text;
}

/** Deterministic 0..1. Never Math.random(): the preview and the exported PNG
 *  are two separate renders and must come out identical. */
function h01(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Place the hero stage in an arbitrary box. `cover` fills the box and trims
 *  whatever overflows; `contain` fits the whole stage and letterboxes. Default
 *  is cover, because a window with bars down the sides doesn't read as a
 *  picture of anything. Vertical trim is safe — every mode leaves margin above
 *  and below its object — so keep boxes WIDER than 1080:740, never narrower. */
function heroBox(x: number, y: number, w: number, h: number, mode: 'cover' | 'contain' = 'cover'): string {
  const s = mode === 'cover'
    ? Math.max(w / CARD_W, h / STAGE_H)
    : Math.min(w / CARD_W, h / STAGE_H);
  const tx = x + (w - CARD_W * s) / 2;
  const ty = y + (h - STAGE_H * s) / 2 - STAGE_TOP * s;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`;
}

/**
 * The station photograph filling a whole box, with a light scrim over it.
 *
 * This is the background for the card ITSELF, not a window inside it (owner,
 * 02.08: "I would make the image cover the entire background"). It always
 * COVERS — a photograph may be trimmed, that is what photographs are for. The
 * mode's object is laid over it separately and is never cropped.
 */
function PhotoFill({ d, uid, x, y, w, h }: {
  d: Derived; uid: string; x: number; y: number; w: number; h: number;
}) {
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} fill={d.deep} />
      {!!d.backdrop && (
        <SvgImage x={x} y={y} width={w} height={h} href={d.backdrop as string}
          preserveAspectRatio="xMidYMid slice" />
      )}
      <Rect x={x} y={y} width={w} height={h} fill="#03040e" fillOpacity={0.34} />
      <Rect x={x} y={y} width={w} height={h} fill={d.wash} fillOpacity={0.10} />
    </>
  );
}

/**
 * The dark band that lets type sit on a photograph. Fades to nothing so it
 * never draws an edge of its own — a scrim with a visible boundary is just a
 * rectangle, and this card already learned that lesson on the mirror ball.
 */
function FadeBand({ uid, x, y, w, h, from, tint, dir }: {
  uid: string; x: number; y: number; w: number; h: number;
  from: number; tint?: string; dir: 'down' | 'up';
}) {
  const id = `fb${uid}`;
  const a = dir === 'down' ? '0' : '1';
  const b = dir === 'down' ? '1' : '0';
  return (
    <>
      <Defs>
        <SvgLinearGradient id={id} x1="0" y1={a} x2="0" y2={b}>
          <Stop offset="0" stopColor="#03040c" stopOpacity={String(from)} />
          <Stop offset="0.55" stopColor="#03040c" stopOpacity={String(from * 0.34)} />
          <Stop offset="1" stopColor="#03040c" stopOpacity="0" />
        </SvgLinearGradient>
        {!!tint && (
          <SvgLinearGradient id={`${id}t`} x1="0" y1={a} x2="0" y2={b}>
            <Stop offset="0" stopColor={tint} stopOpacity="0.30" />
            <Stop offset="1" stopColor={tint} stopOpacity="0" />
          </SvgLinearGradient>
        )}
      </Defs>
      <Rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
      {!!tint && <Rect x={x} y={y} width={w} height={h} fill={`url(#${id}t)`} />}
    </>
  );
}

/** The album cover, on its own. It lives beside the song title now rather than
 *  inside the artwork: only Vinyl and CD show a cover on screen, so pasting one
 *  into the other six was what made every mode look wrong. */
function CoverTile({ art, x, y, size, uid, tint }: {
  art: string | null; x: number; y: number; size: number; uid: string; tint: string;
}) {
  const id = `ct${uid}`;
  return (
    <>
      <Defs>
        <ClipPath id={id}><Rect x={x} y={y} width={size} height={size} rx={12} ry={12} /></ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Rect x={x} y={y} width={size} height={size} fill={tint} />
        {!!art && <SvgImage x={x} y={y} width={size} height={size} href={{ uri: art }} preserveAspectRatio="xMidYMid slice" />}
      </G>
      <Rect x={x} y={y} width={size} height={size} rx={12} fill="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={2} />
    </>
  );
}

// ── Shared data ───────────────────────────────────────────────────────────────

type StyleProps = {
  station: Station;
  track: NowPlaying | null;
  modeLabel: string;
  modeId: string;
  userName: string | null;
  uid: string;
  cardH: number;
  /** A real screenshot of the running mode (react-native-view-shot); null
   *  when capture wasn't possible — older builds, web, or a native failure. */
  snapshot?: SnapshotInfo | null;
};

type Derived = {
  eq: Eq;
  wash: string; deep: string; mid: string;
  title: string; artist: string;
  art: string | null; backdrop: unknown;
  dialLabel: string; band: string; dialValue: number; freq: number;
  serial: string;
  hero: React.ReactElement;
};

function derive(p: StyleProps): Derived {
  const { station, track, modeId, uid } = p;
  const eq = (station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as Eq;
  // Mixed well down toward black. A pale station (Mountain Pass's eqColors
  // are literally three whites) otherwise produces a light grey card that
  // white text can't sit on — so the wash is the station's colour, deepened.
  const wash = glowCol(eq);
  const title = track?.title ?? station.tagline;
  const artist = track?.artist ?? '';
  const freq = stationFrequency(station.id);
  const dial = stationDial(station.id, !!station.premium);
  // A ticket needs a serial. Derived from the station and the mode so the same
  // drive always prints the same number — a number that changed every render
  // would be the one detail that gave the whole thing away as fake.
  const seed = Math.floor(h01(station.id.length * 7.3 + modeId.length * 13.1 + dial.value) * 900000) + 100000;
  return {
    eq,
    wash,
    deep: mixHex(eq[2], '#07070f', 0.84),
    mid: mixHex(wash, '#0b0c16', 0.70),
    title,
    artist,
    art: track?.albumArt ?? null,
    backdrop: station.imageBlur ?? station.image ?? null,
    dialLabel: dial.label,
    band: dial.band,
    dialValue: dial.value,
    freq,
    serial: String(seed),
    hero: (
      <ModeHero modeId={modeId} eq={eq} art={track?.albumArt ?? null} uid={uid}
        title={title} artist={artist} freq={freq} />
    ),
  };
}

/** The station photograph under a scrim — the backdrop every mode actually
 *  has on screen. */
function Backdrop({ d, uid, cardH, stops }: {
  d: Derived; uid: string; cardH: number; stops: [number, number, number, number];
}) {
  const g = `bd${uid}`;
  return (
    <>
      <Defs>
        <SvgLinearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#03040e" stopOpacity={String(stops[0])} />
          <Stop offset="0.34" stopColor="#03040e" stopOpacity={String(stops[1])} />
          <Stop offset="0.62" stopColor="#03040e" stopOpacity={String(stops[2])} />
          <Stop offset="1" stopColor="#03040e" stopOpacity={String(stops[3])} />
        </SvgLinearGradient>
      </Defs>
      {!!d.backdrop && (
        <SvgImage x={0} y={0} width={CARD_W} height={cardH} href={d.backdrop as string}
          preserveAspectRatio="xMidYMid slice" />
      )}
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={`url(#${g})`} />
    </>
  );
}

/** The base wash every style sits on, so a station with no photograph (custom
 *  stations have none) still gets its own colour rather than flat black. */
function BaseWash({ d, uid, cardH, glow = 0.34 }: { d: Derived; uid: string; cardH: number; glow?: number }) {
  return (
    <>
      <Defs>
        <SvgLinearGradient id={`bw${uid}`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={d.mid} />
          <Stop offset="0.55" stopColor={d.deep} />
          <Stop offset="1" stopColor="#06060d" />
        </SvgLinearGradient>
        <RadialGradient id={`bg${uid}`} cx="50%" cy="32%" r="64%">
          <Stop offset="0" stopColor={d.wash} stopOpacity={String(glow)} />
          <Stop offset="1" stopColor={d.wash} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={`url(#bw${uid})`} />
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={`url(#bg${uid})`} />
    </>
  );
}

// ── 1. Ticket ─────────────────────────────────────────────────────────────────
// The drive as a stub: a coloured header in the station's own light, the mode
// in a window, a punched perforation, and the song printed on the counterfoil.
// Detail is the whole job here — a plain rounded panel with a dashed line
// across it reads as a wireframe, not a ticket. What makes paper look like
// paper is security print, a serial, and edges that were made by a machine.

function TicketStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  const PX = 44, PY = 44;
  const PW = CARD_W - PX * 2;
  const panelBottom = cardH - PY;
  const STUB_X = PX + 46, STUB_W = PW - 92;
  const extra = cardH - CARD_H_CARD;

  // A PORTRAIT capture gets the STRUCTURED ticket (owner, 05.08: "get the
  // ticket template as the same dimensions as the snapshot mode — the ticket
  // mode is a bit compressed for the different mode sizes"): header zone,
  // then the mode's object band at the SAME proportions the Snapshot shows
  // it — contain at the panel's full width, so no mode is ever squeezed or
  // cropped — then tear and counterfoil. The band starts below the capture's
  // own station identity and ends above its own song block, so the ticket's
  // printed station and printed song are the ONLY ones on the card: this is
  // also what ended the header ghosting ("Daylight AM" printing over the
  // capture's own "1240 Daylight AM"). The card's height is derived in
  // cardHeightFor so the band always fits exactly.
  const snap = p.snapshot && p.snapshot.h >= p.snapshot.w ? p.snapshot : null;
  const band = snap ? ticketBand(snap) : null;
  const picY = PY + TK_HEAD;
  const sk = snap ? PW / snap.w : 1;
  const picH = snap && band ? band.bandH * sk : 0;

  // Captureless (custom stations, web, old builds — and landscape captures,
  // which the Snapshot style handles better): the drawn hero, exactly as
  // before. A shade under the panel's full width: at 100% the counterfoil
  // lost the room its artist line needs and ran into the barcode.
  const HERO_W = Math.round(PW * 0.95);
  const HERO_H = Math.round((HERO_W * STAGE_H) / CARD_W);
  const HERO_X = CX - HERO_W / 2;
  const HERO_Y = PY + 190 + extra * 0.36;
  const perfY = snap ? picY + picH + TK_TEAR : HERO_Y + HERO_H + 32;
  const barcodeY = panelBottom - 120;

  const COVER = 156;
  const coverX = PX + PW - 46 - COVER;
  const titleLines = wrapLines(d.title, 40, STUB_W - (d.art ? 200 : 40), 2);
  const stubContentH = 56 + titleLines.length * 50 + (d.artist ? 34 : 0);
  const stubY = perfY + Math.max(56, ((barcodeY - perfY) - stubContentH) / 2);
  const nameSize = fitSize(station.name, 58, PW - 92, 28);
  // With a capture, the barcode and cover tuck up under the tear and the
  // song block anchors to the ticket's foot.
  const barY = snap ? perfY + 42 : barcodeY;

  // Guilloche. Real tickets carry a fine engraved pattern that a photocopier
  // can't hold, and it is what stops the panel reading as a flat rectangle.
  const weave: React.ReactElement[] = [];
  for (let i = 0; i < 48; i++) {
    const x = PX - (panelBottom - PY) + i * 44;
    weave.push(<Path key={`gw${i}`} d={`M ${x} ${panelBottom} L ${x + (panelBottom - PY)} ${PY}`}
      stroke="#ffffff" strokeOpacity={0.045} strokeWidth={1.3} />);
  }

  // Perforation, punched rather than drawn. A dashed stroke reads as a border
  // style; a row of holes in the card's own dark reads as a tear line — so
  // the holes must match whatever the card around the panel actually is:
  // plain black with a capture, the old near-black otherwise.
  const holeFill = snap ? '#000000' : '#07080f';
  const holes: React.ReactElement[] = [];
  const hn = Math.floor((PW - 88) / 26);
  for (let i = 0; i <= hn; i++) {
    holes.push(<Circle key={`ph${i}`} cx={PX + 44 + (i * (PW - 88)) / hn} cy={perfY} r={5} fill={holeFill} />);
  }

  const bars: React.ReactElement[] = [];
  let bx = STUB_X;
  for (let i = 0; bx < STUB_X + 330; i++) {
    const w = 3 + Math.round(h01(i * 3.7) * 3) * 2;
    bars.push(<Rect key={`bc${i}`} x={bx} y={barY} width={w} height={56} fill="#ffffff" fillOpacity={0.5} />);
    bx += w + 6;
  }

  return (
    <>
      {snap ? (
        // The card around the ticket is PLAIN BLACK (owner, 05.08: "make
        // the border just black so the snapshot and ticket stand out").
        <Rect x={0} y={0} width={CARD_W} height={cardH} fill="#000000" />
      ) : (
        <>
          <BaseWash d={d} uid={uid} cardH={cardH} glow={0.30} />
          <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.86, 0.84, 0.86, 0.92]} />
        </>
      )}

      <Defs>
        <ClipPath id={`tkP${uid}`}>
          <Rect x={PX} y={PY} width={PW} height={panelBottom - PY} rx={40} ry={40} />
        </ClipPath>
        {!!snap && (
          <ClipPath id={`tkB${uid}`}>
            <Rect x={PX} y={picY} width={PW} height={picH} />
          </ClipPath>
        )}
      </Defs>

      <G clipPath={`url(#tkP${uid})`}>
        {snap && band ? (
          // The picture band: the same slice of the phone the Snapshot
          // frames, minus the capture's own station identity and song block
          // (the ticket prints both itself), at the panel's full width —
          // contain, never cover, so no mode is squeezed or trimmed. And NO
          // fades over it: the header and counterfoil sit on the ticket's
          // own paper now, so the picture carries no shading at all (owner,
          // 05.08: "a lot of vignette around the ticket's edges — remove
          // that").
          <>
            {/* Ticket paper: the station's own colour under the etched
                weave. The counterfoil used to sit on near-black, which
                would vanish against the new black card (owner, 05.08:
                "etch the bottom area like the top of the ticket and change
                the background to the theme colour"). ONE gradient serves
                header and foot so the ticket's two ends match; the picture
                covers the middle of it. */}
            <Defs>
              <SvgLinearGradient id={`tkpp${uid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={mixHex(d.wash, '#12131f', 0.30)} />
                <Stop offset="0.5" stopColor={mixHex(d.wash, '#0c0d17', 0.52)} />
                <Stop offset="1" stopColor={mixHex(d.wash, '#12131f', 0.26)} />
              </SvgLinearGradient>
            </Defs>
            <Rect x={PX} y={PY} width={PW} height={panelBottom - PY} fill={`url(#tkpp${uid})`} />
            {weave}
            <G clipPath={`url(#tkB${uid})`}>
              <SvgImage x={PX} y={picY - band.identBot * sk}
                width={PW} height={snap.h * sk}
                href={{ uri: snap.uri }} preserveAspectRatio="xMidYMid meet" />
            </G>
          </>
        ) : (
          <>
            <PhotoFill d={d} uid={uid} x={PX} y={PY} w={PW} h={panelBottom - PY} />
            <G transform={heroBox(HERO_X, HERO_Y, HERO_W, HERO_H, 'contain')}>{d.hero}</G>
            {weave}
            <FadeBand uid={`t${uid}`} x={PX} y={PY} w={PW} h={286 + extra * 0.2}
              from={0.92} tint={d.eq[1]} dir="down" />
            <FadeBand uid={`b${uid}`} x={PX} y={perfY - 150}
              w={PW} h={panelBottom - (perfY - 150)}
              from={0.94} dir="up" />
          </>
        )}
      </G>
      {/* A hairline seats the picture into the ticket like a printed photo. */}
      {!!snap && (
        <Rect x={PX} y={picY} width={PW} height={picH} fill="none"
          stroke="#ffffff" strokeOpacity={0.12} strokeWidth={2} />
      )}
      <Rect x={PX} y={PY} width={PW} height={panelBottom - PY} rx={40} fill="none"
        stroke="#ffffff" strokeOpacity={0.26} strokeWidth={3} />

      {/* Header */}
      <SvgText x={STUB_X} y={PY + 72} fill="#ffffff" fillOpacity={0.6} fontSize={23} fontWeight="700" letterSpacing={6}>
        CRUISE FM · ONE DRIVE
      </SvgText>
      <SvgText x={CARD_W - STUB_X} y={PY + 72} fill="#ffffff" fillOpacity={0.6} fontSize={23}
        fontWeight="700" letterSpacing={4} textAnchor="end">
        {modeLabel.toUpperCase()}
      </SvgText>
      <SvgText x={STUB_X} y={PY + 142} fill="#ffffff" fontSize={nameSize} fontWeight="900" letterSpacing={-0.5}>
        {station.name}
      </SvgText>
      {/* The dial number gets a row of its own. Sharing one with the station
          name meant budgeting the name against a dot-matrix block whose width
          swings by a third between "810 AM" and "103.5 FM". */}
      <DotMatrixGroup text={`${d.dialLabel} ${d.band}`} x={STUB_X} y={PY + 164} dot={5.0} gap={1.9}
        color="#ffffff" dim opacity={0.92} />
      <SvgText x={CARD_W - STUB_X} y={PY + 186} fill="#ffffff" fillOpacity={0.5} fontSize={21}
        fontWeight="700" letterSpacing={3} textAnchor="end">
        {`No. ${d.serial}`}
      </SvgText>

      {/* Tear line */}
      <Circle cx={PX} cy={perfY} r={28} fill={holeFill} />
      <Circle cx={CARD_W - PX} cy={perfY} r={28} fill={holeFill} />
      {holes}

      {/* Counterfoil. With a capture the song block is PRINTED AGAIN — but
          pulled to the ticket's foot (owner, 05.08: "pulling the music title
          and song artists' name down"), while the capture's own song block
          now falls off the panel's bottom edge, so the two can't layer. */}
      {(() => {
        const npY = snap ? panelBottom - 208 : stubY;
        return (
          <>
            <SvgText x={STUB_X} y={npY} fill="#ffffff" fillOpacity={0.45} fontSize={21} fontWeight="700" letterSpacing={5}>
              NOW PLAYING
            </SvgText>
            {titleLines.map((line, i) => (
              <SvgText key={i} x={STUB_X} y={npY + 48 + i * 50} fill="#ffffff" fontSize={40} fontWeight="800" letterSpacing={-0.5}>
                {line}
              </SvgText>
            ))}
            {!!d.artist && (
              <SvgText x={STUB_X} y={npY + 48 + titleLines.length * 50 + (snap ? 36 : 4)} fill="#ffffff"
                fillOpacity={0.6} fontSize={27} fontWeight="600">
                {clip(d.artist, 30)}
              </SvgText>
            )}
          </>
        );
      })()}
      {!!d.art && (
        <CoverTile art={d.art} x={coverX} y={snap ? perfY + 30 : stubY - 40} size={COVER} uid={`tk${uid}`}
          tint={mixHex(d.eq[1], '#101322', 0.45)} />
      )}

      {bars}
      <SvgText x={CARD_W - STUB_X} y={snap ? panelBottom - 24 : barcodeY + 46}
        fill="#ffffff" fillOpacity={0.5} fontSize={25}
        fontWeight="600" textAnchor="end">
        {INSTALL_HOST}
      </SvgText>
    </>
  );
}

// ── 2. Snapshot ───────────────────────────────────────────────────────────────
// The ENTIRE page as it was on screen, framed — nothing cut off except the
// phone's own status strip (owner, 04.08: "have it as the entire page but as
// a card ... except leave out the phone information e.g the time data and
// battery"). The capture's aspect is known exactly (the screen's point size
// travels with the uri), so the window is fitted CONTAIN — no slicing — and
// the status bar is removed by drawing the image slightly taller than the
// window and letting the clip take the top strip.

function SnapshotStyle(p: StyleProps) {
  const { uid, cardH, snapshot } = p;
  if (!snapshot) return <TicketStyle {...p} />;

  // The trim lines come from the capture itself, computed at capture time
  // from the modes' real layout: just above "YOU'RE LISTENING TO" at the
  // top, 6pt above the pill row at the bottom. A fixed fraction cut close
  // to the Tuner's play button while giving Vinyl a comfortable gap (owner,
  // 05.08) — points are the same distance on every mode and every phone.
  const band = snapBand(snapshot);
  const portrait = snapshot.h >= snapshot.w;

  // THE CARD IS THE PICTURE now (owner, 05.08: "remove the outer border so
  // the share option only shares the part that is snapshotted") — for a
  // portrait capture the card's height is derived in cardHeightFor, so the
  // picture runs edge to edge over slim strips: air above the eyebrow at
  // the top, cruisefm.app on the bottom one. A landscape capture still
  // letterboxes into the fixed card — its own chrome travels with it.
  const winW = CARD_W - SNAP_SIDE * 2;
  const k = portrait
    ? winW / band.visW
    : Math.min(winW / band.visW, (cardH - SNAP_TOP - SNAP_BOT) / band.visH);
  const drawW = band.visW * k, winH = band.visH * k;
  const WX = (CARD_W - drawW) / 2;
  const WY = portrait ? SNAP_TOP : SNAP_TOP + (cardH - SNAP_TOP - SNAP_BOT - winH) / 2;
  const clipId = `snap${uid}`;
  const footY = cardH - 42;

  return (
    <>
      {/* Plain black around the picture (owner, 05.08: "make the border just
          black so the snapshot stands out") — the station wash was muddying
          the strips. */}
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill="#000000" />

      <Defs>
        <ClipPath id={clipId}>
          <Rect x={WX} y={WY} width={drawW} height={winH} rx={42} ry={42} />
        </ClipPath>
      </Defs>
      {/* NO glow outside the window (owner, 04.08: "make sure the atmosphere
          stops at the edge of the screenshot border") — the halo that stood
          in for a drop shadow read as the app's haze leaking past the edge. */}

      <G clipPath={`url(#${clipId})`}>
        <Rect x={WX} y={WY} width={drawW} height={winH} fill="#05060f" />
        {/* The full capture at its own aspect, drawn slightly taller than the
            window so the status strip sits above the clip — everything below
            it survives untouched. */}
        <SvgImage x={WX} y={WY - snapshot.h * k * band.cropTop}
          width={drawW} height={snapshot.h * k}
          href={{ uri: snapshot.uri }} preserveAspectRatio="xMidYMid meet" />
      </G>
      {/* Thin translucent white frame — the accent-coloured one was tried
          and rolled back the same night (owner: "change the border back to
          the white/transparent border"). */}
      <Rect x={WX} y={WY} width={drawW} height={winH} rx={42} fill="none"
        stroke="#ffffff" strokeOpacity={0.30} strokeWidth={3} />

      {/* Footer — just the address. The page carries everything else. */}
      <SvgText x={CX} y={footY} fill="#ffffff" fillOpacity={0.5} fontSize={26}
        fontWeight="700" letterSpacing={4} textAnchor="middle">
        {INSTALL_HOST}
      </SvgText>
    </>
  );
}

// ── Y2K — the card as a desktop music player ─────────────────────────────────

/**
 * A Windows 95/98 dialog, and the owner's idea (11.08, with two reference
 * images): "having a Y2K windows style type… I wouldn't show the mood station
 * or music mode for these — maybe keep the album and just write the stations
 * and the mode as text".
 *
 * That brief is what makes this style work rather than fight the others. Every
 * other card leads with the mode's artwork; this one leads with CHROME, and
 * the station and mode arrive as text in dialog fields — which is exactly how
 * a nineties player would have shown them. So it needs no ModeHero, no station
 * photograph, and no scrim, and it cannot look like a recolour of the ticket.
 *
 * It also happens to suit the SVG-only rule better than anything here: period
 * chrome is built entirely from 1px light and dark edges, with no gradients,
 * no blur and no shadows. Every bevel below is four rectangles.
 */
const W_FACE   = '#c3c7cb';   // the grey everything is made of
const W_LIT    = '#ffffff';
const W_LIT2   = '#dfe3e6';
const W_SHADE  = '#818a94';
const W_EDGE   = '#0a0a0a';

/** The top-left L of a bevel: up the left side, along the top, then back
 *  inside. The bottom-right edge is just the rect underneath showing. */
function bevelL(x: number, y: number, w: number, h: number, e: number): string {
  return `M${x} ${y + h} L${x} ${y} L${x + w} ${y} L${x + w - e} ${y + e} L${x + e} ${y + e} L${x + e} ${y + h - e} Z`;
}

/** A raised or sunken box. Raised is lit from the top-left, sunken is the same
 *  edges swapped — that inversion is the whole language of the period. */
function Bevel({ x, y, w, h, sunken = false, face = W_FACE, e = 4 }: {
  x: number; y: number; w: number; h: number; sunken?: boolean; face?: string; e?: number;
}) {
  const tl1 = sunken ? W_SHADE : W_LIT;
  const br1 = sunken ? W_LIT : W_EDGE;
  const tl2 = sunken ? W_EDGE : W_LIT2;
  const br2 = sunken ? W_LIT2 : W_SHADE;
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} fill={br1} />
      <Path d={bevelL(x, y, w, h, e)} fill={tl1} />
      <Rect x={x + e} y={y + e} width={w - e * 2} height={h - e * 2} fill={br2} />
      <Path d={bevelL(x + e, y + e, w - e * 2, h - e * 2, e)} fill={tl2} />
      <Rect x={x + e * 2} y={y + e * 2} width={w - e * 4} height={h - e * 4} fill={face} />
    </>
  );
}

/** Black or white, whichever survives on this background. The title bar takes
 *  the station's own colour, and those run from near-white to deep violet. */
function lum(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}
function inkOn(hex: string): string { return lum(hex) > 0.62 ? '#0a0a0a' : '#ffffff'; }

/** An arc of a circle, for the disc's iridescence. Angles in degrees, 0 = east. */
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const pt = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

/** A CD's sheen is not one rainbow but a lot of overlapping ones, and on the
 *  owner's reference it is champagne rather than primary — gold with green and
 *  pink only glancing through. Fixed, NOT the station's colours: this is
 *  hardware, and the same rule the mirror ball settled on applies (material
 *  carries no mood; mood arrives as light). */
const CD_SHEEN = ['#efe0ac', '#e6e6a8', '#c8dfb4', '#bcdcc9', '#c9d9e6', '#dcccdf',
                  '#e8cdd2', '#f0dcb4', '#f2e8c0', '#d8e2bc', '#c4dbd2', '#dfd2e2'];

/** Unlit segments behind the lit ones — the single strongest cue that a
 *  readout is a real display. Same trick as the stations page's dial. */
function ghostOf(t: string): string { return t.replace(/\d/g, '8'); }

function mmss(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** One labelled dialog field: grey label outside, sunken white well, and the
 *  combo-box button that every such field had whether or not it did anything. */
function Field({ label, value, y, labelRight, boxX, boxW, h }: {
  label: string; value: string; y: number; labelRight: number; boxX: number; boxW: number; h: number;
}) {
  const btn = h - 12;
  return (
    <>
      <SvgText x={labelRight} y={y + h * 0.66} fill="#0a0a0a" fontSize={34}
        fontFamily="monospace" textAnchor="end">{label}</SvgText>
      <Bevel x={boxX} y={y} w={boxW} h={h} sunken face="#ffffff" e={3} />
      <SvgText x={boxX + 20} y={y + h * 0.68} fill="#0a0a0a" fontSize={36} fontFamily="monospace">
        {clip(value, Math.floor((boxW - btn - 46) / 21))}
      </SvgText>
      <Bevel x={boxX + boxW - btn - 6} y={y + 6} w={btn} h={btn} e={3} />
      <Path d={`M${boxX + boxW - btn / 2 - 6 - 11} ${y + h / 2 - 5} l22 0 l-11 13 Z`} fill="#0a0a0a" />
    </>
  );
}

function Y2KStyle(p: StyleProps) {
  const { station, track, modeLabel, cardH } = p;
  const d = derive(p);
  // Falls back to the mono face until expo-font has the ttf, so a card
  // captured early degrades to plain digits rather than to nothing.
  const { seg7 } = useDsegFonts();

  // The desktop behind the window. The station's hue, taken well down toward a
  // period wallpaper grey-lilac: it keeps a trace of the mood WITHOUT showing
  // the station, which is the line the owner drew.
  const desktop = mixHex(d.eq[1], '#b7b3d4', 0.48);
  // A very pale station (Mountain Pass's eqColors are literally three whites)
  // gives a title bar barely distinguishable from the window's own grey, so
  // the bar stops reading as a bar. Deepen only those.
  const raw = d.eq[1];
  const bar = lum(raw) > 0.74 ? mixHex(raw, '#5d5a80', 0.42) : raw;
  const barInk = inkOn(bar);

  // The window is sized from its CONTENTS and then centred, rather than
  // stretched to the taskbar — a dialog that ends where its controls end is
  // most of what makes this read as a real window instead of a panel.
  const TASK_H = 92, PAD = 34, TITLE_H = 70;
  const ART = 400, TOP_H = 420, FH = 68, FGAP = 14, PROG_H = 68;
  const WX = 74, WW = CARD_W - WX * 2;
  const WH = TITLE_H + PAD + TOP_H + 44 + (FH + FGAP) * 4 + 26 + PROG_H + PAD;
  const WY = Math.round(cardH - TASK_H - 44 - WH);

  const artX = WX + 52, artY = WY + TITLE_H + PAD;
  const panelX = artX + ART + 46;
  const panelR = WX + WW - 52;

  const fieldsY = artY + TOP_H + 44;
  const labelRight = WX + 262, boxX = WX + 282, boxW = WW - 282 - 52;
  const prog = fieldsY + (FH + FGAP) * 4 + 26;
  // The two seven-segment wells are 168 wide with a 52 margin, so the
  // trough starts clear of them on both sides.
  const barX = WX + 240, barW = WW - 240 - 240;
  const pct = track?.durationMs ? Math.min(1, (track.progressMs ?? 0) / track.durationMs) : 0.42;

  const btn = (i: number) => panelX + i * 76;

  return (
    <>
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={desktop} />

      {/* ── the window ── */}
      <Bevel x={WX} y={WY} w={WW} h={WH} />
      <Rect x={WX + 8} y={WY + 8} width={WW - 16} height={TITLE_H} fill={bar} />
      <SvgText x={WX + 28} y={WY + 8 + TITLE_H * 0.72} fill={barInk} fontSize={44}
        fontWeight="700" fontFamily="monospace" letterSpacing={1}>Cruise FM</SvgText>
      {[0, 1, 2].map((i) => {
        const bw = 52, bx = WX + WW - 28 - (3 - i) * (bw + 6);
        const by = WY + 8 + (TITLE_H - bw) / 2;
        return (
          <G key={i}>
            <Bevel x={bx} y={by} w={bw} h={bw} e={3} />
            {i === 0 && <Rect x={bx + 13} y={by + bw - 21} width={26} height={5} fill="#0a0a0a" />}
            {i === 1 && <Rect x={bx + 13} y={by + 13} width={26} height={26} fill="none" stroke="#0a0a0a" strokeWidth={5} />}
            {i === 2 && <Path d={`M${bx + 15} ${by + 15} l22 22 M${bx + 37} ${by + 15} l-22 22`} stroke="#0a0a0a" strokeWidth={5} />}
          </G>
        );
      })}

      {/* ── album art in a sunken well — the one picture on the card ── */}
      <Bevel x={artX - 10} y={artY - 10} w={ART + 20} h={ART + 20} sunken face="#6b6b6b" e={4} />
      {d.art
        ? <SvgImage x={artX} y={artY} width={ART} height={ART} href={{ uri: d.art }} preserveAspectRatio="xMidYMid slice" />
        : <Rect x={artX} y={artY} width={ART} height={ART} fill={mixHex(d.eq[1], '#20202a', 0.55)} />}

      {/* ── the disc ── */}
      {(() => {
        const cx = panelX + 60, cy = artY + 60, R = 58;
        return (
          <G>
            <Circle cx={cx} cy={cy} r={R} fill="#cdd0d5" stroke="#82868d" strokeWidth={3} />
            {/* Twelve overlapping arcs across the data area. Overlap is what
                turns separate bands into a sheen — drawn apart they read as a
                pie chart, the same failure the CD mode's diffraction fan hit. */}
            {CD_SHEEN.map((c, i) => (
              <Path key={i} d={arcPath(cx, cy, R * 0.70, i * 30 - 8, i * 30 + 38)}
                stroke={c} strokeOpacity={0.62} strokeWidth={R * 0.52} fill="none" strokeLinecap="butt" />
            ))}
            <Circle cx={cx} cy={cy} r={R * 0.44} fill="#e7e9ec" stroke="#9aa0a8" strokeWidth={2} />
            <Circle cx={cx} cy={cy} r={R * 0.33} fill="none" stroke="#b9bfc6" strokeWidth={3} />
            <Circle cx={cx} cy={cy} r={R * 0.17} fill={W_FACE} stroke="#7f848b" strokeWidth={3} />
            {/* one soft catch at the top-left, where the room's light is */}
            <Path d={arcPath(cx, cy, R * 0.83, 196, 250)} stroke="#ffffff" strokeOpacity={0.9}
              strokeWidth={9} fill="none" strokeLinecap="round" />
            <Path d={arcPath(cx, cy, R * 0.83, 20, 52)} stroke="#ffffff" strokeOpacity={0.45}
              strokeWidth={6} fill="none" strokeLinecap="round" />
          </G>
        );
      })()}

      {/* ── the tape deck: a rack component seen slightly from above, which is
             what the reference shows — the lit top and the darker right side
             are most of why it reads as an object rather than a rectangle ── */}
      {(() => {
        const x = panelX, y = artY + 152, w = 182, h = 100, dx = 13, dy = 11;
        return (
          <G>
            <Path d={`M${x} ${y} l${dx} ${-dy} h${w} l${-dx} ${dy} Z`} fill="#e4e7ea" stroke="#8f949b" strokeWidth={2} />
            <Path d={`M${x + w} ${y} l${dx} ${-dy} v${h} l${-dx} ${dy} Z`} fill="#9ba0a7" stroke="#8f949b" strokeWidth={2} />
            <Bevel x={x} y={y} w={w} h={h} e={3} />
            {/* power lamp */}
            <Rect x={x + 14} y={y + 16} width={22} height={16} fill="#7c1f1c" />
            <Rect x={x + 17} y={y + 19} width={16} height={10} fill="#e5433c" />
            {/* the cassette window — sunken, dark, with the two hubs showing */}
            <Bevel x={x + 46} y={y + 12} w={w - 60} h={38} sunken face="#3b4046" e={3} />
            <Rect x={x + 52} y={y + 18} width={w - 72} height={26} fill="#5a6067" />
            <Circle cx={x + 74} cy={y + 31} r={7} fill="#2c3035" />
            <Circle cx={x + w - 40} cy={y + 31} r={7} fill="#2c3035" />
            {/* transport keys along the foot */}
            {Array.from({ length: 9 }).map((_, i) => (
              <G key={i}>
                <Rect x={x + 16 + i * 17} y={y + 62} width={13} height={20} fill="#aeb3ba" />
                <Rect x={x + 16 + i * 17} y={y + 62} width={13} height={4} fill="#eceef1" />
                <Rect x={x + 16 + i * 17} y={y + 78} width={13} height={4} fill="#7d828a" />
              </G>
            ))}
            {/* the little printed lines every one of these carried */}
            <Rect x={x + w - 52} y={y + 66} width={36} height={4} fill="#8f949b" />
            <Rect x={x + w - 52} y={y + 76} width={24} height={4} fill="#8f949b" />
          </G>
        );
      })()}

      {/* ── volume ── */}
      <Bevel x={panelR - 162} y={artY} w={78} h={72} e={3} />
      <Path d={`M${panelR - 142} ${artY + 36} h38 M${panelR - 123} ${artY + 17} v38`} stroke="#0a0a0a" strokeWidth={8} />
      <Bevel x={panelR - 162} y={artY + 84} w={78} h={72} e={3} />
      <Path d={`M${panelR - 142} ${artY + 120} h38`} stroke="#0a0a0a" strokeWidth={8} />
      <Bevel x={panelR - 66} y={artY} w={32} h={156} sunken face="#a9adb3" e={3} />
      <Rect x={panelR - 58} y={artY + 44} width={16} height={104} fill="#1f7a4d" />

      {/* ── transport, two rows, clear of the fields below ── */}
      <Bevel x={panelX} y={artY + 262} w={216} h={68} e={3} />
      <Rect x={panelX + 96} y={artY + 280} width={9} height={32} fill="#0a0a0a" />
      <Rect x={panelX + 112} y={artY + 280} width={9} height={32} fill="#0a0a0a" />
      {/* shuffle: two crossing paths with heads, not a close-box X */}
      <Bevel x={panelX + 228} y={artY + 262} w={68} h={68} e={3} />
      <Path d={`M${panelX + 242} ${artY + 282} q18 0 26 14 q8 14 26 14 M${panelX + 242} ${artY + 310} q18 0 26 -14 q8 -14 26 -14`}
        stroke="#0a0a0a" strokeWidth={5} fill="none" />
      <Path d={`M${panelX + 286} ${artY + 276} l12 6 l-12 6 Z M${panelX + 286} ${artY + 304} l12 6 l-12 6 Z`} fill="#0a0a0a" />
      {/* repeat: a broken loop with a head */}
      <Bevel x={panelX + 304} y={artY + 262} w={68} h={68} e={3} />
      <Path d={`M${panelX + 338} ${artY + 278} a18 18 0 1 1 -16 10`} stroke="#0a0a0a" strokeWidth={5} fill="none" />
      <Path d={`M${panelX + 332} ${artY + 270} l10 8 l-10 8 Z`} fill="#0a0a0a" />
      {['prev', 'rew', 'ff', 'next', 'heart'].map((k, i) => {
        const bx = btn(i), by = artY + 346, cx0 = bx + 34, cy0 = by + 34;
        return (
          <G key={k}>
            <Bevel x={bx} y={by} w={68} h={68} e={3} />
            {k === 'prev' && <Path d={`M${cx0 - 17} ${cy0 - 15} v30 M${cx0 + 17} ${cy0 - 15} v30 l-25 -15 Z`} fill="#0a0a0a" stroke="#0a0a0a" strokeWidth={5} strokeLinejoin="round" />}
            {k === 'rew' && <Path d={`M${cx0 - 1} ${cy0 - 15} v30 l-20 -15 Z M${cx0 + 19} ${cy0 - 15} v30 l-20 -15 Z`} fill="#0a0a0a" />}
            {k === 'ff' && <Path d={`M${cx0 + 1} ${cy0 - 15} v30 l20 -15 Z M${cx0 - 19} ${cy0 - 15} v30 l20 -15 Z`} fill="#0a0a0a" />}
            {k === 'next' && <Path d={`M${cx0 + 17} ${cy0 - 15} v30 M${cx0 - 17} ${cy0 - 15} v30 l25 -15 Z`} fill="#0a0a0a" stroke="#0a0a0a" strokeWidth={5} strokeLinejoin="round" />}
            {k === 'heart' && (
              <Path d={`M${cx0} ${cy0 + 16} C${cx0 - 27} ${cy0 - 2} ${cx0 - 16} ${cy0 - 23} ${cx0} ${cy0 - 8} C${cx0 + 16} ${cy0 - 23} ${cx0 + 27} ${cy0 - 2} ${cx0} ${cy0 + 16} Z`} fill="#0a0a0a" />
            )}
          </G>
        );
      })}

      {/* ── THE POINT: station and mode as plain dialog fields (owner, 11.08:
             "just write the stations and the mode as a text") ── */}
      <Field label="Artist:"  value={d.artist || 'Cruise FM'} y={fieldsY}
        labelRight={labelRight} boxX={boxX} boxW={boxW} h={FH} />
      <Field label="Title:"   value={d.title} y={fieldsY + (FH + FGAP)}
        labelRight={labelRight} boxX={boxX} boxW={boxW} h={FH} />
      <Field label="Station:" value={station.name} y={fieldsY + (FH + FGAP) * 2}
        labelRight={labelRight} boxX={boxX} boxW={boxW} h={FH} />
      <Field label="Mode:"    value={modeLabel} y={fieldsY + (FH + FGAP) * 3}
        labelRight={labelRight} boxX={boxX} boxW={boxW} h={FH} />

      {/* ── scrub, with the counter as a real seven-segment display (owner,
             11.08: "can we push the 7 seg display font?"). DSEG already ships
             with the app for the station dials, so this costs no new asset and
             no build. Only digits and a colon go through it — DSEG7 genuinely
             cannot draw letters, which is how "94.7 FM" once came out "FN". ── */}
      {[0, 1].map((side) => {
        const t = side === 0
          ? (track?.progressMs != null ? mmss(track.progressMs) : '0:00')
          : (track?.durationMs ? mmss(track.durationMs) : '0:00');
        const wDisp = 168, xDisp = side === 0 ? WX + 52 : WX + WW - 52 - wDisp;
        return (
          <G key={side}>
            <Bevel x={xDisp} y={prog + 4} w={wDisp} h={60} sunken face="#767d74" e={3} />
            {/* unlit segments behind the lit ones — the strongest cue that a
                readout is a display rather than printed text */}
            <SvgText x={xDisp + wDisp - 16} y={prog + 48} fill="#000000" fillOpacity={0.13}
              fontSize={38} fontFamily={seg7} textAnchor="end">{ghostOf(t)}</SvgText>
            <SvgText x={xDisp + wDisp - 16} y={prog + 48} fill="#12160f"
              fontSize={38} fontFamily={seg7} textAnchor="end">{t}</SvgText>
          </G>
        );
      })}
      <Bevel x={barX} y={prog + 12} w={barW} h={44} sunken face="#a9adb3" e={3} />
      <Rect x={barX + 8} y={prog + 20} width={Math.max(0, (barW - 16) * pct)} height={28} fill="#6f757c" />
      <Bevel x={barX + (barW - 34) * pct} y={prog + 2} w={34} h={64} e={3} />

      {/* ── taskbar: the natural home for the address ── */}
      <Bevel x={0} y={cardH - TASK_H} w={CARD_W} h={TASK_H} e={4} />
      <Bevel x={16} y={cardH - TASK_H + 16} w={196} h={TASK_H - 32} e={3} />
      <Circle cx={62} cy={cardH - TASK_H / 2} r={17} fill={bar} stroke="#6c7078" strokeWidth={3} />
      <SvgText x={92} y={cardH - TASK_H / 2 + 13} fill="#0a0a0a" fontSize={36}
        fontWeight="700" fontFamily="monospace">Start</SvgText>
      <Bevel x={CARD_W - 442} y={cardH - TASK_H + 16} w={426} h={TASK_H - 32} sunken e={3} />
      <SvgText x={CARD_W - 229} y={cardH - TASK_H / 2 + 13} fill="#0a0a0a" fontSize={34}
        fontFamily="monospace" textAnchor="middle">{INSTALL_HOST}</SvgText>
    </>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/** The card's contents, with no <Svg> wrapper — so the same geometry can be
 *  mounted both in the on-screen preview and in the full-size capture copy. */
export function ShareCardBody(props: StyleProps & { styleId: ShareStyleId }) {
  const { styleId, ...rest } = props;
  switch (styleId) {
    // With no capture to show, Snapshot quietly becomes the Ticket — a chip
    // that renders an empty window would be worse than no chip.
    case 'y2k': return <Y2KStyle {...rest} />;
    case 'snapshot': return <SnapshotStyle {...rest} />;
    case 'ticket':
    default: return <TicketStyle {...rest} />;
  }
}
