import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, Share, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, {
  Defs, Image as SvgImage, LinearGradient as SvgLinearGradient, Path,
  RadialGradient, Rect, Stop, Text as SvgText,
} from 'react-native-svg';

import type { Station } from '@/constants/stations';
import { stationFrequency } from '@/constants/stations';
import {
  CARD_H, CARD_RATIO, CARD_W, ModeHero, glowCol, mixHex, type Eq,
} from '@/components/ShareModeArt';
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
// small for the on-screen preview, full for the capture. The geometry
// constants live in ShareModeArt so the hero can be written against them.
export { CARD_W, CARD_H, CARD_RATIO };

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
  const eq = (station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as Eq;
  // Mixed well down toward black. A pale station (Mountain Pass's eqColors
  // are literally three whites) otherwise produces a light grey card that
  // white text can't sit on — so the wash is the station's colour, deepened.
  const wash = glowCol(eq);
  const deep = mixHex(eq[2], '#07070f', 0.84);
  const mid = mixHex(wash, '#0b0c16', 0.70);

  const title = track?.title ?? station.tagline;
  const artist = track?.artist ?? '';
  const art = track?.albumArt ?? null;
  // Prefer the pre-blurred copy, exactly as StationBackdrop does in the modes.
  const st = station as Station;
  const backdrop = st.imageBlur ?? st.image ?? null;

  const PAD = 96;

  // The hero owns y 150..890; everything below is type. Sizes chosen so a
  // two-line title plus an artist still clears the "listening on" block.
  const TITLE_SIZE = 66;
  const TITLE_TOP = 962;
  const LINE_STEP = 80;
  const titleLines = wrapLines(title, TITLE_SIZE, CARD_W - PAD * 2, 2);
  const artistY = TITLE_TOP + (titleLines.length - 1) * LINE_STEP + 56;

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
        <RadialGradient id={gid("scGlow")} cx="50%" cy="32%" r="64%">
          <Stop offset="0" stopColor={wash} stopOpacity="0.34" />
          <Stop offset="1" stopColor={wash} stopOpacity="0" />
        </RadialGradient>
        {/* The scrim over the photograph. Same shape as the one every mode
            lays over its own backdrop: clear-ish up top where the object
            sits, deepening toward the type so the words stay readable. */}
        <SvgLinearGradient id={gid("scScrim")} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#03040e" stopOpacity="0.72" />
          <Stop offset="0.34" stopColor="#03040e" stopOpacity="0.60" />
          <Stop offset="0.62" stopColor="#03040e" stopOpacity="0.74" />
          <Stop offset="1" stopColor="#03040e" stopOpacity="0.93" />
        </SvgLinearGradient>
      </Defs>

      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={`url(#${gid("scBg")})`} />
      {/* The station's own photograph, blurred, behind everything — because
          that is what a mode actually looks like on screen: a full-bleed
          station backdrop with the object on top. Without it the card was a
          flat gradient and never read as the app. Custom stations have no
          artwork and simply fall through to the gradient above. */}
      {!!backdrop && (
        <SvgImage x={0} y={0} width={CARD_W} height={CARD_H} href={backdrop}
          preserveAspectRatio="xMidYMid slice" />
      )}
      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={`url(#${gid("scScrim")})`} />
      <Rect x={0} y={0} width={CARD_W} height={CARD_H} fill={`url(#${gid("scGlow")})`} />

      {/* THE MODE. This is the picture — the album art is a part of it, not
          the other way round. See ShareModeArt. */}
      <ModeHero
        modeId={modeId}
        eq={eq}
        art={art}
        uid={uid}
        title={title}
        artist={artist}
        freq={stationFrequency(station.id)}
      />

      {/* Station eyebrow */}
      <SvgText x={PAD} y={100} fill="#ffffff" fillOpacity={0.62} fontSize={30} fontWeight="700" letterSpacing={6}>
        {station.name.toUpperCase()}
      </SvgText>
      <SvgText x={CARD_W - PAD} y={100} fill="#ffffff" fillOpacity={0.42} fontSize={28} fontWeight="700"
        letterSpacing={4} textAnchor="end">
        {modeLabel.toUpperCase()}
      </SvgText>

      {/* Song */}
      {titleLines.map((line, i) => (
        <SvgText key={i} x={PAD} y={TITLE_TOP + i * LINE_STEP} fill="#ffffff"
          fontSize={TITLE_SIZE} fontWeight="800" letterSpacing={-1}>
          {line}
        </SvgText>
      ))}
      {!!artist && (
        <SvgText x={PAD} y={artistY} fill="#ffffff"
          fillOpacity={0.62} fontSize={38} fontWeight="600">
          {artist.length > 38 ? `${artist.slice(0, 37)}…` : artist}
        </SvgText>
      )}

      {/* "<name> is listening on <station>" */}
      <SvgText x={PAD} y={1158} fill="#ffffff" fillOpacity={0.55} fontSize={30} fontWeight="600">
        {listeningLine}
      </SvgText>
      <SvgText x={PAD} y={1204} fill={mixHex(eq[1], '#ffffff', 0.35)} fontSize={38} fontWeight="800">
        {station.name}
      </SvgText>

      {/* Footer: the install prompt, since not everyone has the app */}
      <Rect x={PAD} y={1242} width={CARD_W - PAD * 2} height={2} fill="#ffffff" fillOpacity={0.12} />
      <SvgText x={PAD} y={1306} fill="#ffffff" fontSize={34} fontWeight="800" letterSpacing={3}>
        CRUISE FM
      </SvgText>
      <SvgText x={CARD_W - PAD} y={1306} fill="#ffffff" fillOpacity={0.5} fontSize={30}
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
