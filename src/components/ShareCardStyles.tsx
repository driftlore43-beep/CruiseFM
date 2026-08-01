import {
  Circle, ClipPath, Defs, G, Image as SvgImage, LinearGradient as SvgLinearGradient,
  Path, RadialGradient, Rect, Stop, Text as SvgText,
} from 'react-native-svg';

import { DotMatrixGroup, dmFit, dmWidth } from '@/components/DotMatrix';
import {
  CARD_W, CX, CY, ModeHero, STAGE_H, STAGE_TOP, glowCol, mixHex, type Eq,
} from '@/components/ShareModeArt';
import type { Station } from '@/constants/stations';
import { stationDial, stationFrequency } from '@/constants/stations';
import type { NowPlaying } from '@/utils/useMusicPlayback';

/**
 * THE SHARE CARD'S DESIGN STYLES.
 *
 * Spotify offers a handful of looks for the same now-playing pin; this is the
 * Cruise FM equivalent. Every style draws the SAME mode hero (ShareModeArt) —
 * that's the part nobody else has — and differs in how the card is FRAMED
 * around it: photograph, poster, object, hardware, or pure type.
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

// Ordered so the OBJECT family (a thing you could hold) sits together in the
// middle — that's the direction the owner picked out of round 1.
export const SHARE_STYLES = [
  { id: 'now', label: 'Now Playing' },
  { id: 'poster', label: 'Poster' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'sleeve', label: 'Sleeve' },
  { id: 'polaroid', label: 'Instant' },
  { id: 'postcard', label: 'Postcard' },
  { id: 'receiver', label: 'Receiver' },
  { id: 'minimal', label: 'Minimal' },
] as const;

export type ShareStyleId = (typeof SHARE_STYLES)[number]['id'];

const INSTALL_HOST = 'cruisefm.app';

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

/** The hero is authored against a fixed stage (y 150..890, 1080 wide). Styles
 *  that want it smaller or lower wrap it in this — scaling about the stage's
 *  own centre so it stays put rather than sliding toward the origin. */
function heroTransform(scale: number, dy: number): string {
  const tx = CX * (1 - scale);
  const ty = CY * (1 - scale) + dy;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale})`;
}

/** Fit the whole hero stage inside an arbitrary box, centred — "contain", not
 *  "cover". Cropping is not an option here: the modes are drawn to the stage's
 *  full width (the cassette shell alone is 896 of 1080), so trimming the sides
 *  to fill a square window slices the object rather than the background. */
function heroFit(x: number, y: number, w: number, h: number): string {
  const s = Math.min(w / CARD_W, h / STAGE_H);
  const tx = x + (w - CARD_W * s) / 2;
  const ty = y + (h - STAGE_H * s) / 2 - STAGE_TOP * s;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`;
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
  dialLabel: string; band: string; freq: number;
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
    freq,
    hero: (
      <ModeHero modeId={modeId} eq={eq} art={track?.albumArt ?? null} uid={uid}
        title={title} artist={artist} freq={freq} />
    ),
  };
}

/** The station photograph under a scrim — the backdrop every mode actually
 *  has on screen. Styles that skip it look like a poster; styles that keep it
 *  look like the app. */
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

// ── 1. Now Playing ────────────────────────────────────────────────────────────
// The original card: the app's own look, straight out. Full-bleed station
// photograph, the mode standing on it, and the song credited underneath.

function NowStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel, userName } = p;
  const PAD = 96;
  const extra = cardH - CARD_H_CARD;
  // The pin is 270px taller. Splitting the extra room between the hero and the
  // type block keeps the composition rather than opening one huge gap.
  const heroDy = extra * 0.42;

  const TITLE_SIZE = 66;
  const TITLE_TOP = 962 + extra;
  const LINE_STEP = 80;
  const titleLines = wrapLines(d.title, TITLE_SIZE, CARD_W - PAD * 2, 2);
  const artistY = TITLE_TOP + (titleLines.length - 1) * LINE_STEP + 56;
  const listeningLine = userName ? `${userName} is listening on` : 'Now playing on';

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} />
      {/* Deliberately light through the middle — burying the photograph makes
          the card look like a flat gradient. Only the last stop is heavy;
          that's the one the song title sits on. */}
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.46, 0.30, 0.52, 0.90]} />
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={`url(#bg${uid})`} />

      <G transform={heroTransform(1, heroDy)}>{d.hero}</G>

      <SvgText x={PAD} y={100} fill="#ffffff" fillOpacity={0.62} fontSize={30} fontWeight="700" letterSpacing={6}>
        {station.name.toUpperCase()}
      </SvgText>
      <SvgText x={CARD_W - PAD} y={100} fill="#ffffff" fillOpacity={0.42} fontSize={28} fontWeight="700"
        letterSpacing={4} textAnchor="end">
        {modeLabel.toUpperCase()}
      </SvgText>

      {titleLines.map((line, i) => (
        <SvgText key={i} x={PAD} y={TITLE_TOP + i * LINE_STEP} fill="#ffffff"
          fontSize={TITLE_SIZE} fontWeight="800" letterSpacing={-1}>
          {line}
        </SvgText>
      ))}
      {!!d.artist && (
        <SvgText x={PAD} y={artistY} fill="#ffffff" fillOpacity={0.62} fontSize={38} fontWeight="600">
          {clip(d.artist, 38)}
        </SvgText>
      )}

      <SvgText x={PAD} y={1158 + extra} fill="#ffffff" fillOpacity={0.55} fontSize={30} fontWeight="600">
        {listeningLine}
      </SvgText>
      <SvgText x={PAD} y={1204 + extra} fill={mixHex(d.eq[1], '#ffffff', 0.35)} fontSize={38} fontWeight="800">
        {station.name}
      </SvgText>

      <Rect x={PAD} y={1242 + extra} width={CARD_W - PAD * 2} height={2} fill="#ffffff" fillOpacity={0.12} />
      <SvgText x={PAD} y={1306 + extra} fill="#ffffff" fontSize={34} fontWeight="800" letterSpacing={3}>
        CRUISE FM
      </SvgText>
      <SvgText x={CARD_W - PAD} y={1306 + extra} fill="#ffffff" fillOpacity={0.5} fontSize={30}
        fontWeight="600" textAnchor="end">
        {INSTALL_HOST}
      </SvgText>
      <Path d={`M ${CARD_W - PAD - 250} ${cardH - 56} a 15 15 0 1 0 0.1 0 Z`} fill={d.eq[1]} fillOpacity={0.85} />
    </>
  );
}

