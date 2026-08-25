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
import { usePixelFont } from '@/utils/pixelFont';
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

/** The Y2K card's own near-square height. 1080x1150 sits between a square and
 *  4:5 — it frames the window without a dead band of wallpaper, and iMessage
 *  and WhatsApp still show it uncropped. */
export const Y2K_H = 1150;

export const SHARE_STYLES = [
  // Snapshot leads: a REAL capture of the running mode (owner, 27.07: "since
  // this is a more visual app… share this like a screenshot but in a card
  // form"). Its chip only appears when a capture exists, so Y2K is the
  // standing fallback — it draws no capture at all, which is exactly what a
  // style has to do to stand in for one.
  //
  // Sleeve and Receiver were cut 04.08, and TICKET on 13.08 ("I would
  // actually remove the ticket mode in the share option — it's currently not
  // my favourite"). Two styles that do genuinely different things beats four
  // that overlap.
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'y2k', label: 'Y2K' },
] as const;

export type ShareStyleId = (typeof SHARE_STYLES)[number]['id'];
export const DEFAULT_SHARE_STYLE: ShareStyleId = 'y2k';

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

/** The capture band the SNAPSHOT shows: everything between the status strip
 *  and the pill row — transport included, that is the point of the style. */
function snapBand(snap: SnapshotInfo) {
  const portrait = snap.h >= snap.w;
  const cropTop = portrait ? (snap.cropTopPt ?? snap.h * CROP_TOP_FRAC) / snap.h : 0;
  const cropBot = portrait ? (snap.cropBotPt ?? snap.h * CROP_BOT_FRAC) / snap.h : 0;
  return { cropTop, cropBot, visW: snap.w, visH: snap.h * (1 - cropTop - cropBot) };
}

/** The card's height for a given style/format/capture. The sheet sizes the
 *  preview and the export copy with this; the styles lay out against it. */
