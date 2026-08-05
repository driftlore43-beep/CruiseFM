import {
  Circle, ClipPath, Defs, G, Image as SvgImage,
  LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText,
} from 'react-native-svg';

import { DotMatrixGroup } from '@/components/DotMatrix';
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
] as const;

export type ShareStyleId = (typeof SHARE_STYLES)[number]['id'];
export const DEFAULT_SHARE_STYLE: ShareStyleId = 'ticket';

const INSTALL_HOST = 'cruisefm.app';

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

// ── Dispatcher ────────────────────────────────────────────────────────────────

/** The card's contents, with no <Svg> wrapper — so the same geometry can be
 *  mounted both in the on-screen preview and in the full-size capture copy. */
export function ShareCardBody(props: StyleProps & { styleId: ShareStyleId }) {
  const { styleId, ...rest } = props;
  switch (styleId) {
    // With no capture to show, Snapshot quietly becomes the Ticket — a chip
    // that renders an empty window would be worse than no chip.
    case 'snapshot': return <SnapshotStyle {...rest} />;
    case 'ticket':
    default: return <TicketStyle {...rest} />;
  }
}
