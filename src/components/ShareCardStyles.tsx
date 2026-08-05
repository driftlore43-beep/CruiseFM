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
  /** A real screenshot of the running mode (react-native-view-shot), plus the
   *  screen's point size for aspect math and the trim lines computed from the
   *  live layout (see ModeActionRow.grabModeSnapshot); null when capture
   *  wasn't possible — older builds, web, or a native failure. */
  snapshot?: { uri: string; w: number; h: number; cropTopPt?: number; cropBotPt?: number } | null;
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

  // The owner's running order (02.08): header and text / the mode, covering
  // the whole card / tear / NOW PLAYING · song · album cover / barcode.
  // The photograph is the card's background end to end; the mode's object sits
  // on it at full width, so it is never cropped, and the type reads because
  // the top and bottom are faded rather than boxed off.
  // A shade under the panel's full width: at 100% the counterfoil lost the
  // room its artist line needs and ran into the barcode.
  const HERO_W = Math.round(PW * 0.95);
  const HERO_H = Math.round((HERO_W * STAGE_H) / CARD_W);
  const HERO_X = CX - HERO_W / 2;
  const HERO_Y = PY + 190 + extra * 0.36;
  const perfY = HERO_Y + HERO_H + 32;
  const barcodeY = panelBottom - 120;

  const COVER = 156;
  const coverX = PX + PW - 46 - COVER;
  const titleLines = wrapLines(d.title, 40, STUB_W - (d.art ? 200 : 40), 2);
  const stubContentH = 56 + titleLines.length * 50 + (d.artist ? 34 : 0);
  const stubY = perfY + Math.max(56, ((barcodeY - perfY) - stubContentH) / 2);
  const nameSize = fitSize(station.name, 58, PW - 92, 28);

  /**
   * Snapshot placement (owner, 04.08, off her Circular EQ ticket): cover the
   * panel, but BIASED DOWNWARD rather than centred — centring hid the mode's
   * top under the header ("the mode is still cut off, can this be dragged
   * down"). TK_TOP_FRAC starts the picture just below the capture's own
   * chrome, which drops the object's crown into the clear zone and lands the
   * capture's own title and seek bar in the counterfoil area — visible now,
   * because the ticket's duplicate song text is gone (her "Holiday" was
   * ghost-layering under the ticket's own "Holiday").
   */
  const snap = p.snapshot;
  const panelH = panelBottom - PY;
  const sk = snap ? Math.max(PW / snap.w, panelH / snap.h) : 1;
  const simgW = snap ? snap.w * sk : 0;
  const simgH = snap ? snap.h * sk : 0;
  // 0.163 → 0.05 (owner, 05.08: "drag down the mode's position… leaving out
  // the music scrub"): the lower start pushes the capture's own song block
  // and seek bar off the panel's foot for the modes that carry them low, so
  // the printed title below can't ghost against them again.
  const TK_TOP_FRAC = 0.05;
  const sTopF = snap
    ? (snap.h >= snap.w
        ? Math.min(TK_TOP_FRAC, Math.max(0, (simgH - panelH) / simgH))
        : ((simgH - panelH) / 2) / simgH)
    : 0;
  // With a capture, the barcode and cover tuck up under the tear so the
  // capture's own song block and scrub stay in the open.
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
    bars.push(<Rect key={`bc${i}`} x={bx} y={barY} width={w} height={56} fill="#ffffff" fillOpacity={0.5} />);
    bx += w + 6;
  }

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.30} />
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.86, 0.84, 0.86, 0.92]} />

      <Defs>
        <ClipPath id={`tkP${uid}`}>
          <Rect x={PX} y={PY} width={PW} height={panelBottom - PY} rx={40} ry={40} />
        </ClipPath>
      </Defs>

      <G clipPath={`url(#tkP${uid})`}>
        {/* With a real capture, THE MODE IS THE TICKET'S WHOLE BACKGROUND —
            "as if the ticket template just sits over the mode playing"
            (owner, 04.08, replacing the framed window that cut the mode
            off). `slice` covers the panel edge to edge; the trim it takes
            from the capture's top and bottom is where the status bar and
            the pills live, so the object band is what fills the card. The
            header, tear, counterfoil and barcode print over it, under the
            same fades that made the station photograph readable. */}
        {snap ? (
          <SvgImage x={PX - (simgW - PW) / 2} y={PY - simgH * sTopF}
            width={simgW} height={simgH}
            href={{ uri: snap.uri }} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <>
            <PhotoFill d={d} uid={uid} x={PX} y={PY} w={PW} h={panelBottom - PY} />
            <G transform={heroBox(HERO_X, HERO_Y, HERO_W, HERO_H, 'contain')}>{d.hero}</G>
          </>
        )}
        {weave}
        {/* Fades tightened to the type they serve (owner, 05.08: "a lot of
            vignette around the ticket's edges — remove that"): the header
            band is shorter and lighter, and with a capture the bottom fade
            is bottom-anchored so the picture zone above the tear carries no
            shading at all. */}
        <FadeBand uid={`t${uid}`} x={PX} y={PY} w={PW} h={snap ? 232 : 286 + extra * 0.2}
          from={snap ? 0.74 : 0.92} tint={d.eq[1]} dir="down" />
        <FadeBand uid={`b${uid}`} x={PX} y={snap ? panelBottom - 310 : perfY - 150}
          w={PW} h={snap ? 310 : panelBottom - (perfY - 150)}
          from={snap ? 0.90 : 0.94} dir="up" />
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
          swings by a third between "810 AM" and "103.5 FM". */}
      <DotMatrixGroup text={`${d.dialLabel} ${d.band}`} x={STUB_X} y={PY + 164} dot={5.0} gap={1.9}
        color="#ffffff" dim opacity={0.92} />
      <SvgText x={CARD_W - STUB_X} y={PY + 186} fill="#ffffff" fillOpacity={0.5} fontSize={21}
        fontWeight="700" letterSpacing={3} textAnchor="end">
        {`No. ${d.serial}`}
      </SvgText>

      {/* Tear line */}
      <Circle cx={PX} cy={perfY} r={28} fill="#07080f" />
      <Circle cx={CARD_W - PX} cy={perfY} r={28} fill="#07080f" />
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