export function cardHeightFor(styleId: ShareStyleId, format: ShareFormat, snap?: SnapshotInfo | null): number {
  // Y2K draws no capture, so its shape is always the chosen format — except
  // that the 4:5 card is deliberately squarer (owner, 11.08: "cut off the top
  // area to make it look more square and centralized"). A dialog on a desktop
  // wants a frame close to its own proportions; 4:5 left a band of empty
  // wallpaper above the window.
  if (styleId === 'y2k') return format === 'pin' ? FORMAT_H.pin : Y2K_H;
  if (styleId === 'snapshot' && snap && snap.h >= snap.w) {
    const band = snapBand(snap);
    return Math.round(SNAP_TOP + ((CARD_W - SNAP_SIDE * 2) * band.visH) / band.visW + SNAP_BOT);
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

function clip(text: string, chars: number): string {
  return text.length > chars ? `${text.slice(0, chars - 1).trimEnd()}…` : text;
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
  const dial = stationDial(station.id, !!station.premium, station.dialAm);
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
    hero: (
      <ModeHero modeId={modeId} eq={eq} art={track?.albumArt ?? null} uid={uid}
        title={title} artist={artist} freq={freq} />
    ),
  };
}

// ── 1. Snapshot ───────────────────────────────────────────────────────────────
// The ENTIRE page as it was on screen, framed — nothing cut off except the
// phone's own status strip (owner, 04.08: "have it as the entire page but as
// a card ... except leave out the phone information e.g the time data and
// battery"). The capture's aspect is known exactly (the screen's point size
// travels with the uri), so the window is fitted CONTAIN — no slicing — and
// the status bar is removed by drawing the image slightly taller than the
// window and letting the clip take the top strip.

function SnapshotStyle(p: StyleProps) {
  const { uid, cardH, snapshot } = p;
  // Belt and braces: the chip is hidden without a capture, so this should
  // never fire — but a style that renders nothing would be worse than one that
  // renders the other card.
  if (!snapshot) return <Y2KStyle {...p} />;

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

// ── 2. Y2K — the card as a desktop music player ─────────────────────────────────

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

function mmss(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** One labelled dialog field: grey label outside, sunken white well, and the
 *  combo-box button that every such field had whether or not it did anything. */
function Field({ label, value, y, labelRight, boxX, boxW, h, px }: {
  label: string; value: string; y: number; labelRight: number;
  boxX: number; boxW: number; h: number; px: string;
}) {
  const btn = h - 12;
  return (
    <>
      <SvgText x={labelRight} y={y + h * 0.68} fill="#0a0a0a" fontSize={32}
        fontFamily={px} textAnchor="end">{label}</SvgText>
      <Bevel x={boxX} y={y} w={boxW} h={h} sunken face="#ffffff" e={3} />
      <SvgText x={boxX + 18} y={y + h * 0.70} fill="#0a0a0a" fontSize={34} fontFamily={px}>
        {clip(value, Math.floor((boxW - btn - 42) / 19))}
      </SvgText>
      <Bevel x={boxX + boxW - btn - 6} y={y + 6} w={btn} h={btn} e={3} />
      <Path d={`M${boxX + boxW - btn / 2 - 6 - 10} ${y + h / 2 - 5} l20 0 l-10 12 Z`} fill="#0a0a0a" />
    </>
  );
}

function Y2KStyle(p: StyleProps) {
  const { station, track, modeLabel, cardH } = p;
  const d = derive(p);
  // Every word on this card is set in the Windows-era bitmap face — see
  // utils/pixelFont for why it is DotGothic16 and not a segment font.
  const px = usePixelFont();

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
  const TASK_H = 92, PAD = 30, TITLE_H = 66;
  const ART = 360, TOP_H = 386, FH = 64, FGAP = 12, PROG_H = 60;
  const WX = 74, WW = CARD_W - WX * 2;
  const WH = TITLE_H + PAD + TOP_H + 40 + (FH + FGAP) * 4 + 24 + PROG_H + PAD;
  // CENTRED in the wallpaper above the taskbar, not hung off its bottom edge
  // (owner, 11.08). With the squarer card the two margins come out equal, and
  // a dialog sitting centred is what you actually see on a desktop.
  const WY = Math.max(28, Math.round((cardH - TASK_H - WH) / 2));

  const artX = WX + 52, artY = WY + TITLE_H + PAD;
  const panelX = artX + ART + 46;
  const panelR = WX + WW - 52;

  const fieldsY = artY + TOP_H + 40;
  const labelRight = WX + 262, boxX = WX + 282, boxW = WW - 282 - 52;
  const prog = fieldsY + (FH + FGAP) * 4 + 24;
  // The two seven-segment wells are 168 wide with a 52 margin, so the
  // trough starts clear of them on both sides.
  const barX = WX + 196, barW = WW - 196 - 196;
  // Zero when there is no track, not a decorative 0.42 — the times either side
  // read 0:00 in that case, and a bar sitting 42% along beside them says two
  // different things at once.
  const pct = track?.durationMs ? Math.min(1, (track.progressMs ?? 0) / track.durationMs) : 0;

  const btn = (i: number) => panelX + i * 76;

  return (
    <>
      <Rect x={0} y={0} width={CARD_W} height={cardH} fill={desktop} />

      {/* ── the window ── */}
      <Bevel x={WX} y={WY} w={WW} h={WH} />
      <Rect x={WX + 8} y={WY + 8} width={WW - 16} height={TITLE_H} fill={bar} />
      <SvgText x={WX + 26} y={WY + 8 + TITLE_H * 0.72} fill={barInk} fontSize={38}
        fontFamily={px}>Cruise FM</SvgText>
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
        : (
          /* No cover — companion listeners have no track at all, and a cover
             can be a moment late even when there is one. A flat tinted square
             is the one thing in this well that reads as a bug rather than a
             design, so it falls back to the STATION'S OWN PHOTOGRAPH, which is
             what the card is about anyway. Under a wash, or a bright picture
             fights the grey chrome around it. Custom stations may still have
             no picture, and those keep the tint. */
          <>
            <Rect x={artX} y={artY} width={ART} height={ART} fill={mixHex(d.eq[1], '#20202a', 0.55)} />
            {!!d.backdrop && (
              <>
                <SvgImage x={artX} y={artY} width={ART} height={ART} href={d.backdrop as string}
                  preserveAspectRatio="xMidYMid slice" />
                <Rect x={artX} y={artY} width={ART} height={ART} fill="#0b0b12" opacity={0.22} />
              </>
            )}
          </>
        )}

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
        labelRight={labelRight} boxX={boxX} boxW={boxW} h={FH} px={px} />
      <Field label="Title:"   value={d.title} y={fieldsY + (FH + FGAP)}
        labelRight={labelRight} boxX={boxX} boxW={boxW} h={FH} px={px} />
      <Field label="Station:" value={station.name} y={fieldsY + (FH + FGAP) * 2}
        labelRight={labelRight} boxX={boxX} boxW={boxW} h={FH} px={px} />
      <Field label="Mode:"    value={modeLabel} y={fieldsY + (FH + FGAP) * 3}
        labelRight={labelRight} boxX={boxX} boxW={boxW} h={FH} px={px} />

      {/* ── scrub. Times sit straight on the grey, as they do on the owner's
             own reference; the sunken LCD wells belonged to the segment-font
             round and went with it. ── */}
      <SvgText x={WX + 46} y={prog + 42} fill="#0a0a0a" fontSize={34} fontFamily={px}>
        {track?.progressMs != null ? mmss(track.progressMs) : '0:00'}
      </SvgText>
      <Bevel x={barX} y={prog + 12} w={barW} h={42} sunken face="#a9adb3" e={3} />
      <Rect x={barX + 8} y={prog + 19} width={Math.max(0, (barW - 16) * pct)} height={28} fill="#6f757c" />
      <Bevel x={barX + (barW - 32) * pct} y={prog + 2} w={32} h={62} e={3} />
      <SvgText x={WX + WW - 46} y={prog + 42} fill="#0a0a0a" fontSize={34}
        fontFamily={px} textAnchor="end">
        {track?.durationMs ? mmss(track.durationMs) : '0:00'}
      </SvgText>

      {/* ── taskbar: the natural home for the address ── */}
      <Bevel x={0} y={cardH - TASK_H} w={CARD_W} h={TASK_H} e={4} />
      <Bevel x={16} y={cardH - TASK_H + 16} w={196} h={TASK_H - 32} e={3} />
      <Circle cx={62} cy={cardH - TASK_H / 2} r={17} fill={bar} stroke="#6c7078" strokeWidth={3} />
      <SvgText x={92} y={cardH - TASK_H / 2 + 12} fill="#0a0a0a" fontSize={34}
        fontFamily={px}>Start</SvgText>
      <Bevel x={CARD_W - 442} y={cardH - TASK_H + 16} w={426} h={TASK_H - 32} sunken e={3} />
      <SvgText x={CARD_W - 229} y={cardH - TASK_H / 2 + 12} fill="#0a0a0a" fontSize={30}
        fontFamily={px} textAnchor="middle">{INSTALL_HOST}</SvgText>
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
    case 'y2k':
    default: return <Y2KStyle {...rest} />;
  }
}
