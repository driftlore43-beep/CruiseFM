import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Always-visible tap target to leave a fullscreen mode. The swipe-down gesture
 * stays as the nice path, but it can miss (especially on iOS, and behind the
 * busy visualisers), so this guarantees there's a way out that never depends
 * on a gesture landing. Top-right, high z-index so it sits above everything —
 * even the handoff panel.
 */
export function ModeCloseButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      style={[st.btn, { top: Math.max(insets.top, 18) + 4 }]}>
      <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );
}

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
