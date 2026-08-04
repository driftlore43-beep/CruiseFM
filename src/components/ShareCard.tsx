import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, Share, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg from 'react-native-svg';

import type { Station } from '@/constants/stations';
import { CARD_H, CARD_RATIO, CARD_W } from '@/components/ShareModeArt';
import {
  DEFAULT_SHARE_STYLE, FORMAT_H, SHARE_STYLES, ShareCardBody,
  type ShareFormat, type ShareStyleId,
} from '@/components/ShareCardStyles';
import { useSheetOpen } from '@/context/NowPlayingContext';
import { getProfileName } from '@/utils/spotify';
import type { NowPlaying } from '@/utils/useMusicPlayback';

/** Where a recipient without the app is sent. */
const INSTALL_URL = 'https://cruisefm.app';

/**
 * The shareable card — a now-playing pin, in whichever of the three design
 * styles the user picks (see ShareCardStyles).
 *
 * Drawn entirely in react-native-svg on purpose. Turning a normal View into an
 * image needs react-native-view-shot, which is a NATIVE module: adding it
 * changes the runtime fingerprint and every existing build stops receiving OTA
 * updates until a new binary ships. react-native-svg is already in the build
 * and its <Svg> exposes toDataURL(), so the whole feature stays shippable over
 * the air. Everything drawn must therefore be SVG primitives — no Views, no
 * LinearGradient from expo-linear-gradient, no MarqueeText.
 */

// Cards are authored at a fixed 1080 wide and scaled by the Svg's width/height.
// One geometry, two sizes: small for the on-screen preview, full for the
// capture. Height depends on the chosen format — 1350 (4:5) for messaging,
// 1620 (2:3) for a Pinterest pin. The geometry constants live in ShareModeArt
// so the hero can be written against them.
export { CARD_W, CARD_H, CARD_RATIO };

/** The card at a given width, ready to drop into a layout. */
export function ShareCard(props: {
  width: number; station: Station; track: NowPlaying | null; modeLabel: string; modeId: string;
  userName: string | null; styleId: ShareStyleId; format: ShareFormat; uid?: string;
  snapshotUri?: string | null;
}) {
  const { width, format, uid = 'p', ...body } = props;
  const cardH = FORMAT_H[format];
  return (
    <Svg width={width} height={(width * cardH) / CARD_W} viewBox={`0 0 ${CARD_W} ${cardH}`}>
      <ShareCardBody {...body} cardH={cardH} uid={uid} />
    </Svg>
  );
}

// ── The share sheet ──────────────────────────────────────────────────────────

