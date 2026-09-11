import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useNowPlaying } from '@/context/NowPlayingContext';
import {
  markPromptDismissed, requestPermission, shouldOfferPrompt,
} from '@/utils/notifications';

/**
 * The honest ask, shown once, after the third drive.
 *
 * iOS allows exactly ONE system permission prompt per app — and a "no" is
 * close to permanent, since undoing it means finding the app in Settings.
 * So this card goes first and does the real work: it says precisely what
 * will be sent, how often, and that the app backs off if the notifications
 * go unused. The system prompt only appears if they say yes here, which
 * means the expensive one-shot is never spent on someone who was going to
 * decline.
 *
 * It never appears mid-drive, and never over an open sheet.
 */
export function NotifyPrompt() {
  const np = useNowPlaying();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only when the app is quiet: no drive running, nothing else on screen.
    if (np.session || np.sheetCount > 0) return;
    let live = true;
    const t = setTimeout(() => {
      shouldOfferPrompt().then((should) => { if (live && should) setOpen(true); }).catch(() => {});
    }, 1500);
    return () => { live = false; clearTimeout(t); };
  }, [np.session, np.sheetCount]);

  if (!open) return null;

  const yes = async () => { setOpen(false); await requestPermission(); };
  const no = async () => { setOpen(false); await markPromptDismissed(); };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']} onRequestClose={no}>
      <View style={np2.scrim}>
        <View style={np2.card}>
          <View style={np2.iconRing}>
            <MaterialCommunityIcons name="radio-tower" size={26} color="#ffffff" />
          </View>
          <Text style={np2.title}>Want a nudge when a station comes on air?</Text>
          <Text style={np2.sub}>
            A couple a week at most — Sunset AM as you finish work, Daylight AM on a
            Saturday morning. One tap starts the drive.
          </Text>
          <Text style={np2.fine}>
            If you don&apos;t use them, Cruise FM sends fewer, then stops. Nothing is ever
            sent to sell you anything.
          </Text>
          <TouchableOpacity onPress={yes} activeOpacity={0.85} style={np2.cta}>
            <Text style={np2.ctaText}>Yes, nudge me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={no} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <Text style={np2.later}>No thanks</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const np2 = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(4,4,10,0.86)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 360, borderRadius: 24, overflow: 'hidden',
    alignItems: 'center', paddingHorizontal: 24, paddingVertical: 30, gap: 12,
    backgroundColor: '#0a0a10', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  iconRing: {
    width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 2,
  },
  title: { color: '#fff', fontSize: 21, fontWeight: '800', letterSpacing: 0, textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  fine: { color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  cta: {
    alignSelf: 'stretch', borderRadius: 26, alignItems: 'center',
    paddingVertical: 15, marginTop: 10, backgroundColor: '#ffffff',
  },
  ctaText: { color: '#0a0a12', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  later: { color: 'rgba(255,255,255,0.5)', fontSize: 13.5, fontWeight: '600', paddingTop: 8 },
});