// ── 2. Poster ─────────────────────────────────────────────────────────────────
// The station is the headline and the song is the credit — because the mood is
// what Cruise FM sells and the track is whatever happened to be on. Photograph
// left brighter than the other styles, type kept to one column at the foot.

function PosterStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  const PAD = 88;
  const W = CARD_W - PAD * 2;
  const blockTop = cardH - 452;

  const nameSize = fitSize(station.name, 88, W, 44);
  const titleLines = wrapLines(d.title, 50, W, 2);

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.22} />
      {/* Lighter than Now Playing on purpose: a poster is the photograph. */}
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.30, 0.16, 0.40, 0.95]} />
      <Defs>
        {/* A second sweep from the foot, so the type column always has ground
            under it however bright the photograph happens to be. */}
        <SvgLinearGradient id={`pf${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#04050c" stopOpacity="0" />
          <Stop offset="1" stopColor="#04050c" stopOpacity="0.88" />
        </SvgLinearGradient>
      </Defs>

      <G transform={heroTransform(0.80, -(cardH - CARD_H_CARD) * 0.10 - 40)}>{d.hero}</G>

      <Rect x={0} y={blockTop - 260} width={CARD_W} height={cardH - blockTop + 260} fill={`url(#pf${uid})`} />

      {/* Top rail */}
      <SvgText x={PAD} y={96} fill="#ffffff" fillOpacity={0.5} fontSize={26} fontWeight="700" letterSpacing={5}>
        {modeLabel.toUpperCase()}
      </SvgText>
      <SvgText x={CARD_W - PAD} y={96} fill={mixHex(d.eq[1], '#ffffff', 0.45)} fillOpacity={0.9}
        fontSize={26} fontWeight="800" letterSpacing={3} textAnchor="end">
        {`${d.dialLabel} ${d.band}`}
      </SvgText>

      {/* Headline */}
      <SvgText x={PAD} y={blockTop} fill="#ffffff" fontSize={nameSize} fontWeight="900" letterSpacing={-2}>
        {station.name}
      </SvgText>
      <Rect x={PAD} y={blockTop + 34} width={128} height={7} rx={3.5} fill={d.eq[1]} />
      <SvgText x={PAD} y={blockTop + 96} fill="#ffffff" fillOpacity={0.55} fontSize={27} fontWeight="700" letterSpacing={4}>
        {station.tagline.toUpperCase()}
      </SvgText>

      {/* Credit. Skipped with no live track: the title falls back to the
          station's tagline, which this style already prints above — the same
          sentence twice reads as a bug, not a layout. */}
      {!!p.track && titleLines.map((line, i) => (
        <SvgText key={i} x={PAD} y={blockTop + 190 + i * 62} fill="#ffffff" fontSize={50} fontWeight="800" letterSpacing={-0.5}>
          {line}
        </SvgText>
      ))}
      {!!d.artist && (
        <SvgText x={PAD} y={blockTop + 190 + titleLines.length * 62 + 8} fill="#ffffff"
          fillOpacity={0.58} fontSize={32} fontWeight="600">
          {clip(d.artist, 40)}
        </SvgText>
      )}

      <SvgText x={PAD} y={cardH - 62} fill="#ffffff" fillOpacity={0.72} fontSize={28} fontWeight="800" letterSpacing={4}>
        CRUISE FM
      </SvgText>
      <SvgText x={CARD_W - PAD} y={cardH - 62} fill="#ffffff" fillOpacity={0.42} fontSize={26}
        fontWeight="600" textAnchor="end">
        {INSTALL_HOST}
      </SvgText>
    </>
  );
}

// ── 3. Ticket ─────────────────────────────────────────────────────────────────
// The drive as a stub: dial number and station up top, the mode in a window,
// a torn perforation, and the song printed on the counterfoil. The one style
// that is an OBJECT rather than a layout, which is what makes it collectable.

function TicketStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  const PX = 62, PY = 62;
  const PW = CARD_W - PX * 2;
  const PH = cardH - PY * 2;
  const panelBottom = PY + PH;

  // Window. Sized off its HEIGHT, not the panel's width: filling the width
  // makes the window 592 tall and leaves the counterfoil too short for two
  // lines of song title, which then runs straight through the barcode.
  // A taller card gives most of its extra height to the window rather than to
  // the counterfoil — the stub needs the room it needs and no more, and left
  // to itself the pin opened a dead 270px gap above the barcode.
  const WIN_Y = 348, WIN_H = 440 + (cardH - CARD_H_CARD) * 0.66;
  const S = WIN_H / STAGE_H;
  const WIN_W = CARD_W * S, WIN_X = CX - WIN_W / 2;
  const perfY = WIN_Y + WIN_H + 68;

  // The counterfoil's type column runs the panel's full inner width, not the
  // window's — the window is narrower than the stub it sits in.
  const STUB_X = PX + 46, STUB_W = PW - 92;
  const titleLines = wrapLines(d.title, 46, STUB_W - 40, 2);
  // The dial gets its OWN row rather than sharing one with the station name.
  // Sharing meant budgeting the name against a dot-matrix block whose width
  // swings by a third between "810 AM" and "103.5 FM" — and "Mountain Pass FM"
  // duly ran straight through its own dial number. A row each cannot collide.
  const DIAL_DOT = 5.4, DIAL_GAP = 2.0;
  const dialText = `${d.dialLabel} ${d.band}`;
  const nameSize = fitSize(station.name, 54, PW - 92, 28);

  // A barcode is just bars — and it is the detail that says "ticket" fastest.
  const bars = [];
  let bx = STUB_X;
  for (let i = 0; bx < STUB_X + 360; i++) {
    const w = 3 + Math.round(((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3) * 2;
    bars.push(<Rect key={`bc${i}`} x={bx} y={panelBottom - 140} width={w} height={58} fill="#ffffff" fillOpacity={0.42} />);
    bx += w + 6;
  }

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.30} />
      {/* Photograph kept as texture only — a busy backdrop fights the object. */}
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.80, 0.78, 0.82, 0.90]} />

      <Defs>
        <ClipPath id={`tkW${uid}`}>
          <Rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx={26} ry={26} />
        </ClipPath>
        <SvgLinearGradient id={`tkP${uid}`} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0.035" />
        </SvgLinearGradient>
      </Defs>

      {/* The stub */}
      <Rect x={PX} y={PY} width={PW} height={PH} rx={46} fill={`url(#tkP${uid})`}
        stroke="#ffffff" strokeOpacity={0.26} strokeWidth={3} />
      <Rect x={PX + 12} y={PY + 12} width={PW - 24} height={PH - 24} rx={36}
        fill="none" stroke="#000000" strokeOpacity={0.22} strokeWidth={2} />

      {/* Header */}
      <SvgText x={PX + 46} y={PY + 88} fill="#ffffff" fillOpacity={0.45} fontSize={24} fontWeight="700" letterSpacing={6}>
        CRUISE FM · ONE DRIVE
      </SvgText>
      <SvgText x={CARD_W - PX - 46} y={PY + 88} fill="#ffffff" fillOpacity={0.5} fontSize={26}
        fontWeight="700" letterSpacing={4} textAnchor="end">
        {modeLabel.toUpperCase()}
      </SvgText>
      <DotMatrixGroup text={dialText} x={CARD_W - PX - 46} y={PY + 120} dot={DIAL_DOT} gap={DIAL_GAP}
        color={mixHex(d.eq[1], '#ffffff', 0.35)} dim anchor="end" opacity={0.95} />
      <SvgText x={PX + 46} y={PY + 232} fill="#ffffff" fontSize={nameSize} fontWeight="800" letterSpacing={-0.5}>
        {station.name}
      </SvgText>
      <Rect x={PX + 46} y={PY + 266} width={PW - 92} height={2} fill="#ffffff" fillOpacity={0.14} />

      {/* Window */}
      <Rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx={26} fill="#05060d" fillOpacity={0.55} />
      <G clipPath={`url(#tkW${uid})`}>
        <G transform={`translate(${WIN_X.toFixed(2)} ${(WIN_Y - STAGE_TOP * S).toFixed(2)}) scale(${S.toFixed(4)})`}>
          {d.hero}
        </G>
      </G>
      <Rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx={26} fill="none"
        stroke="#ffffff" strokeOpacity={0.20} strokeWidth={2.5} />

      {/* Perforation. The notches are filled with the card's own dark, so the
          stub reads as torn rather than drawn. */}
      <Circle cx={PX} cy={perfY} r={30} fill="#07080f" />
      <Circle cx={CARD_W - PX} cy={perfY} r={30} fill="#07080f" />
      <Path d={`M ${PX + 44} ${perfY} L ${CARD_W - PX - 44} ${perfY}`} stroke="#ffffff" strokeOpacity={0.30}
        strokeWidth={3} strokeDasharray="10 14" strokeLinecap="round" />

      {/* Counterfoil */}
      <SvgText x={STUB_X} y={perfY + 74} fill="#ffffff" fillOpacity={0.42} fontSize={23} fontWeight="700" letterSpacing={5}>
        NOW PLAYING
      </SvgText>
      {titleLines.map((line, i) => (
        <SvgText key={i} x={STUB_X} y={perfY + 136 + i * 58} fill="#ffffff" fontSize={46} fontWeight="800" letterSpacing={-0.5}>
          {line}
        </SvgText>
      ))}
      {!!d.artist && (
        <SvgText x={STUB_X} y={perfY + 136 + titleLines.length * 58 + 4} fill="#ffffff"
          fillOpacity={0.58} fontSize={30} fontWeight="600">
          {clip(d.artist, 36)}
        </SvgText>
      )}

      {bars}
      {/* One footer line, not two. The counterfoil has to fit an eyebrow, two
          title lines, an artist and the barcode; an "ADMIT ONE" flourish under
          all that was the line that tipped it into a jumble, and the barcode
          already says ticket louder than any words would. */}
      <SvgText x={CARD_W - PX - 46} y={panelBottom - 96} fill="#ffffff" fillOpacity={0.5} fontSize={26}
        fontWeight="600" textAnchor="end">
        {INSTALL_HOST}
      </SvgText>
    </>
  );
}

