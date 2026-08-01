import {
  Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage,
  LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText,
} from 'react-native-svg';

import { DotMatrixGroup, dmFit, dmWidth } from '@/components/DotMatrix';
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
  { id: 'ticket', label: 'Ticket' },
  { id: 'sleeve', label: 'Sleeve' },
  { id: 'receiver', label: 'Receiver' },
] as const;

export type ShareStyleId = (typeof SHARE_STYLES)[number]['id'];
export const DEFAULT_SHARE_STYLE: ShareStyleId = 'ticket';

const INSTALL_HOST = 'cruisefm.app';
const LAMP_RED = '#FF3B30';
const AMBER = '#FF9A2E';

/** Where each band starts and ends, so a needle can sit where the station
 *  actually is rather than always dead centre. Matches the Tuner's own dial. */
const BAND_RANGE: Record<string, [number, number]> = { FM: [87.5, 108.5], AM: [530, 1600] };

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
 * A window showing THE MODE, as it actually appears: the station's own
 * photograph full-bleed behind, the mode's scrim over it, the object on top.
 * Every mode on screen is exactly that stack, and drawing the object on a flat
 * panel instead was most of why the old cards "looked like a different app".
 */
function ModeStage({ d, uid, x, y, w, h, rx = 0 }: {
  d: Derived; uid: string; x: number; y: number; w: number; h: number; rx?: number;
}) {
  const id = `ms${uid}`;
  return (
    <>
      <Defs>
        <ClipPath id={id}><Rect x={x} y={y} width={w} height={h} rx={rx} ry={rx} /></ClipPath>
        <SvgLinearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#03040e" stopOpacity="0.62" />
          <Stop offset="0.45" stopColor="#03040e" stopOpacity="0.44" />
          <Stop offset="1" stopColor="#03040e" stopOpacity="0.66" />
        </SvgLinearGradient>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Rect x={x} y={y} width={w} height={h} fill={d.deep} />
        {!!d.backdrop && (
          <SvgImage x={x} y={y} width={w} height={h} href={d.backdrop as string}
            preserveAspectRatio="xMidYMid slice" />
        )}
        <Rect x={x} y={y} width={w} height={h} fill={`url(#${id}s)`} />
        <G transform={heroBox(x, y, w, h)}>{d.hero}</G>
      </G>
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

  // The owner's own running order (02.08):
  //   header and text / rule / the mode, full bleed / tear /
  //   NOW PLAYING · song · album cover / barcode
  const HEAD_H = 196;
  const headRule = PY + HEAD_H;
  const IMG_Y = headRule + 20;
  // Close to the hero's own 1080:740. A window much wider than that crops the
  // stage top and bottom, and the Tuner's panel is the first thing to lose its
  // head — this leaves about 3% off each edge, which every mode can spare.
  const IMG_H = 600 + (cardH - CARD_H_CARD) * 0.62;
  const perfY = IMG_Y + IMG_H + 52;

  const COVER = 156;
  const coverX = PX + PW - 46 - COVER;
  const titleLines = wrapLines(d.title, 44, STUB_W - (d.art ? 200 : 40), 2);
  const stubContentH = 60 + titleLines.length * 56 + (d.artist ? 36 : 0);
  const barcodeY = panelBottom - 128;
  const stubY = perfY + Math.max(60, ((barcodeY - perfY) - stubContentH) / 2);
  const nameSize = fitSize(station.name, 58, PW - 92, 28);

  // Deepened hard, and again on the owner's note. At 0.42 the band came out a
  // bright saturated blue and read as a UI header rather than card stock.
  const head = mixHex(d.eq[1], '#08090f', 0.80);

  // Guilloche. Real tickets carry a fine engraved pattern that a photocopier
  // can't hold; a low-opacity diagonal weave is the cheapest honest nod to it,
  // and it is what stops the panel reading as a flat rectangle.
  const weave: React.ReactElement[] = [];
  for (let i = 0; i < 48; i++) {
    const x = PX - (panelBottom - PY) + i * 44;
    weave.push(<Path key={`gw${i}`} d={`M ${x} ${panelBottom} L ${x + (panelBottom - PY)} ${PY}`}
      stroke="#ffffff" strokeOpacity={0.05} strokeWidth={1.3} />);
  }

  // Perforation, punched rather than drawn. A dashed stroke reads as a border
  // style; a row of holes in the card's own dark reads as a tear line.
  const holes: React.ReactElement[] = [];
  const hn = Math.floor((PW - 88) / 26);
  for (let i = 0; i <= hn; i++) {
    holes.push(<Circle key={`ph${i}`} cx={PX + 44 + (i * (PW - 88)) / hn} cy={perfY} r={5} fill="#07080f" />);
  }

  const bars: React.ReactElement[] = [];
  let bx = STUB_X;
  for (let i = 0; bx < STUB_X + 330; i++) {
    const w = 3 + Math.round(h01(i * 3.7) * 3) * 2;
    bars.push(<Rect key={`bc${i}`} x={bx} y={barcodeY} width={w} height={56} fill="#ffffff" fillOpacity={0.5} />);
    bx += w + 6;
  }

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.30} />
      {/* Photograph kept as texture only — a busy backdrop fights the object,
          and the mode window carries the real one. */}
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.82, 0.80, 0.84, 0.90]} />

      <Defs>
        <ClipPath id={`tkP${uid}`}>
          <Rect x={PX} y={PY} width={PW} height={panelBottom - PY} rx={40} ry={40} />
        </ClipPath>
        <SvgLinearGradient id={`tkB${uid}`} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0.03" />
        </SvgLinearGradient>
        <SvgLinearGradient id={`tkH${uid}`} x1="0" y1="0" x2="1" y2="0.7">
          <Stop offset="0" stopColor={mixHex(head, '#ffffff', 0.06)} />
          <Stop offset="1" stopColor={mixHex(head, '#04050a', 0.35)} />
        </SvgLinearGradient>
      </Defs>

      {/* The stub */}
      <Rect x={PX} y={PY} width={PW} height={panelBottom - PY} rx={40} fill={`url(#tkB${uid})`} />
      <G clipPath={`url(#tkP${uid})`}>
        {weave}
        <Rect x={PX} y={PY} width={PW} height={HEAD_H} fill={`url(#tkH${uid})`} />
        <Rect x={PX} y={headRule - 2} width={PW} height={2} fill="#ffffff" fillOpacity={0.20} />
        {/* THE MODE, full bleed across the ticket. */}
        <ModeStage d={d} uid={uid} x={PX} y={IMG_Y} w={PW} h={IMG_H} />
      </G>
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
          swings by a third between "810 AM" and "103.5 FM", and "Mountain Pass
          FM" duly ran straight through its own number. */}
      <DotMatrixGroup text={`${d.dialLabel} ${d.band}`} x={STUB_X} y={PY + 164} dot={5.0} gap={1.9}
        color="#ffffff" dim opacity={0.92} />
      <SvgText x={CARD_W - STUB_X} y={PY + 186} fill="#ffffff" fillOpacity={0.45} fontSize={21}
        fontWeight="700" letterSpacing={3} textAnchor="end">
        {`No. ${d.serial}`}
      </SvgText>

      {/* Tear line. The notches are filled with the card's own dark, so the
          stub reads as torn rather than drawn. */}
      <Circle cx={PX} cy={perfY} r={28} fill="#07080f" />
      <Circle cx={CARD_W - PX} cy={perfY} r={28} fill="#07080f" />
      {holes}

      {/* Counterfoil: the song on the left, the album cover on the right. */}
      <SvgText x={STUB_X} y={stubY} fill="#ffffff" fillOpacity={0.42} fontSize={22} fontWeight="700" letterSpacing={5}>
        NOW PLAYING
      </SvgText>
      {titleLines.map((line, i) => (
        <SvgText key={i} x={STUB_X} y={stubY + 60 + i * 56} fill="#ffffff" fontSize={44} fontWeight="800" letterSpacing={-0.5}>
          {line}
        </SvgText>
      ))}
      {!!d.artist && (
        <SvgText x={STUB_X} y={stubY + 60 + titleLines.length * 56 + 4} fill="#ffffff"
          fillOpacity={0.58} fontSize={29} fontWeight="600">
          {clip(d.artist, 30)}
        </SvgText>
      )}
      {!!d.art && (
        <CoverTile art={d.art} x={coverX} y={stubY - 42} size={COVER} uid={`tk${uid}`}
          tint={mixHex(d.eq[1], '#101322', 0.45)} />
      )}

      {bars}
      <SvgText x={CARD_W - STUB_X} y={barcodeY + 46} fill="#ffffff" fillOpacity={0.5} fontSize={25}
        fontWeight="600" textAnchor="end">
        {INSTALL_HOST}
      </SvgText>
    </>
  );
}

