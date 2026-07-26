import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, Share, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, {
  Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage,
  LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText,
} from 'react-native-svg';

import type { Station } from '@/constants/stations';
import { getProfileName } from '@/utils/spotify';
import type { NowPlaying } from '@/utils/useSpotifyPlayback';

/** Where a recipient without the app is sent. */
const INSTALL_URL = 'https://cruisefm.app';

/**
 * The shareable card — a Spotify-style "now playing" pin.
 *
 * Drawn entirely in react-native-svg on purpose. Turning a normal View into an
 * image needs react-native-view-shot, which is a NATIVE module: adding it
 * changes the runtime fingerprint and every existing build stops receiving OTA
 * updates until a new binary ships. react-native-svg is already in the build
 * and its <Svg> exposes toDataURL(), so the whole feature stays shippable over
 * the air. Everything here must therefore be SVG primitives — no Views, no
 * LinearGradient from expo-linear-gradient, no MarqueeText.
 */

// Card is authored at a fixed 1080×1350 (a 4:5 portrait pin — tall enough to
// read as a card, short enough that iMessage and WhatsApp show it without
// cropping) and scaled by the Svg's width/height. One geometry, two sizes:
// small for the on-screen preview, full for the capture.
export const CARD_W = 1080;
export const CARD_H = 1350;
export const CARD_RATIO = CARD_H / CARD_W;

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/** SVG <Text> does not wrap, so lines are worked out here. `perChar` is the
 *  average glyph width as a fraction of font size — 0.52 is about right for a
 *  bold sans face and errs on the safe side, since overflowing the card looks
 *  far worse than breaking a line early. */
