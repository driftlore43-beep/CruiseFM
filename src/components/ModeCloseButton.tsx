import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Always-visible tap target to leave a fullscreen mode. The swipe-down gesture
 * stays as the nice path, but it can miss (especially on iOS, and behind the
 * busy visualisers), so this guarantees there's a way out that never depends
 * on a gesture landing. Top-right, high z-index so it sits above everything —
 * even the handoff panel.
 */
export function ModeCloseButton({ onPress, chrome, rested = false }: {
  onPress: () => void;
  /**
   * Fades with the rest of the controls when a mode goes to rest, so the
   * scene really is standing alone — a lone chevron over an otherwise empty
   * picture is the one thing that would still say "app". Omit it and the
   * button behaves exactly as it always has, which is what the modes that
   * do not rest still want.
   */
  chrome?: Animated.Value;
  /** Rested means invisible, and an invisible button must not be pressable:
   *  the tap that is meant to bring the controls back would otherwise close
   *  the mode instead. */
  rested?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <AnimatedPressable
      onPress={onPress}
      hitSlop={14}
      pointerEvents={rested ? 'none' : 'auto'}
      style={[st.btn, { top: Math.max(insets.top, 18) + 4 }, chrome ? { opacity: chrome } : null]}>
      <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.9)" />
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const st = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 16,
    zIndex: 60,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
});