// ── 4. Sleeve ─────────────────────────────────────────────────────────────────
// A record jacket, with the disc easing out of the right-hand side. Everything
// is PRINTED on the sleeve — station, song, catalogue number — because that is
// what makes it an object rather than a card with a picture on it.

function SleeveStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  // The jacket is deliberately NOT the full card width: the disc has to have
  // somewhere to come out to. A sleeve that fills the frame is just a square.
  const JX = 80, JW = CARD_W - JX - 150;               // square jacket
  const JH = JW;
  // Jacket AND catalogue line are centred as one block. Pinning the line to
  // the card's foot instead left the pin format with the sleeve stranded in
  // the top half and 370px of nothing under it.
  const JY = (cardH - (JH + 100)) / 2;
  const catY = JY + JH + 80;
  const TYPE_BAND = 236;                               // printed matter at the foot
  const board = mixHex(d.eq[1], '#0e1018', 0.74);
  const print = mixHex(d.eq[0], '#ffffff', 0.10);

  const nameSize = fitSize(station.name, 52, JW - 128, 28);
  const titleLines = wrapLines(d.title, 32, JW - 128, 2);

  // Disc rings, drawn behind the jacket so only the sliver past its edge shows.
  const discCx = JX + JW * 0.70, discCy = JY + JH / 2, discR = JH * 0.47;
  const rings = [];
  for (let i = 0; i < 7; i++) {
    rings.push(<Circle key={`sr${i}`} cx={discCx} cy={discCy} r={discR - 14 - i * 22} fill="none"
      stroke="#ffffff" strokeOpacity={0.16} strokeWidth={1.8} />);
  }

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.26} />
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.78, 0.76, 0.80, 0.90]} />

      <Defs>
        <ClipPath id={`slA${uid}`}>
          <Rect x={JX + 56} y={JY + 56} width={JW - 112} height={JH - TYPE_BAND - 56} rx={6} ry={6} />
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
      <Rect x={JX} y={JY} width={JW} height={JH} rx={4} fill={`url(#slB${uid})`}
        stroke="#ffffff" strokeOpacity={0.16} strokeWidth={2} />
      {/* Spine down the opening edge — a jacket is a folded sheet, and the fold
          is the one line that stops this reading as a plain square. */}
      <Rect x={JX} y={JY} width={38} height={JH} fill="#000000" fillOpacity={0.28} />
      <Rect x={JX + 38} y={JY} width={2} height={JH} fill="#ffffff" fillOpacity={0.10} />
      {[0, 1, 2].map((k) => (
        <Rect key={`sb${k}`} x={JX + 10} y={JY + 60 + k * 34} width={18} height={16}
          fill={d.eq[k]} fillOpacity={0.75} />
      ))}

      {/* Printed art */}
      <Rect x={JX + 56} y={JY + 56} width={JW - 112} height={JH - TYPE_BAND - 56} rx={6}
        fill="#05060c" fillOpacity={0.42} />
      <G clipPath={`url(#slA${uid})`}>
        <G transform={heroFit(JX + 56, JY + 56, JW - 112, JH - TYPE_BAND - 56)}>{d.hero}</G>
      </G>
      <Rect x={JX + 56} y={JY + 56} width={JW - 112} height={JH - TYPE_BAND - 56} rx={6}
        fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={1.6} />

      {/* Printed type */}
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

// ── 5. Instant ────────────────────────────────────────────────────────────────
// An instant photo: a white border with a deep chin, and the caption written in
// DARK type on it. That inversion is the whole point — among seven dark cards,
// this one stops a feed.

function PolaroidStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  const PAPER = '#f3f0e8', INK = '#16181f', INK2 = '#6a6f7d';
  const FX = 96, FW = CARD_W - FX * 2;
  const LIP = 46;
  const PHOTO = FW - LIP * 2;                                    // square window
  // The chin has to hold two caption lines, the artist AND the footer. Sized
  // by eye at 176 it did none of that: the artist fell off the bottom of the
  // print and the footer ran through the caption's second line.
  const CHIN = 262 + (cardH - CARD_H_CARD) * 0.34;
  const FH = LIP + PHOTO + CHIN;
  const FY = Math.max(80, (cardH - FH) / 2 - 40);
  const PX0 = FX + LIP, PY0 = FY + LIP;

  // Budget leaves the right-hand dial stamp alone; the caption is a column,
  // not a full-width line.
  const titleLines = wrapLines(d.title, 40, FW - LIP * 2 - 280, 2);

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.30} />
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.74, 0.72, 0.78, 0.90]} />

      <Defs>
        <ClipPath id={`plC${uid}`}>
          <Rect x={PX0} y={PY0} width={PHOTO} height={PHOTO} />
        </ClipPath>
        <SvgLinearGradient id={`plP${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor={PAPER} />
        </SvgLinearGradient>
      </Defs>

      {/* Print */}
      <Rect x={FX + 8} y={FY + 12} width={FW} height={FH} rx={6} fill="#000000" fillOpacity={0.38} />
      <Rect x={FX} y={FY} width={FW} height={FH} rx={6} fill={`url(#plP${uid})`} />

      {/* Photo */}
      <Rect x={PX0} y={PY0} width={PHOTO} height={PHOTO} fill="#06070d" />
      <G clipPath={`url(#plC${uid})`}>
        <Rect x={PX0} y={PY0} width={PHOTO} height={PHOTO} fill={d.deep} />
        {!!d.backdrop && (
          <SvgImage x={PX0} y={PY0} width={PHOTO} height={PHOTO} href={d.backdrop as string}
            preserveAspectRatio="xMidYMid slice" opacity={0.5} />
        )}
        <G transform={heroFit(PX0, PY0, PHOTO, PHOTO)}>{d.hero}</G>
      </G>
      <Rect x={PX0} y={PY0} width={PHOTO} height={PHOTO} fill="none" stroke="#000000" strokeOpacity={0.12} strokeWidth={2} />

      {/* Caption, on the chin */}
      {titleLines.map((line, i) => (
        <SvgText key={i} x={PX0} y={PY0 + PHOTO + 82 + i * 48} fill={INK} fontSize={40} fontWeight="800" letterSpacing={-0.5}>
          {line}
        </SvgText>
      ))}
      <SvgText x={PX0} y={PY0 + PHOTO + 82 + titleLines.length * 48 + 6} fill={INK2} fontSize={28} fontWeight="600">
        {d.artist ? `${clip(d.artist, 26)} · ${station.name}` : station.name}
      </SvgText>
      {/* Right-hand stamp: dial number and mode, set like a photo-lab print */}
      <SvgText x={FX + FW - LIP} y={PY0 + PHOTO + 82} fill={mixHex(d.eq[2], '#1a1c24', 0.45)}
        fontSize={34} fontWeight="900" letterSpacing={1} textAnchor="end">
        {`${d.dialLabel} ${d.band}`}
      </SvgText>
      <SvgText x={FX + FW - LIP} y={PY0 + PHOTO + 124} fill={INK2} fontSize={22} fontWeight="700"
        letterSpacing={3} textAnchor="end">
        {modeLabel.toUpperCase()}
      </SvgText>
      <SvgText x={PX0} y={FY + FH - 34} fill={INK2} fontSize={22} fontWeight="700" letterSpacing={4}>
        {`CRUISE FM · ${INSTALL_HOST}`}
      </SvgText>
    </>
  );
}

// ── 6. Postcard ───────────────────────────────────────────────────────────────
// Greetings from the station. The mood stations are places, which is the whole
// premise of the app — so the one format built for sending a place suits it
// better than any of the music formats do.

function PostcardStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  const PAPER = '#efe9dc', INK = '#1b1d24', INK2 = '#6d7180';
  const M = 54;                                        // the card sits inset, like a real one
  const CW = CARD_W - M * 2, CH = cardH - M * 2;
  const PHOTO_H = CH * 0.54;
  const paperY = M + PHOTO_H;

  const nameSize = fitSize(station.name, 92, CW - 120, 44);
  const titleLines = wrapLines(d.title, 40, CW * 0.52, 2);

  // Stamp, with a punched edge. The perforation is circles of the PAPER colour
  // laid over the stamp's rim — the cheap way to a torn edge with no mask.
  const SX = M + CW - 250, SY = paperY + 56, SW = 176, SH = 210;
  const perf: React.ReactElement[] = [];
  const stepX = SW / 7, stepY = SH / 8;
  for (let i = 0; i <= 7; i++) {
    perf.push(<Circle key={`pt${i}`} cx={SX + i * stepX} cy={SY} r={7} fill={PAPER} />);
    perf.push(<Circle key={`pb${i}`} cx={SX + i * stepX} cy={SY + SH} r={7} fill={PAPER} />);
  }
  for (let i = 0; i <= 8; i++) {
    perf.push(<Circle key={`pl${i}`} cx={SX} cy={SY + i * stepY} r={7} fill={PAPER} />);
    perf.push(<Circle key={`pr${i}`} cx={SX + SW} cy={SY + i * stepY} r={7} fill={PAPER} />);
  }

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.24} />

      <Defs>
        <ClipPath id={`pcC${uid}`}>
          <Rect x={M} y={M} width={CW} height={PHOTO_H} />
        </ClipPath>
        <SvgLinearGradient id={`pcS${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#03040e" stopOpacity="0.30" />
          <Stop offset="0.6" stopColor="#03040e" stopOpacity="0.18" />
          <Stop offset="1" stopColor="#03040e" stopOpacity="0.62" />
        </SvgLinearGradient>
      </Defs>

      <Rect x={M + 8} y={M + 12} width={CW} height={CH} rx={8} fill="#000000" fillOpacity={0.40} />
      <Rect x={M} y={M} width={CW} height={CH} rx={8} fill={PAPER} />

      {/* The picture side */}
      <G clipPath={`url(#pcC${uid})`}>
        <Rect x={M} y={M} width={CW} height={PHOTO_H} fill={d.deep} />
        {!!d.backdrop && (
          <SvgImage x={M} y={M} width={CW} height={PHOTO_H} href={d.backdrop as string}
            preserveAspectRatio="xMidYMid slice" />
        )}
        <Rect x={M} y={M} width={CW} height={PHOTO_H} fill={`url(#pcS${uid})`} />
        {/* Fitted from the card's own top edge, not above it — starting 30px
            higher clipped the vinyl's tonearm off the top of the picture. */}
        <G transform={heroFit(M, M, CW, PHOTO_H * 0.84)}>{d.hero}</G>
      </G>

      {/* Greetings lettering. Drawn twice, offset, in the station's own colour —
          the poor man's vintage letterpress, and it needs no second font. */}
      <SvgText x={M + 44} y={paperY - 116} fill="#ffffff" fillOpacity={0.7} fontSize={28}
        fontWeight="800" letterSpacing={8}>
        GREETINGS FROM
      </SvgText>
      <SvgText x={M + 40} y={paperY - 34} fill={mixHex(d.eq[2], '#0a0b12', 0.45)} fontSize={nameSize}
        fontWeight="900" letterSpacing={-2}>
        {station.name}
      </SvgText>
      <SvgText x={M + 34} y={paperY - 40} fill="#ffffff" fontSize={nameSize} fontWeight="900" letterSpacing={-2}>
        {station.name}
      </SvgText>

      {/* The written side */}
      <Rect x={M + 44} y={paperY + 44} width={2} height={CH - PHOTO_H - 132} fill={INK} fillOpacity={0.10} />
      <SvgText x={M + 80} y={paperY + 96} fill={INK2} fontSize={22} fontWeight="700" letterSpacing={5}>
        NOW PLAYING
      </SvgText>
      {titleLines.map((line, i) => (
        <SvgText key={i} x={M + 80} y={paperY + 154 + i * 50} fill={INK} fontSize={40} fontWeight="800" letterSpacing={-0.5}>
          {line}
        </SvgText>
      ))}
      {!!d.artist && (
        <SvgText x={M + 80} y={paperY + 154 + titleLines.length * 50 + 4} fill={INK2} fontSize={28} fontWeight="600">
          {clip(d.artist, 28)}
        </SvgText>
      )}

      {/* Stamp + postmark */}
      <Rect x={SX} y={SY} width={SW} height={SH} fill={mixHex(d.eq[1], '#f2ece0', 0.30)} />
      <Rect x={SX + 14} y={SY + 14} width={SW - 28} height={SH - 28} fill="none" stroke={INK} strokeOpacity={0.22} strokeWidth={1.6} />
      <DotMatrixGroup text={d.dialLabel} x={SX + SW / 2} y={SY + 56} dot={4.4} gap={1.6}
        color={mixHex(d.eq[2], '#1a1c24', 0.35)} anchor="middle" opacity={0.95} />
      <SvgText x={SX + SW / 2} y={SY + 138} fill={INK} fillOpacity={0.6} fontSize={22} fontWeight="800"
        letterSpacing={2} textAnchor="middle">
        {d.band}
      </SvgText>
      <SvgText x={SX + SW / 2} y={SY + 178} fill={INK} fillOpacity={0.4} fontSize={17} fontWeight="700"
        letterSpacing={2} textAnchor="middle">
        CRUISE FM
      </SvgText>
      {perf}
      {[0, 1, 2].map((k) => (
        <Circle key={`pm${k}`} cx={SX - 42} cy={SY + 96} r={62 - k * 16} fill="none"
          stroke={INK} strokeOpacity={0.16} strokeWidth={2} />
      ))}

      {/* Address lines */}
      {[0, 1, 2].map((k) => (
        <Rect key={`ad${k}`} x={SX - 96} y={SY + SH + 62 + k * 46} width={SW + 96} height={2}
          fill={INK} fillOpacity={0.16} />
      ))}

      <SvgText x={M + 80} y={M + CH - 46} fill={INK2} fontSize={22} fontWeight="700" letterSpacing={4}>
        {`${modeLabel.toUpperCase()} · ${INSTALL_HOST}`}
      </SvgText>
    </>
  );
}