function wrapLines(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
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


/**
 * The mode's own artwork, filling the card behind the cover.
 *
 * This is what stops the card being a Spotify clone with different colours:
 * a drive in Mirror Ball should not look like a drive in Cassette. Every
 * shape is drawn in the STATION's colours, so mode and mood both show — the
 * mode gives the composition, the station gives the palette.
 *
 * Deliberately simple geometry. It sits behind the album art and the type, so
 * anything fussy just makes the words harder to read.
 */
function ModeArt({ modeId, eq, cx, cy, uid }: {
  modeId: string; eq: [string, string, string]; cx: number; cy: number; uid: string;
}) {
  const a = eq[0], b = eq[1], c = eq[2];
  const ring = (r: number, w: number, col: string, op: number, key: string) => (
    <Circle key={key} cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeOpacity={op} strokeWidth={w} />
  );

  switch (modeId) {
    // Discs — concentric grooves centred on the cover, so the artwork reads
    // as the label of the record you're playing.
    case 'cd':
    case 'vinyl': {
      const rings = [];
      for (let i = 0; i < 22; i++) {
        const r = 360 + i * 26;
        rings.push(ring(r, i % 4 === 0 ? 3 : 1.4, i % 2 ? a : b, 0.30 - i * 0.010, `g${i}`));
      }
      return <>{rings}</>;
    }

    // A mirror ball: latitude rings plus meridians, with light scattered round it.
    case 'disco': {
      const R = 470;
      const out = [];
      for (let i = 1; i < 7; i++) {
        const y = cy - R + (i * 2 * R) / 7;
        const rr = Math.sqrt(Math.max(1, R * R - (y - cy) * (y - cy)));
        out.push(<Ellipse key={`la${i}`} cx={cx} cy={y} rx={rr} ry={rr * 0.16} fill="none" stroke={b} strokeOpacity={0.20} strokeWidth={2} />);
      }
      for (let i = 0; i < 7; i++) {
        const k = (i / 6) * 2 - 1;
        out.push(<Ellipse key={`me${i}`} cx={cx} cy={cy} rx={Math.abs(k) * R} ry={R} fill="none" stroke={a} strokeOpacity={0.16} strokeWidth={2} />);
      }
      out.push(<Circle key="rim" cx={cx} cy={cy} r={R} fill="none" stroke={c} strokeOpacity={0.26} strokeWidth={3} />);
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + 0.3;
        const rr = R * (1.16 + (i % 3) * 0.12);
        out.push(<Circle key={`sp${i}`} cx={cx + Math.cos(ang) * rr} cy={cy + Math.sin(ang) * rr * 0.9} r={i % 3 ? 5 : 9} fill={a} fillOpacity={0.42} />);
      }
      return <>{out}</>;
    }

    // Two reels and the tape running between them.
    case 'cassette': {
      // Wider than the cover and pushed low, or the reels sit entirely behind
      // the artwork and the card just looks like a plain gradient.
      const y = cy + 210;
      const rx = 372;
      return (
        <>
          <Rect x={cx - 516} y={y - 250} width={1032} height={500} rx={44} fill="none" stroke={b} strokeOpacity={0.26} strokeWidth={3} />
          {[cx - rx, cx + rx].map((x, i) => (
            <G key={i}>
              <Circle cx={x} cy={y} r={172} fill="none" stroke={a} strokeOpacity={0.34} strokeWidth={3} />
              <Circle cx={x} cy={y} r={66} fill="none" stroke={a} strokeOpacity={0.44} strokeWidth={3} />
              {[0, 1, 2].map((k) => (
                <Path key={k} d={`M ${x} ${y} L ${x + Math.cos((k / 3) * Math.PI * 2 + i) * 172} ${y + Math.sin((k / 3) * Math.PI * 2 + i) * 172}`}
                  stroke={a} strokeOpacity={0.22} strokeWidth={3} />
              ))}
            </G>
          ))}
          <Path d={`M ${cx - rx} ${y + 172} L ${cx + rx} ${y + 172}`} stroke={c} strokeOpacity={0.38} strokeWidth={5} />
        </>
      );
    }

    // A meter across the card — the mode is literally bars, so the artwork is too.
    case 'equalizer': {
      const bars = [];
      const n = 26, w = CARD_W / n;
      for (let i = 0; i < n; i++) {
        const t = (i - (n - 1) / 2) / (n / 4);
        const h = 120 + Math.exp(-0.5 * t * t) * 620 * (0.45 + ((i * 37) % 100) / 100 * 0.55);
        bars.push(<Rect key={i} x={i * w + w * 0.16} y={CARD_H - h} width={w * 0.68} height={h}
          fill={i % 3 === 0 ? a : i % 3 === 1 ? b : c} fillOpacity={0.15} rx={6} />);
      }
      return <>{bars}</>;
    }

    // Concentric rings pulsing out from the centre.
    case 'orb': {
      const out = [];
      for (let i = 0; i < 9; i++) out.push(ring(300 + i * 78, 3, i % 2 ? a : b, 0.26 - i * 0.022, `o${i}`));
      return <>{out}</>;
    }

    // A dial: ticks along a band, like the tuner's own ruler.
    case 'radio': {
      const out = [];
      const y = cy + 300;
      for (let i = 0; i < 44; i++) {
        const x = (i / 43) * CARD_W;
        const tall = i % 5 === 0;
        out.push(<Rect key={i} x={x - 2} y={y - (tall ? 54 : 26)} width={4} height={tall ? 54 : 26} fill={b} fillOpacity={tall ? 0.34 : 0.18} />);
      }
      out.push(<Rect key="base" x={0} y={y} width={CARD_W} height={3} fill={a} fillOpacity={0.26} />);
      out.push(<Rect key="ndl" x={cx - 3} y={y - 130} width={6} height={190} fill={c} fillOpacity={0.55} rx={3} />);
      return <>{out}</>;
    }

    // Sun on a receding grid.
    case 'horizon': {
      const out = [];
      const hy = cy + 250;
      out.push(<Circle key="sun" cx={cx} cy={hy - 40} r={330} fill="none" stroke={a} strokeOpacity={0.24} strokeWidth={3} />);
      for (let i = 0; i < 7; i++) {
        out.push(<Rect key={`s${i}`} x={cx - 330} y={hy - 200 + i * 46} width={660} height={12} fill={b} fillOpacity={0.14} />);
      }
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        out.push(<Path key={`p${i}`} d={`M ${cx - 700 + t * 1400} ${CARD_H} L ${cx - 180 + t * 360} ${hy}`}
          stroke={c} strokeOpacity={0.16} strokeWidth={3} />);
      }
      out.push(<Rect key="hz" x={0} y={hy} width={CARD_W} height={3} fill={a} fillOpacity={0.3} />);
      return <>{out}</>;
    }

    default:
      return null;
  }
}

/** The card's contents, with no <Svg> wrapper — so the same geometry can be
 *  mounted both in the on-screen preview and in the full-size capture copy.
 *  `uid` namespaces the gradient ids: two Svg roots carrying identical ids at
 *  the same time is a known way to get one of them rendering blank. */
