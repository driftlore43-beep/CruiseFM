import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { pickWelcomeMessage, type WelcomeContext } from '@/utils/welcomeMessages';

const VISIBLE_MS = 3000;
const FADE_MS = 400;

type Props = {
  /** The normal line for this slot, e.g. "Resuming Tunnel FM" */
  cueLabel: string;
  context?: WelcomeContext;
};

/**
 * One text slot, two lives: opens with the welcome greeting, holds ~3s, then
 * cross-fades into the regular cue label. Both share the same position and
 * left alignment so the swap feels cinematic, not layout-shifting.
 */
export function WelcomeCueLine({ cueLabel, context }: Props) {
  const [welcome, setWelcome] = useState<string | null>(null);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const cueOpacity     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    pickWelcomeMessage(context).then((msg) => {
      if (cancelled) return;
      setWelcome(msg);

      Animated.timing(welcomeOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setTimeout(() => {
          if (cancelled) return;
          Animated.parallel([
            Animated.timing(welcomeOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
            Animated.timing(cueOpacity,     { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
          ]).start();
        }, VISIBLE_MS);
      });
    }).catch(() => {
      // If the welcome pick fails for any reason, just show the cue.
      if (!cancelled) {
        Animated.timing(cueOpacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.slot}>
      <Animated.Text style={[styles.line, styles.welcome, { opacity: welcomeOpacity }]} numberOfLines={1}>
        {welcome ?? ''}
      </Animated.Text>
      <Animated.Text
        style={[styles.line, styles.cue, { opacity: cueOpacity, position: 'absolute', left: 0, right: 0, top: 0 }]}
        numberOfLines={1}>
        {cueLabel}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    marginTop: 8,
    height: 20,
    justifyContent: 'center',
  },
  line: {
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 20,
  },
  welcome: {
    color: 'rgba(210,190,255,0.85)',
    textShadowColor: 'rgba(123,56,224,0.5)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  cue: {
    color: 'rgba(255,255,255,0.55)',
  },
});