// ── 7. Receiver ───────────────────────────────────────────────────────────────
// The card as a head unit, in the same language as the Stations page and the
// Tuner: brushed panel, amber dot-matrix readout, recessed window, dial and
// needle. Everything is drawn with DotMatrix rather than a font, so it ships
// over the air with nothing new installed.

const AMBER = '#FF9A2E';
const LAMP_RED = '#FF3B30';

function ReceiverStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  const PAD = 74;
  const W = CARD_W - PAD * 2;

  // Brushed metal: vertical hairlines at alternating strengths. Cheap, and it
  // is what stops the panel reading as flat black.
  const brush = [];
  for (let i = 0; i < 78; i++) {
    const x = (i / 78) * CARD_W;
    const o = 0.012 + (((Math.sin(i * 78.233) * 43758.5453) % 1 + 1) % 1) * 0.030;
    brush.push(<Rect key={`br${i}`} x={x} y={0} width={2.4} height={cardH} fill="#ffffff" fillOpacity={o} />);
  }

  // Readout
  const FREQ_DOT = 15, FREQ_GAP = 5;
  const freqText = d.band === 'AM' ? d.dialLabel.replace(' AM', '') : d.dialLabel.replace(' FM', '');
  const freqW = dmWidth(freqText, FREQ_DOT, FREQ_GAP);
  const bandDot = 7.6, bandGap = 2.6;
  const readoutW = freqW + 34 + dmWidth(d.band, bandDot, bandGap);
  const readoutX = CX - readoutW / 2;

  // Window. Sized off its HEIGHT for the same reason the ticket's is: a
  // full-width window is 639 tall, which puts the song readout straight
  // through the dial along the foot.
  // Same rule as the ticket: the extra height of a pin goes into the window,
  // not into a gap above the dial.
  const WIN_Y = 452 + (cardH - CARD_H_CARD) * 0.18;
  const WIN_H = 470 + (cardH - CARD_H_CARD) * 0.60;
  const S = WIN_H / STAGE_H;
  const WIN_W = CARD_W * S, WIN_X = CX - WIN_W / 2;

  const lineW = W - 24;
  const titleText = clip(d.title.toUpperCase(), Math.max(1, dmFit(lineW, 4.6, 1.7)));
  const artistText = clip(d.artist.toUpperCase(), Math.max(1, dmFit(lineW, 3.4, 1.3)));

  // Dial strip along the foot
  const dialY = cardH - 178;
  const ticks = [];
  for (let i = -20; i <= 20; i++) {
    const x = CX + i * 26;
    if (x < PAD || x > CARD_W - PAD) continue;
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
        <ClipPath id={`rcW${uid}`}>
          <Rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx={22} ry={22} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={`url(#rcG${uid})`} />

      {/* Lamp row */}
      <Circle cx={PAD + 12} cy={104} r={11} fill={LAMP_RED} />
      <Circle cx={PAD + 12} cy={104} r={21} fill={LAMP_RED} fillOpacity={0.22} />
      <DotMatrixGroup text="ON AIR" x={PAD + 40} y={92} dot={3.6} gap={1.4} color="#FF6B5A" opacity={0.95} />
      <DotMatrixGroup text="STEREO" x={CX - 40} y={92} dot={3.6} gap={1.4} color="#9FD8FF" opacity={0.55} />
      <DotMatrixGroup text="TUNED" x={CARD_W - PAD} y={92} dot={3.6} gap={1.4}
        color="#9FD8FF" anchor="end" opacity={0.55} />

      {/* Frequency */}
      <DotMatrixGroup text={freqText} x={readoutX} y={168} dot={FREQ_DOT} gap={FREQ_GAP} color={AMBER} dim opacity={1} />
      <DotMatrixGroup text={d.band} x={readoutX + freqW + 34} y={168 + FREQ_DOT * 3} dot={bandDot} gap={bandGap}
        color={AMBER} dim opacity={0.9} />

      <SvgText x={CX} y={392} fill="#ffffff" fillOpacity={0.72} fontSize={34} fontWeight="800"
        letterSpacing={7} textAnchor="middle">
        {station.name.toUpperCase()}
      </SvgText>
      <SvgText x={CX} y={434} fill="#ffffff" fillOpacity={0.34} fontSize={24} fontWeight="700"
        letterSpacing={5} textAnchor="middle">
        {modeLabel.toUpperCase()}
      </SvgText>

      {/* Recessed window: paired strokes are what read as moulded, not drawn */}
      <Rect x={WIN_X - 10} y={WIN_Y - 10} width={WIN_W + 20} height={WIN_H + 20} rx={30}
        fill="#000000" fillOpacity={0.45} stroke="#ffffff" strokeOpacity={0.10} strokeWidth={2} />
      <Rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx={22} fill="#04050b" />
      <G clipPath={`url(#rcW${uid})`}>
        <G transform={`translate(${WIN_X.toFixed(2)} ${(WIN_Y - STAGE_TOP * S).toFixed(2)}) scale(${S.toFixed(4)})`}>
          {d.hero}
        </G>
      </G>
      <Rect x={WIN_X} y={WIN_Y} width={WIN_W} height={WIN_H} rx={22} fill="none"
        stroke={d.eq[1]} strokeOpacity={0.28} strokeWidth={2.5} />

      {/* Song, in the readout's own type */}
      <DotMatrixGroup text={titleText} x={PAD + 12} y={WIN_Y + WIN_H + 58} dot={4.6} gap={1.7}
        color={mixHex(d.eq[1], '#ffffff', 0.30)} dim opacity={1} />
      {!!artistText && (
        <DotMatrixGroup text={artistText} x={PAD + 12} y={WIN_Y + WIN_H + 122} dot={3.4} gap={1.3}
          color={mixHex(d.eq[1], '#ffffff', 0.30)} opacity={0.66} />
      )}

      {/* Dial */}
      {ticks}
      <Rect x={PAD} y={dialY} width={W} height={3.5} fill={AMBER} fillOpacity={0.45} />
      <Rect x={CX - 7} y={dialY - 68} width={14} height={118} rx={7} fill={LAMP_RED} fillOpacity={0.14} />
      <Rect x={CX - 2.4} y={dialY - 68} width={4.8} height={118} rx={2.4} fill={LAMP_RED} fillOpacity={0.78} />
      <Rect x={CX - 0.9} y={dialY - 68} width={1.8} height={118} fill="#FFD9D4" fillOpacity={0.9} />

      <DotMatrixGroup text="CRUISE FM" x={PAD} y={cardH - 88} dot={3.8} gap={1.5} color="#ffffff" opacity={0.6} />
      <SvgText x={CARD_W - PAD} y={cardH - 66} fill="#ffffff" fillOpacity={0.4} fontSize={26}
        fontWeight="600" textAnchor="end">
        {INSTALL_HOST}
      </SvgText>
    </>
  );
}