// ── 2. Sleeve ─────────────────────────────────────────────────────────────────
// A record jacket with the disc easing out of one side. Everything is PRINTED
// on the board — station, song, catalogue number — and the board itself has to
// look like board: grain, a shrink-wrap sheen, ring wear from the record
// inside, a bumped corner. Those four are what separate a sleeve from a square.

function SleeveStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  // The jacket is deliberately NOT the full card width: the disc has to have
  // somewhere to come out to. A sleeve that fills the frame is just a square.
  const JX = 80, JW = CARD_W - JX - 150;
  const JH = JW;
  // Jacket AND catalogue line are centred as one block. Pinning the line to
  // the card's foot instead left the pin format with the sleeve stranded in
  // the top half and 370px of nothing under it.
  const JY = (cardH - (JH + 100)) / 2;
  const catY = JY + JH + 80;
  const TYPE_BAND = 236;
  const board = mixHex(d.eq[1], '#0e1018', 0.74);
  const print = mixHex(d.eq[0], '#ffffff', 0.10);

  const nameSize = fitSize(station.name, 52, JW - 128, 28);
  const titleLines = wrapLines(d.title, 32, JW - 128, 2);

  const ART_X = JX + 56, ART_Y = JY + 56, ART_W = JW - 112, ART_H = JH - TYPE_BAND - 56;

  // Disc rings, drawn behind the jacket so only the sliver past its edge shows.
  const discCx = JX + JW * 0.70, discCy = JY + JH / 2, discR = JH * 0.47;
  const rings = [];
  for (let i = 0; i < 7; i++) {
    rings.push(<Circle key={`sr${i}`} cx={discCx} cy={discCy} r={discR - 14 - i * 22} fill="none"
      stroke="#ffffff" strokeOpacity={0.16} strokeWidth={1.8} />);
  }

  // Board grain: fine horizontal lines, barely there. Card stock is not a
  // gradient, and at this size the difference is the whole material.
  const grain: React.ReactElement[] = [];
  for (let i = 0; i < 64; i++) {
    grain.push(<Rect key={`gg${i}`} x={JX} y={JY + (i * JH) / 64} width={JW} height={1.1}
      fill="#ffffff" fillOpacity={0.012 + h01(i * 5.7) * 0.022} />);
  }

  const STICK_R = 84, stickX = JX + JW - 118, stickY = JY + 118;

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.26} />
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.78, 0.76, 0.80, 0.90]} />

      <Defs>
        <ClipPath id={`slJ${uid}`}>
          <Rect x={JX} y={JY} width={JW} height={JH} rx={4} ry={4} />
        </ClipPath>
        <SvgLinearGradient id={`slB${uid}`} x1="0" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor={mixHex(board, '#ffffff', 0.10)} />
          <Stop offset="1" stopColor={mixHex(board, '#05060b', 0.30)} />
        </SvgLinearGradient>
        <RadialGradient id={`slD${uid}`} cx="38%" cy="30%" r="72%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.20" />
          <Stop offset="0.6" stopColor="#ffffff" stopOpacity="0.04" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.22" />
        </RadialGradient>
        {/* Shrink wrap. One broad diagonal band, nowhere near a hard edge —
            a stroked highlight would read as a drawn line across the art. */}
        <SvgLinearGradient id={`slW${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0.16" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="0.34" stopColor="#ffffff" stopOpacity="0.085" />
          <Stop offset="0.46" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="0.70" stopColor="#ffffff" stopOpacity="0.045" />
          <Stop offset="0.84" stopColor="#ffffff" stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>

      {/* Disc. Only a sliver of it clears the jacket, so it has to be LIT to
          register at all — at the record's own near-black it simply vanished
          into the card and the sleeve read as a plain square. */}
      <Circle cx={discCx} cy={discCy} r={discR} fill="#16171f" />
      <Circle cx={discCx} cy={discCy} r={discR} fill={`url(#slD${uid})`} />
      {rings}
      <Circle cx={discCx} cy={discCy} r={discR} fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={2.5} />
      <Circle cx={discCx} cy={discCy} r={discR * 0.34} fill={mixHex(d.eq[1], '#101322', 0.40)} />

      {/* Jacket */}
      <Rect x={JX + 6} y={JY + 10} width={JW} height={JH} rx={4} fill="#000000" fillOpacity={0.34} />
      <Rect x={JX} y={JY} width={JW} height={JH} rx={4} fill={`url(#slB${uid})`} />
      <G clipPath={`url(#slJ${uid})`}>
        {/* The board is PRINTED, so it has a picture on it. A flat tint of the
            station colour was the last thing making the jacket read as a
            coloured rectangle rather than card that came off a press. */}
        {!!d.backdrop && (
          <SvgImage x={JX} y={JY} width={JW} height={JH} href={d.backdrop as string}
            preserveAspectRatio="xMidYMid slice" opacity={0.30} />
        )}
        <Rect x={JX} y={JY} width={JW} height={JH} fill={board} fillOpacity={0.52} />
        {grain}
        {/* Ring wear: the record inside presses a circle into the board over
            the years. Nothing says "this has been owned" faster. */}
        <Circle cx={JX + JW * 0.48} cy={ART_Y + ART_H * 0.46} r={ART_W * 0.40} fill="none"
          stroke="#ffffff" strokeOpacity={0.05} strokeWidth={7} />
        <Circle cx={JX + JW * 0.48} cy={ART_Y + ART_H * 0.46} r={ART_W * 0.40} fill="none"
          stroke="#000000" strokeOpacity={0.10} strokeWidth={2} />
      </G>

      {/* Spine down the opening edge — a jacket is a folded sheet, and the fold
          is the one line that stops this reading as a plain square. */}
      <Rect x={JX} y={JY} width={38} height={JH} fill="#000000" fillOpacity={0.30} />
      <Rect x={JX + 38} y={JY} width={2} height={JH} fill="#ffffff" fillOpacity={0.10} />
      {[0, 1, 2].map((k) => (
        <Rect key={`sb${k}`} x={JX + 10} y={JY + 60 + k * 34} width={18} height={16}
          fill={d.eq[k]} fillOpacity={0.75} />
      ))}

      {/* Printed art — the mode as it really looks, photograph and all */}
      <ModeStage d={d} uid={`sl${uid}`} x={ART_X} y={ART_Y} w={ART_W} h={ART_H} rx={6} />
      <Rect x={ART_X} y={ART_Y} width={ART_W} height={ART_H} rx={6}
        fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={1.6} />

      {/* Hype sticker: the roundel a shop slaps on the wrap. Carries the dial
          number, which is the one number this station has. */}
      <Circle cx={stickX} cy={stickY} r={STICK_R} fill={mixHex(d.eq[1], '#ffffff', 0.16)} />
      <Circle cx={stickX} cy={stickY} r={STICK_R} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={2} />
      <Circle cx={stickX} cy={stickY} r={STICK_R - 11} fill="none" stroke="#0a0b12" strokeOpacity={0.28} strokeWidth={1.6} />
      <SvgText x={stickX} y={stickY - 14} fill="#0a0b12" fillOpacity={0.7} fontSize={17} fontWeight="800"
        letterSpacing={3} textAnchor="middle">
        TUNE TO
      </SvgText>
      <SvgText x={stickX} y={stickY + 22} fill="#0a0b12" fontSize={34} fontWeight="900"
        letterSpacing={-0.5} textAnchor="middle">
        {d.dialLabel}
      </SvgText>
      <SvgText x={stickX} y={stickY + 50} fill="#0a0b12" fillOpacity={0.72} fontSize={18} fontWeight="800"
        letterSpacing={4} textAnchor="middle">
        {d.band}
      </SvgText>

      {/* The name, the song and the artist each get a line of their own. Set on
          one baseline with the artist right-aligned, a long station name and a
          long artist simply printed over each other. */}
      <SvgText x={JX + 64} y={JY + JH - TYPE_BAND + 72} fill={print} fontSize={nameSize} fontWeight="900" letterSpacing={-1}>
        {station.name}
      </SvgText>
      {titleLines.map((line, i) => (
        <SvgText key={i} x={JX + 64} y={JY + JH - TYPE_BAND + 124 + i * 40} fill="#ffffff"
          fillOpacity={0.62} fontSize={32} fontWeight="600">
          {line}
        </SvgText>
      ))}
      {!!d.artist && (
        <SvgText x={JX + 64} y={JY + JH - TYPE_BAND + 206} fill="#ffffff" fillOpacity={0.42}
          fontSize={25} fontWeight="700" letterSpacing={3}>
          {clip(d.artist.toUpperCase(), 30)}
        </SvgText>
      )}

      {/* Wrap sheen over everything printed, and a bumped corner under it */}
      <Path d={`M ${JX + JW} ${JY + JH - 54} L ${JX + JW} ${JY + JH} L ${JX + JW - 54} ${JY + JH} Z`}
        fill="#ffffff" fillOpacity={0.07} />
      <Rect x={JX} y={JY} width={JW} height={JH} rx={4} fill={`url(#slW${uid})`} />
      <Rect x={JX} y={JY} width={JW} height={JH} rx={4} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2} />

      {/* Catalogue line */}
      <SvgText x={JX} y={catY} fill="#ffffff" fillOpacity={0.5} fontSize={25} fontWeight="700" letterSpacing={4}>
        {`CFM-${d.dialLabel.replace('.', '')} · ${modeLabel.toUpperCase()}`}
      </SvgText>
      <SvgText x={CARD_W - JX} y={catY} fill="#ffffff" fillOpacity={0.4} fontSize={25}
        fontWeight="600" textAnchor="end">
        {INSTALL_HOST}
      </SvgText>
    </>
  );
}