/** Fraction fallbacks for captures that arrived without point crops. */
const CROP_TOP_FRAC = 0.120;
const CROP_BOT_FRAC = 0.118;

function SnapshotStyle(p: StyleProps) {
  const d = derive(p);
  const { uid, cardH, snapshot } = p;
  if (!snapshot) return <TicketStyle {...p} />;

  // The trim lines come from the capture itself, computed at capture time
  // from the modes' real layout: just above "YOU'RE LISTENING TO" at the
  // top, 6pt above the pill row at the bottom. A fixed fraction cut close
  // to the Tuner's play button while giving Vinyl a comfortable gap (owner,
  // 05.08) — points are the same distance on every mode and every phone.
  const portrait = snapshot.h >= snapshot.w;
  const cropTop = portrait
    ? (snapshot.cropTopPt ?? snapshot.h * CROP_TOP_FRAC) / snapshot.h
    : 0;                                        // landscape has its own chrome
  const cropBot = portrait
    ? (snapshot.cropBotPt ?? snapshot.h * CROP_BOT_FRAC) / snapshot.h
    : 0;
  const visW = snapshot.w;
  const visH = snapshot.h * (1 - cropTop - cropBot);

  // No header of any kind (owner, 04.08: "remove 'tuner · station number',
  // station mode, that sits at the top of the card") — the page already
  // names its own station, and printing it twice was clutter. Just the
  // picture, a thin accent frame, and cruisefm.app underneath.
  const TOP = 76, BOT = 112, SIDE = 84;
  const k = Math.min((CARD_W - SIDE * 2) / visW, (cardH - TOP - BOT) / visH);
  const winW = visW * k, winH = visH * k;
  const WX = (CARD_W - winW) / 2;
  const WY = TOP + (cardH - TOP - BOT - winH) / 2;
  const clipId = `snap${uid}`;
  const footY = cardH - 58;

  return (
    <>
      <BaseWash d={d} uid={uid} cardH={cardH} glow={0.30} />
      <Backdrop d={d} uid={uid} cardH={cardH} stops={[0.78, 0.68, 0.78, 0.92]} />

      <Defs>
        <ClipPath id={clipId}>
          <Rect x={WX} y={WY} width={winW} height={winH} rx={42} ry={42} />
        </ClipPath>
      </Defs>
      {/* NO glow outside the window (owner, 04.08: "make sure the atmosphere
          stops at the edge of the screenshot border") — the halo that stood
          in for a drop shadow read as the app's haze leaking past the edge. */}

      <G clipPath={`url(#${clipId})`}>
        <Rect x={WX} y={WY} width={winW} height={winH} fill="#05060f" />
        {/* The full capture at its own aspect, drawn slightly taller than the
            window so the status strip sits above the clip — everything below
            it survives untouched. */}
        <SvgImage x={WX} y={WY - snapshot.h * k * cropTop}
          width={winW} height={snapshot.h * k}
          href={{ uri: snapshot.uri }} preserveAspectRatio="xMidYMid meet" />
      </G>
      {/* Thin translucent white frame — the accent-coloured one was tried
          and rolled back the same night (owner: "change the border back to
          the white/transparent border"). */}
      <Rect x={WX} y={WY} width={winW} height={winH} rx={42} fill="none"
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