// ── 8. Minimal ────────────────────────────────────────────────────────────────
// No photograph at all: the station's own colours, the mode floating in them,
// and the song set large with a lot of air. The art-print option, and the one
// that survives being seen at thumbnail size in a feed.

function MinimalStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, station, modeLabel } = p;
  const PAD = 104;
  const W = CARD_W - PAD * 2;
  // Three lines at 72, not two at 82: a display size that ellipsises a song
  // title halfway through a word isn't a display size, it's a mistake.
  const titleLines = wrapLines(d.title, 72, W, 3);
  const blockTop = cardH - 470;

  return (
    <>
      <Defs>
        <SvgLinearGradient id={`mnB${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={mixHex(d.eq[0], '#0a0b14', 0.70)} />
          <Stop offset="0.48" stopColor={mixHex(d.eq[1], '#08090f', 0.62)} />
          <Stop offset="1" stopColor="#05060b" />
        </SvgLinearGradient>
        <RadialGradient id={`mnG${uid}`} cx="50%" cy="34%" r="58%">
          <Stop offset="0" stopColor={d.wash} stopOpacity="0.40" />
          <Stop offset="1" stopColor={d.wash} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={`url(#mnB${uid})`} />
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={`url(#mnG${uid})`} />

      {/* The pin's extra height is spent on a bigger hero, not on more empty
          gradient — a small object floating in a lot of colour reads as a
          mistake at feed size. */}
      <G transform={heroTransform(0.72 + ((cardH - CARD_H_CARD) / CARD_H_CARD) * 0.42, (cardH - CARD_H_CARD) * 0.16 - 46)}>
        {d.hero}
      </G>

      <SvgText x={PAD} y={blockTop} fill="#ffffff" fillOpacity={0.42} fontSize={26} fontWeight="700" letterSpacing={6}>
        {`${station.name.toUpperCase()} · ${modeLabel.toUpperCase()}`}
      </SvgText>
      {titleLines.map((line, i) => (
        <SvgText key={i} x={PAD} y={blockTop + 104 + i * 86} fill="#ffffff"
          fontSize={72} fontWeight="800" letterSpacing={-2}>
          {line}
        </SvgText>
      ))}
      {!!d.artist && (
        <SvgText x={PAD} y={blockTop + 104 + titleLines.length * 86 + 6} fill="#ffffff"
          fillOpacity={0.55} fontSize={36} fontWeight="600">
          {clip(d.artist, 36)}
        </SvgText>
      )}

      <Rect x={PAD} y={cardH - 118} width={96} height={5} rx={2.5} fill={d.eq[1]} fillOpacity={0.9} />
      <SvgText x={PAD} y={cardH - 58} fill="#ffffff" fillOpacity={0.5} fontSize={26} fontWeight="700" letterSpacing={4}>
        {`CRUISE FM · ${INSTALL_HOST}`}
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
    case 'poster': return <PosterStyle {...rest} />;
    case 'ticket': return <TicketStyle {...rest} />;
    case 'sleeve': return <SleeveStyle {...rest} />;
    case 'polaroid': return <PolaroidStyle {...rest} />;
    case 'postcard': return <PostcardStyle {...rest} />;
    case 'receiver': return <ReceiverStyle {...rest} />;
    case 'minimal': return <MinimalStyle {...rest} />;
    case 'now':
    default: return <NowStyle {...rest} />;
  }
}