// ── 3. Receiver ───────────────────────────────────────────────────────────────
// The card as a head unit, in the same language as the Stations page and the
// Tuner. The first pass was a flat black rectangle with type on it; a real set
// has a moulded bezel, a recessed glass display that catches light, a readout
// that glows onto its own surround, and a dial whose needle is somewhere
// specific. All five of those are here.

function ReceiverStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  const B = 40;                                        // bezel inset
  const PAD = 88;
  const W = CARD_W - PAD * 2;

  // Brushed metal: vertical hairlines at alternating strengths. Cheap, and it
  // is what stops the panel reading as flat black.
  const brush = [];
  for (let i = 0; i < 96; i++) {
    const x = (i / 96) * CARD_W;
    brush.push(<Rect key={`br${i}`} x={x} y={0} width={2.6} height={cardH} fill="#ffffff"
      fillOpacity={0.010 + h01(i * 7.13) * 0.026} />);
  }

  // Readout
  const FREQ_DOT = 13.5, FREQ_GAP = 5;
  const freqText = d.band === 'AM' ? d.dialLabel.replace(' AM', '') : d.dialLabel.replace(' FM', '');
  const freqW = dmWidth(freqText, FREQ_DOT, FREQ_GAP);
  const bandDot = 7.6, bandGap = 2.6;
  const readoutW = freqW + 34 + dmWidth(d.band, bandDot, bandGap);
  const readoutX = CX - readoutW / 2;

  // Glass display, holding the lamp row and the readout.
  const GX = B + 34, GW = CARD_W - (B + 34) * 2;
  const GY = B + 34, GH = 316;

  // Window. Sized off its HEIGHT: a full-width window is 639 tall, which puts
  // the song readout straight through the dial along the foot.
  const WIN_Y = 476 + (cardH - CARD_H_CARD) * 0.18;
  const WIN_H = 452 + (cardH - CARD_H_CARD) * 0.60;
  const S = WIN_H / STAGE_H;
  const WIN_W = CARD_W * S, WIN_X = CX - WIN_W / 2;

  const lineW = W - 24;
  const titleText = clip(d.title.toUpperCase(), Math.max(1, dmFit(lineW, 4.6, 1.7)));
  const artistText = clip(d.artist.toUpperCase(), Math.max(1, dmFit(lineW, 3.4, 1.3)));

  // Dial, with the needle where the station actually sits in its band.
  const dialY = cardH - 216;
  const [lo, hi] = BAND_RANGE[d.band] ?? BAND_RANGE.FM;
  const t = Math.max(0.04, Math.min(0.96, (d.dialValue - lo) / (hi - lo)));
  const needleX = PAD + t * W;
  const ticks = [];
  for (let i = 0; i <= 40; i++) {
    const x = PAD + (i / 40) * W;
    const whole = i % 5 === 0;
    ticks.push(<Rect key={`tk${i}`} x={x - (whole ? 2 : 1.1)} y={dialY - (whole ? 34 : 19)}
      width={whole ? 4 : 2.2} height={whole ? 34 : 19} fill={AMBER} fillOpacity={whole ? 0.72 : 0.28} />);
  }

  return (
    <>
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill="#06070c" />
      {brush}
      <Defs>
        <RadialGradient id={`rcG${uid}`} cx="50%" cy="30%" r="62%">
          <Stop offset="0" stopColor={d.wash} stopOpacity="0.26" />
          <Stop offset="1" stopColor={d.wash} stopOpacity="0" />
        </RadialGradient>
        <SvgLinearGradient id={`rcB${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <Stop offset="0.12" stopColor="#ffffff" stopOpacity="0.03" />
          <Stop offset="0.9" stopColor="#000000" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.34" />
        </SvgLinearGradient>
        <SvgLinearGradient id={`rcGl${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0b0f18" />
          <Stop offset="1" stopColor="#04050a" />
        </SvgLinearGradient>
        {/* The one sweep of light across the glass. Any harder and it reads as
            a painted stripe rather than a reflection. */}
        <SvgLinearGradient id={`rcR${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0.20" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="0.40" stopColor="#ffffff" stopOpacity="0.055" />
          <Stop offset="0.56" stopColor="#ffffff" stopOpacity="0" />
        </SvgLinearGradient>
        <RadialGradient id={`rcA${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={AMBER} stopOpacity="0.34" />
          <Stop offset="1" stopColor={AMBER} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={`url(#rcG${uid})`} />

      {/* Moulded bezel */}
      <Rect x={B} y={B} width={CARD_W - B * 2} height={cardH - B * 2} rx={44} fill={`url(#rcB${uid})`} />
      <Rect x={B} y={B} width={CARD_W - B * 2} height={cardH - B * 2} rx={44}
        fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={2} />
      {[[B + 30, B + 30], [CARD_W - B - 30, B + 30], [B + 30, cardH - B - 30], [CARD_W - B - 30, cardH - B - 30]].map(([x, y], k) => (
        <G key={`sw${k}`}>
          <Circle cx={x} cy={y} r={10} fill="#000000" fillOpacity={0.45} />
          <Circle cx={x} cy={y} r={10} fill="none" stroke="#ffffff" strokeOpacity={0.16} strokeWidth={1.4} />
          <Rect x={x - 6} y={y - 1} width={12} height={2} fill="#ffffff" fillOpacity={0.22} />
        </G>
      ))}

      {/* Glass display */}
      <Rect x={GX} y={GY} width={GW} height={GH} rx={20} fill={`url(#rcGl${uid})`}
        stroke="#000000" strokeOpacity={0.55} strokeWidth={3} />
      <Rect x={GX} y={GY} width={GW} height={GH} rx={20} fill="none" stroke="#ffffff" strokeOpacity={0.09} strokeWidth={1.4} />

      {/* Lamp row */}
      <Circle cx={GX + 42} cy={GY + 46} r={10} fill={LAMP_RED} />
      <Circle cx={GX + 42} cy={GY + 46} r={20} fill={LAMP_RED} fillOpacity={0.24} />
      <DotMatrixGroup text="ON AIR" x={GX + 68} y={GY + 34} dot={3.6} gap={1.4} color="#FF6B5A" opacity={0.95} />
      <DotMatrixGroup text="STEREO" x={CX - 40} y={GY + 34} dot={3.6} gap={1.4} color="#9FD8FF" opacity={0.5} />
      <DotMatrixGroup text="TUNED" x={GX + GW - 34} y={GY + 34} dot={3.6} gap={1.4}
        color="#9FD8FF" anchor="end" opacity={0.5} />

      {/* Frequency, glowing onto its own glass */}
      <Ellipse cx={CX} cy={GY + 154} rx={readoutW * 0.78} ry={112} fill={`url(#rcA${uid})`} />
      <DotMatrixGroup text={freqText} x={readoutX} y={GY + 92} dot={FREQ_DOT} gap={FREQ_GAP} color={AMBER} dim opacity={1} />
      <DotMatrixGroup text={d.band} x={readoutX + freqW + 34} y={GY + 92 + FREQ_DOT * 3} dot={bandDot} gap={bandGap}
        color={AMBER} dim opacity={0.9} />
      <DotMatrixGroup text={clip(station.name.toUpperCase(), Math.max(1, dmFit(GW - 80, 4.0, 1.5)))}
        x={CX} y={GY + 252} dot={4.0} gap={1.5} color="#CFE6FF" anchor="middle" opacity={0.72} />
      <Rect x={GX} y={GY} width={GW} height={GH} rx={20} fill={`url(#rcR${uid})`} />

      {/* Silk-screened label under the glass */}
      <SvgText x={CX} y={GY + GH + 62} fill="#ffffff" fillOpacity={0.34} fontSize={23} fontWeight="700"
        letterSpacing={6} textAnchor="middle">
        {modeLabel.toUpperCase()}
      </SvgText>

      {/* Recessed window: paired strokes are what read as moulded, not drawn */}
      <Rect x={WIN_X - 10} y={WIN_Y - 10} width={WIN_W + 20} height={WIN_H + 20} rx={30}
        fill="#000000" fillOpacity={0.5} stroke="#ffffff" strokeOpacity={0.10} strokeWidth={2} />
      <ModeStage d={d} uid={`rc${uid}`} x={WIN_X} y={WIN_Y} w={WIN_W} h={WIN_H} rx={22} />
      <Rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx={22} fill="none"
        stroke={d.eq[1]} strokeOpacity={0.30} strokeWidth={2.5} />

      {/* Song, in the readout's own type */}
      <DotMatrixGroup text={titleText} x={PAD + 12} y={WIN_Y + WIN_H + 54} dot={4.6} gap={1.7}
        color={mixHex(d.eq[1], '#ffffff', 0.30)} dim opacity={1} />
      {!!artistText && (
        <DotMatrixGroup text={artistText} x={PAD + 12} y={WIN_Y + WIN_H + 116} dot={3.4} gap={1.3}
          color={mixHex(d.eq[1], '#ffffff', 0.30)} opacity={0.66} />
      )}

      {/* Dial. The needle sits where this station really is in its band — the
          first version parked it dead centre on every card, which is the sort
          of detail that quietly tells you nothing here is real. */}
      {ticks}
      <SvgText x={PAD} y={dialY + 40} fill={AMBER} fillOpacity={0.45} fontSize={20} fontWeight="800" letterSpacing={2}>
        {String(lo)}
      </SvgText>
      <SvgText x={PAD + W} y={dialY + 40} fill={AMBER} fillOpacity={0.45} fontSize={20} fontWeight="800"
        letterSpacing={2} textAnchor="end">
        {String(hi)}
      </SvgText>
      <Rect x={PAD} y={dialY} width={W} height={3.5} fill={AMBER} fillOpacity={0.45} />
      <Rect x={needleX - 7} y={dialY - 68} width={14} height={118} rx={7} fill={LAMP_RED} fillOpacity={0.16} />
      <Rect x={needleX - 2.4} y={dialY - 68} width={4.8} height={118} rx={2.4} fill={LAMP_RED} fillOpacity={0.8} />
      <Rect x={needleX - 0.9} y={dialY - 68} width={1.8} height={118} fill="#FFD9D4" fillOpacity={0.9} />

      {/* One footer row. The first version stacked a volume knob, an etched
          wordmark, the install line AND the dial's own band labels into the
          same 90px, and all four printed over each other — the knob was the
          least load-bearing of them, so it went. */}
      <DotMatrixGroup text="CRUISE FM" x={PAD} y={cardH - 118} dot={3.8} gap={1.5} color="#ffffff" opacity={0.55} />
      <SvgText x={CARD_W - PAD} y={cardH - 92} fill="#ffffff" fillOpacity={0.34} fontSize={24}
        fontWeight="600" textAnchor="end">
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
    case 'sleeve': return <SleeveStyle {...rest} />;
    case 'receiver': return <ReceiverStyle {...rest} />;
    case 'ticket':
    default: return <TicketStyle {...rest} />;
  }
}