export function ShareCardBody({
  station, track, modeLabel, modeId, userName, uid = 'p',
}: {
  station: Station;
  track: NowPlaying | null;
  modeLabel: string;
  modeId: string;
  userName: string | null;
  uid?: string;
}) {
  const eq = (station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as [string, string, string];
  // Mixed well down toward black. A pale station (Mountain Pass is pure
  // white) otherwise produces a light grey card that white text can't sit on.
  const deep = mixHex(eq[2], '#07070f', 0.82);
  const mid = mixHex(eq[1], '#0b0c16', 0.68);

  const title = track?.title ?? station.tagline;
  const artist = track?.artist ?? '';
  const art = track?.albumArt ?? null;

  const PAD = 96;
  const ART = 620;
  const artX = (CARD_W - ART) / 2;
  const artY = 168;

  const titleSize = 74;
  const titleLines = wrapLines(title, titleSize, CARD_W - PAD * 2, 2);
  const titleTop = artY + ART + 118;

  const listeningLine = userName ? `${userName} is listening on` : 'Now playing on';

  const gid = (n: string) => `${n}${uid}`;

  return (
    <>
      <Defs>
        <SvgLinearGradient id={gid("scBg")} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={mid} />
          <Stop offset="0.55" stopColor={deep} />
          <Stop offset="1" stopColor="#06060d" />
        </SvgLinearGradient>
        <RadialGradient id={gid("scGlow")} cx="50%" cy="34%" r="62%">
          <Stop offset="0" stopColor={eq[1]} stopOpacity="0.42" />
          <Stop offset="1" stopColor={eq[1]} stopOpacity="0" />
        </RadialGradient>
        <ClipPath id={gid("scArt")}>
          <Rect x={artX} y={artY} width={ART} height={ART} rx={34} ry={34} />
        </ClipPath>
      </Defs>

      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={`url(#${gid("scBg")})`} />
      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={`url(#${gid("scGlow")})`} />

      {/* The mode's own artwork, behind everything else */}
      <ModeArt modeId={modeId} eq={eq} cx={CARD_W / 2} cy={artY + ART / 2} uid={uid} />

      {/* Station eyebrow */}
      <SvgText x={PAD} y={104} fill="#ffffff" fillOpacity={0.62} fontSize={30} fontWeight="700" letterSpacing={6}>
        {station.name.toUpperCase()}
      </SvgText>
      <SvgText x={CARD_W - PAD} y={104} fill="#ffffff" fillOpacity={0.42} fontSize={28} fontWeight="700"
        letterSpacing={4} textAnchor="end">
        {modeLabel.toUpperCase()}
      </SvgText>

      {/* Album art, or the station's own colours when there's no cover */}
      <G clipPath={`url(#${gid("scArt")})`}>
        <Rect x={artX} y={artY} width={ART} height={ART} fill={mixHex(eq[1], '#101322', 0.45)} />
        {!!art && <SvgImage x={artX} y={artY} width={ART} height={ART} href={{ uri: art }} preserveAspectRatio="xMidYMid slice" />}
        {!art && (
          <SvgText x={CARD_W / 2} y={artY + ART / 2 + 26} fill="#ffffff" fillOpacity={0.30}
            fontSize={78} fontWeight="800" textAnchor="middle" letterSpacing={8}>
            CRUISE
          </SvgText>
        )}
      </G>
      <Rect x={artX} y={artY} width={ART} height={ART} rx={34} ry={34}
        fill="none" stroke="#ffffff" strokeOpacity={0.16} strokeWidth={2} />

      {/* Song */}
      {titleLines.map((line, i) => (
        <SvgText key={i} x={PAD} y={titleTop + i * (titleSize + 14)} fill="#ffffff"
          fontSize={titleSize} fontWeight="800" letterSpacing={-1}>
          {line}
        </SvgText>
      ))}
      {!!artist && (
        <SvgText x={PAD} y={titleTop + titleLines.length * (titleSize + 14) + 12} fill="#ffffff"
          fillOpacity={0.62} fontSize={42} fontWeight="600">
          {artist.length > 34 ? `${artist.slice(0, 33)}…` : artist}
        </SvgText>
      )}

      {/* "<name> is listening on <station>" */}
      <SvgText x={PAD} y={CARD_H - 196} fill="#ffffff" fillOpacity={0.55} fontSize={32} fontWeight="600">
        {listeningLine}
      </SvgText>
      <SvgText x={PAD} y={CARD_H - 148} fill={mixHex(eq[1], '#ffffff', 0.35)} fontSize={40} fontWeight="800">
        {station.name}
      </SvgText>

      {/* Footer: the install prompt, since not everyone has the app */}
      <Rect x={PAD} y={CARD_H - 104} width={CARD_W - PAD * 2} height={2} fill="#ffffff" fillOpacity={0.12} />
      <SvgText x={PAD} y={CARD_H - 44} fill="#ffffff" fontSize={34} fontWeight="800" letterSpacing={3}>
        CRUISE FM
      </SvgText>
      <SvgText x={CARD_W - PAD} y={CARD_H - 44} fill="#ffffff" fillOpacity={0.5} fontSize={30}
        fontWeight="600" textAnchor="end">
        cruisefm.app
      </SvgText>
      {/* A small mark so the footer isn't only type */}
      <Path
        d={`M ${CARD_W - PAD - 250} ${CARD_H - 56} a 15 15 0 1 0 0.1 0 Z`}
        fill={eq[1]} fillOpacity={0.85}
      />
    </>
  );
}

/** The card at a given width, ready to drop into a layout. */
export function ShareCard(props: {
  width: number; station: Station; track: NowPlaying | null; modeLabel: string; modeId: string; userName: string | null;
}) {
  const { width, ...body } = props;
  return (
    <Svg width={width} height={width * CARD_RATIO} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
      <ShareCardBody {...body} uid="p" />
    </Svg>
  );
}

// ── The share sheet ──────────────────────────────────────────────────────────

/**
 * Preview the card, then hand it to the OS share sheet as a real PNG.
 *
 * The capture copy is rendered at full resolution OFF-SCREEN rather than by
 * scaling the preview: toDataURL rasterises the view at its own size, so a
 * scaled-down preview would export a small, soft image. Two instances of the
 * same static SVG is the cheap, predictable way to get both.
 *
 * Showing the preview first also does real work — it gives the album artwork
 * time to load over the network. Capturing straight from a tap would often
 * export a card with an empty cover.
 */
export function ShareCardSheet({
  visible, onClose, station, track, modeLabel, modeId,
}: {
  visible: boolean;
  onClose: () => void;
  station: Station;
  track: NowPlaying | null;
  modeLabel: string;
  modeId: string;
}) {
  const { width: winW } = useWindowDimensions();
  const [userName, setUserName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const capRef = useRef<Svg>(null);

  useEffect(() => {
    if (!visible) return;
    getProfileName().then(setUserName).catch(() => {});
  }, [visible]);

  const previewW = Math.min(winW * 0.72, 320);
  const line = track?.artist ? `${track.title} — ${track.artist}` : (track?.title ?? station.tagline);
  const who = userName ? `${userName} is listening on ${station.name}` : `Now playing on ${station.name}`;
  const text = `${line}\n${who} · Cruise FM\n${INSTALL_URL}`;

  async function shareCard() {
    if (busy) return;
    setBusy(true);
    try {
      const node = capRef.current as unknown as { toDataURL?: (cb: (d: string) => void) => void } | null;
      if (!node?.toDataURL) throw new Error('capture unavailable');
      const base64 = await new Promise<string>((resolve, reject) => {
        // Never let a silent native failure leave the button spinning forever.
        const timer = setTimeout(() => reject(new Error('capture timed out')), 4000);
        node.toDataURL!((d) => { clearTimeout(timer); resolve(d); });
      });
      const clean = base64.replace(/^data:image\/\w+;base64,/, '');
      const path = `${FileSystem.cacheDirectory}cruise-fm-now-playing.png`;
      await FileSystem.writeAsStringAsync(path, clean, { encoding: FileSystem.EncodingType.Base64 });
      if (Platform.OS === 'ios') {
        await Share.share({ url: path, message: text });
      } else {
        // React Native's Share can't attach a file on Android (it needs a
        // content:// provider), so Android shares the text form.
        await Share.share({ message: text });
      }
      onClose();
    } catch {
      // Anything went wrong — still let them share, just as text.
      try { await Share.share({ message: text }); onClose(); } catch { /* cancelled */ }
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    try { await Share.share({ message: text }); onClose(); } catch { /* cancelled */ }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={sc.backdrop} onPress={onClose}>
        {/* Stop taps on the card itself from dismissing */}
        <Pressable style={sc.body} onPress={() => {}}>
          <ShareCard width={previewW} station={station} track={track} modeLabel={modeLabel} modeId={modeId} userName={userName} />

          <View style={sc.actions}>
            <TouchableOpacity style={[sc.btn, sc.btnPrimary]} onPress={shareCard} activeOpacity={0.85} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#0a0a12" />
                : <>
                    <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={17} color="#0a0a12" />
                    <Text style={sc.btnPrimaryText}>Share card</Text>
                  </>}
            </TouchableOpacity>
            <TouchableOpacity style={sc.btn} onPress={shareLink} activeOpacity={0.85}>
              <Ionicons name="link-outline" size={17} color="#fff" />
              <Text style={sc.btnText}>Share as text</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ paddingVertical: 10 }}>
            <Text style={sc.cancel}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>

      {/* Full-resolution capture copy, parked off-screen. */}
      <View style={sc.offscreen} pointerEvents="none">
        <Svg ref={capRef} width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
          <ShareCardBody station={station} track={track} modeLabel={modeLabel} modeId={modeId} userName={userName} uid="c" />
        </Svg>
      </View>
    </Modal>
  );
}

const sc = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,4,10,0.86)', alignItems: 'center', justifyContent: 'center' },
  body: { alignItems: 'center', gap: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 13, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  btnPrimary: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  btnPrimaryText: { color: '#0a0a12', fontSize: 14, fontWeight: '800' },
  btnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  cancel: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' },
  // Off-screen, not display:none — a hidden view may not rasterise.
  offscreen: { position: 'absolute', left: -CARD_W * 2, top: 0, width: CARD_W, height: CARD_H, opacity: 0 },
});
