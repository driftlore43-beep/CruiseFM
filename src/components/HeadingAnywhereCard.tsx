import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Cruise } from '@/constants/theme';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import { loadSessionKind, setSessionKind, type SessionKind } from '@/utils/sessionKind';

/**
 * "Heading anywhere?" — asked once, and only once.
 *
 * The owner's own wording (13.08), and it is the right shape: a plain question
 * with two plain answers, rather than a setting nobody would find. It appears
 * on the home page the first time, and never again — after that the switch
 * beside the hero does the job, because a fork in front of every session would
 * tax the one-tap start for the sake of bookkeeping.
 *
 * Nothing is gated on the answer. It decides what the app COUNTS and what it
 * CALLS things, and that is all: every station, every mode and every control
 * behaves identically either way.
 */
export function HeadingAnywhereCard({ onAnswered }: { onAnswered: (kind: SessionKind) => void }) {
  const ha = useStyles(makeHa);
  const pal = usePalette();
  const [show, setShow] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      // null means never asked. An existing driver has an answer already —
      // see the migration note in cruise.tsx.
      loadSessionKind().then((k) => { if (live) setShow(k === null); }).catch(() => {});
      return () => { live = false; };
    }, []),
  );

  if (!show) return null;

  const answer = async (kind: SessionKind) => {
    setShow(false);
    await setSessionKind(kind);
    onAnswered(kind);
  };

  return (
    <View style={ha.card}>
      <View style={ha.head}>
        <View style={ha.iconRing}>
          <MaterialCommunityIcons name="steering" size={20} color={pal.amber} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ha.title}>Heading anywhere?</Text>
          <Text style={ha.sub}>
            Only so the app counts things properly and calls them by the right
            name. Everything else works the same either way.
          </Text>
        </View>
      </View>
      <View style={ha.row}>
        <Pressable style={ha.ghost} onPress={() => answer('listening')}>
          <Text style={ha.ghostText}>Nah, just listening</Text>
        </Pressable>
        <Pressable style={ha.primary} onPress={() => answer('driving')}>
          <Text style={ha.primaryText}>Yeah, driving</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A TRANSLUCENT CARD IS PAGE CHROME, NOT A CARD. The rule for the light theme
 * is that cards keep their own colours — but this one has none of its own: it
 * is an amber wash over whatever the page is, so on paper it becomes pale amber
 * and its white type disappears into it. Anything that tints the ground rather
 * than covering it has to follow the theme.
 */
const makeHa = (p: Palette) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,154,46,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,154,46,0.34)',
    gap: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,154,46,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,154,46,0.36)',
  },
  title: { color: p.text, fontSize: 14.5, fontWeight: '800' },
  sub: { color: p.ink(0.66), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },
  ghost: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 999,
    backgroundColor: p.ink(0.06),
    borderWidth: StyleSheet.hairlineWidth, borderColor: p.ink(0.18),
  },
  ghostText: { color: p.ink(0.86), fontSize: 14, fontWeight: '700' },
  primary: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 999,
    backgroundColor: p.text,
  },
  primaryText: { color: p.bg, fontSize: 14, fontWeight: '800' },
});

/**
 * The switch, once the question has been answered — two options, both visible.
 *
 * It was a line of text with the word "Switch" after it, which the owner could
 * not see as a control (13.08: "needs to be a bit more obvious. More of a
 * button option or on off switch"). A segmented pair says three things a text
 * link cannot: that there are exactly two states, which one you are in, and
 * that the other one is one tap away. Same shape as the Appearance control in
 * Settings, so the app has one way of asking a two-or-three-way question.
 *
 * Still under the hero rather than in Settings: the context genuinely changes
 * — car today, desk tomorrow — and buried in Settings it would be answered
 * once and then quietly wrong for ever.
 */
export function SessionKindSwitch({
  kind, onChange,
}: { kind: SessionKind; onChange: (k: SessionKind) => void }) {
  const sk = useStyles(makeSk);
  const pal = usePalette();
  const OPTIONS: { id: SessionKind; label: string; icon: 'steering' | 'headphones' }[] = [
    { id: 'driving', label: 'Driving', icon: 'steering' },
    { id: 'listening', label: 'Just listening', icon: 'headphones' },
  ];
  return (
    <View style={sk.wrap}>
      {OPTIONS.map((o) => {
        const on = kind === o.id;
        return (
          <Pressable
            key={o.id}
            // A tick under the thumb, because this switch has no other
            // feedback — nothing moves, nothing plays, the app just quietly
            // changes what it calls things (owner, 13.08: "there needs to be
            // a little vibration effect to feel the effect"). Only on a real
            // change: buzzing when you tap the option you are already on
            // teaches people the tick means nothing.
            onPress={() => {
              if (on) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(o.id);
            }}
            style={[sk.item, on && sk.itemOn]}
            hitSlop={4}>
            <MaterialCommunityIcons
              name={o.icon}
              size={15}
              color={on ? pal.bg : pal.ink(0.6)}
            />
            <Text style={[sk.label, on && sk.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeSk = (p: Palette) => StyleSheet.create({
  // Sized to its content rather than stretched across the page: this is a
  // quiet preference under the hero, not the page's main control.
  wrap: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: p.ink(0.07),
    marginHorizontal: 16,
    marginTop: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  itemOn: { backgroundColor: p.text },
  label: { color: p.ink(0.6), fontSize: 12.5, fontWeight: '700' },
  labelOn: { color: p.bg },
});
