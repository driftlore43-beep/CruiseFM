import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import { hasSeenIntro } from '@/utils/intro';
import { markNoteSeen, noteToShow, type ReleaseNote } from '@/utils/whatsNew';

/**
 * WHAT CHANGED IN THE UPDATE THAT JUST LANDED — owner's ask, 01.09.
 *
 * A CARD ON THE HOME PAGE, NOT A SHEET OVER IT, and the difference is the
 * whole design. The welcome explainer earns a full-screen takeover because it
 * is the premise of the app and nothing works until you have it. "The green is
 * brighter" does not; interrupting a drive-in-progress to say so would make
 * the next takeover easier to ignore. So this waits on the home page to be
 * looked at, the same weight as the rate card and the update card beside it.
 *
 * It also sidesteps the trap for free: the welcome explainer and the platform
 * sheet are both Modals, and iOS will not reliably stack a third over them —
 * it presents nothing and swallows every touch (24.07, 03.08). A card in the
 * page cannot collide with either, whatever order they resolve in.
 *
 * SEEING IT COUNTS AS READING IT. `markNoteSeen` fires when it APPEARS, not
 * when it is dismissed — the rule RateCard and the welcome explainer both use.
 * Somebody who scrolls past has had their turn; a card that keeps returning
 * until it is answered correctly is a nag, and the ✕ is there for tidiness
 * rather than for consent.
 */
export function WhatsNewCard() {
  const wn = useStyles(make_wn);
  const pal = usePalette();
  const [note, setNote] = useState<ReleaseNote | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const introSeen = await hasSeenIntro();
        const n = await noteToShow(introSeen);
        if (!active || !n) return;
        setNote(n);
        // Shown is told. See the rule above.
        markNoteSeen(n.id).catch(() => {});
      })();
      return () => { active = false; };
    }, []),
  );

  if (!note) return null;

  return (
    <View style={wn.card}>
      <View style={wn.iconRing}>
        <Ionicons name="sparkles" size={18} color={pal.ink(0.82)} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={wn.eyebrow}>WHAT&apos;S NEW</Text>
        <Text style={wn.title}>{note.title}</Text>
        <Text style={wn.sub}>{note.body}</Text>
      </View>
      <Pressable onPress={() => setNote(null)} hitSlop={12} style={wn.close}>
        <Ionicons name="close" size={16} color={pal.ink(0.55)} />
      </Pressable>
    </View>
  );
}

// Deliberately the app's own neutral glass rather than the update card's
// amber. Amber on this page means "there is something you need to do"; this
// is news, not an errand, and two amber cards stacked would flatten that
// distinction to nothing.
const make_wn = (p: Palette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: p.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
    borderWidth: 1,
    borderColor: p.ink(0.12),
  },
  iconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: p.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    borderWidth: 1, borderColor: p.ink(0.14),
  },
  eyebrow: {
    color: p.ink(0.5), fontSize: 9.5, fontWeight: '700', letterSpacing: 2,
  },
  title: { color: p.text, fontSize: 14.5, fontWeight: '800', marginTop: 3 },
  sub: { color: p.ink(0.66), fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  close: { alignSelf: 'flex-start', padding: 2 },
});
