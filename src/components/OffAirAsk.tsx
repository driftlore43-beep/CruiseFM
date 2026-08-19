import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { backOnLabel } from '@/constants/schedule';
import { Fonts } from '@/constants/theme';

/**
 * "Sunset AM is off air — play it anyway?"
 *
 * WHY AN ASK AND NOT A LOCK (owner's call, 19.08). She spotted that the
 * station page prints BACK AT 5PM over a button that starts the drive
 * regardless, which is a promise the app does not keep. A true lock was
 * weighed and rejected on the numbers: the broadcast windows only ever have
 * three or four stations open at once, so locking would put six or seven of
 * the ten out of reach at any moment, and the FM band already wears a padlock
 * for free users — a second padlock on the same page would read as "pay to
 * unlock". This keeps the schedule meaningful and the mood reachable.
 *
 * DELIBERATELY NOT A MODAL. It is raised from inside StationDetailModal,
 * which is itself a Modal, and iOS will not stack a second one over the
 * window NowPlayingHost already holds — the trap PreviewGate and the mood
 * sheet both hit. It is an in-page overlay, like every other sheet that opens
 * from within a screen.
 *
 * Dark glass in both themes, like ModeSheet and StationSheet: it sits over a
 * dimmed page either way, so it does not follow the appearance setting.
 */
export function OffAirAsk({
  stationId, stationName, accent, onPlay, onCancel,
}: {
  /** null closes it. */
  stationId: string | null;
  stationName: string;
  accent: string;
  onPlay: () => void;
  onCancel: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;
  const open = !!stationId;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: open ? 1 : 0, duration: 180, useNativeDriver: true }),
      Animated.timing(rise, {
        toValue: open ? 0 : 12, duration: 220,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, [open]);

  if (!stationId) return null;
  // "Back at 5pm" / "Back Saturday" — the same words the station page prints,
  // so the ask and the label cannot drift apart.
  const back = backOnLabel(stationId);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, { opacity: fade }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <Animated.View style={[s.card, { transform: [{ translateY: rise }] }]}>
        <View style={[s.chip, { borderColor: `${accent}66`, backgroundColor: `${accent}22` }]}>
          <Ionicons name="radio-outline" size={15} color={accent} />
        </View>
        <Text style={s.title}>{stationName} is off air</Text>
        <Text style={s.body}>
          {back ? `${back}. ` : ''}You can still play it now — the mood and the visuals work any time.
        </Text>
        <View style={s.row}>
          <Pressable style={({ pressed }) => [s.ghost, pressed && { opacity: 0.7 }]} onPress={onCancel}>
            <Text style={s.ghostText}>Not now</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.primary, pressed && { opacity: 0.9 }]} onPress={onPlay}>
            <Text style={s.primaryText}>Play anyway</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 300,
  },
  card: {
    width: '100%', maxWidth: 340,
    backgroundColor: '#0d0d16',
    borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 20,
  },
  chip: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  body: { color: 'rgba(255,255,255,0.62)', fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 20 },
  ghost: {
    flex: 1, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  ghostText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700', fontFamily: Fonts.sans },
  // The app's primary button: a solid white pill with dark type.
  primary: {
    flex: 1.25, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  primaryText: { color: '#0a0a12', fontSize: 14, fontWeight: '800', fontFamily: Fonts.sans },
});