/**
 * Preview the card, pick a look, then hand it to the OS share sheet as a real
 * PNG.
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
  visible, onClose, station, track, modeLabel, modeId, snapshotUri = null,
}: {
  visible: boolean;
  onClose: () => void;
  station: Station;
  track: NowPlaying | null;
  modeLabel: string;
  modeId: string;
  /** A real screenshot of the mode, captured the moment the share pill was
   *  tapped (see ModeActionRow). Null when capture isn't possible — the sheet
   *  then behaves exactly as it did before snapshots existed. */
  snapshotUri?: string | null;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [userName, setUserName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [styleId, setStyleId] = useState<ShareStyleId>(DEFAULT_SHARE_STYLE);
  const [format, setFormat] = useState<ShareFormat>('card');
  const capRef = useRef<Svg>(null);
  // Declare ourselves so auto-dim doesn't try to be a third modal window over
  // the mode and this sheet — see useSheetOpen.
  useSheetOpen(visible);

  useEffect(() => {
    if (!visible) return;
    getProfileName().then(setUserName).catch(() => {});
    // The real screenshot is the point of the feature, so it leads whenever
    // one exists; without one the chip is hidden and the old default stands.
    setStyleId(snapshotUri ? 'snapshot' : DEFAULT_SHARE_STYLE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cardH = FORMAT_H[format];
  // The preview is sized off the SHORTER of the two limits so a 2:3 pin and a
  // 4:5 card both clear the chips and buttons on a small phone — otherwise
  // switching format pushes the actions off the bottom of the screen.
  const previewW = Math.min(winW * 0.7, 300, ((winH - 330) * CARD_W) / cardH);
  const isPin = format === 'pin';

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
      const path = `${FileSystem.cacheDirectory}cruise-fm-${styleId}-${format}.png`;
      await FileSystem.writeAsStringAsync(path, clean, { encoding: FileSystem.EncodingType.Base64 });
      if (Platform.OS === 'ios') {
        await Share.share({ url: path, message: text });
      } else if (await Sharing.isAvailableAsync()) {
        // React Native's own Share cannot attach a file on Android — it needs
        // a content:// provider — which is why Android sent text only until
        // expo-sharing landed in the 1.1.0 build. The text form stays as the
        // fallback below for anything older or without a share target.
        await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: text });
      } else {
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
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={sc.backdrop} onPress={onClose}>
        {/* Stop taps on the card itself from dismissing */}
        <Pressable style={sc.body} onPress={() => {}}>
          <ShareCard width={previewW} station={station} track={track} modeLabel={modeLabel}
            modeId={modeId} userName={userName} styleId={styleId} format={format}
            snapshotUri={snapshotUri} />

          {/* Design styles. The row must be given a real width — inside a
              centred column with no width of its own it sizes to its CONTENT,
              which pushed the chips off both edges of the screen. It still
              scrolls if a longer set is ever added. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={sc.chips} style={[sc.chipRow, { width: winW - 32 }]}>
            {SHARE_STYLES.filter((s) => s.id !== 'snapshot' || !!snapshotUri).map((s) => {
              const on = s.id === styleId;
              return (
                <TouchableOpacity key={s.id} onPress={() => setStyleId(s.id)} activeOpacity={0.85}
                  style={[sc.chip, on && sc.chipOn]}
                  accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[sc.chipText, on && sc.chipTextOn]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Shape */}
          <View style={sc.formats}>
            {(['card', 'pin'] as ShareFormat[]).map((f) => {
              const on = f === format;
              return (
                <TouchableOpacity key={f} onPress={() => setFormat(f)} activeOpacity={0.85}
                  style={[sc.fmt, on && sc.fmtOn]}
                  accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Ionicons name={f === 'pin' ? 'bookmark-outline' : 'chatbubble-outline'} size={14}
                    color={on ? '#0a0a12' : 'rgba(255,255,255,0.7)'} />
                  <Text style={[sc.fmtText, on && sc.fmtTextOn]}>
                    {f === 'pin' ? 'Pin 2:3' : 'Card 4:5'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isPin && (
            <Text style={sc.hint}>
              {Platform.OS === 'ios'
                ? 'Pinterest’s shape. Tap Share card, then Save Image to pin it.'
                : 'Pinterest’s shape. Saving the image needs the next app update.'}
            </Text>
          )}

          <View style={sc.actions}>
            <TouchableOpacity style={[sc.btn, sc.btnPrimary]} onPress={shareCard} activeOpacity={0.85} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#0a0a12" />
                : <>
                    <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={17} color="#0a0a12" />
                    <Text style={sc.btnPrimaryText}>{isPin ? 'Share pin' : 'Share card'}</Text>
                  </>}
            </TouchableOpacity>
            <TouchableOpacity style={sc.btn} onPress={shareLink} activeOpacity={0.85}>
              <Ionicons name="link-outline" size={17} color="#fff" />
              <Text style={sc.btnText}>Share as text</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ paddingVertical: 8 }}>
            <Text style={sc.cancel}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>

      {/* Full-resolution capture copy, parked off-screen. */}
      <View style={[sc.offscreen, { height: cardH }]} pointerEvents="none">
        <Svg ref={capRef} width={CARD_W} height={cardH} viewBox={`0 0 ${CARD_W} ${cardH}`}>
          <ShareCardBody station={station} track={track} modeLabel={modeLabel} modeId={modeId}
            userName={userName} styleId={styleId} cardH={cardH} uid="c"
            snapshotUri={snapshotUri} />
        </Svg>
      </View>
    </Modal>
  );
}

const sc = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,4,10,0.86)', alignItems: 'center', justifyContent: 'center' },
  body: { alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  chipRow: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  chipOn: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  chipText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: '#0a0a12' },
  formats: { flexDirection: 'row', gap: 8 },
  fmt: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  fmtOn: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  fmtText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },
  fmtTextOn: { color: '#0a0a12' },
  hint: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', textAlign: 'center' },
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
  offscreen: { position: 'absolute', left: -CARD_W * 2, top: 0, width: CARD_W, opacity: 0 },
});
