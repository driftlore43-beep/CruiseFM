import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SIDEBAR_W } from '@/constants/theme';
import { useStyles, usePalette } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * THE IPAD RACK — the four tabs as a receiver sidebar rather than a floating
 * pill at the foot.
 *
 * This is the wide-screen half of the tab bar: `(tabs)/_layout.tsx` hands it in
 * as the custom `tabBar` and sets `tabBarPosition: 'left'` only above WIDE_MIN,
 * so a phone is never touched. The navigator lays this out in a row beside the
 * stage, so all this component owns is the sidebar itself — a fixed-width
 * full-height panel that reads as a hi-fi front: the wordmark up top, the four
 * inputs as a stack, a lit amber marker sliding to the selected one.
 */
const NAV: { name: string; label: string; icon: IoniconName; iconActive: IoniconName }[] = [
  { name: 'cruise',   label: 'Cruise',   icon: 'car-sport-outline',    iconActive: 'car-sport' },
  { name: 'stations', label: 'Stations', icon: 'radio-outline',        iconActive: 'radio' },
  { name: 'modes',    label: 'Modes',    icon: 'disc-outline',          iconActive: 'disc' },
  { name: 'profile',  label: 'Profile',  icon: 'person-circle-outline', iconActive: 'person-circle' },
];

const ROW_H = 58;
const ROW_GAP = 8;

export function SideRack({
  state,
  navigation,
}: {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}) {
  const styles = useStyles(makeStyles);
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  // A lit amber marker glides to the active input, the sidebar cousin of the
  // grey pod that slides across the phone pill.
  const markerY = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    const target = state.index * (ROW_H + ROW_GAP);
    if (!placed.current) {
      markerY.setValue(target);
      placed.current = true;
      return;
    }
    Animated.spring(markerY, {
      toValue: target,
      useNativeDriver: true,
      tension: 120,
      friction: 18,
    }).start();
  }, [state.index]);

  return (
    <View style={[styles.rack, { paddingTop: insets.top + 26, paddingLeft: insets.left + 22 }]}>
      {/* Wordmark — the app's own, FM in the dial's amber. */}
      <View style={styles.brand}>
        <Text style={styles.brandText}>
          CRUISE <Text style={styles.brandFm}>FM</Text>
        </Text>
        <Text style={styles.brandSub}>MOOD RECEIVER</Text>
      </View>

      {/* Inputs. The marker sits behind them and tracks the focused route. */}
      <View style={styles.nav}>
        <Animated.View
          pointerEvents="none"
          style={[styles.marker, { transform: [{ translateY: markerY }] }]}
        />
        {state.routes.map((route, index) => {
          const item = NAV.find((n) => n.name === route.name);
          if (!item) return null;
          const active = state.index === index;
          return (
            <Pressable
              key={route.key}
              style={styles.row}
              onPress={() => navigation.navigate(route.name)}>
              <View style={[styles.accent, active && styles.accentOn]} />
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={24}
                color={active ? palette.text : palette.barMuted}
              />
              <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.spacer} />

      {/* A quiet receiver footer, so the panel ends like a front and not a
          cut-off list. */}
      <View style={styles.foot}>
        <View style={styles.footBars}>
          <View style={[styles.footBar, { height: 8 }]} />
          <View style={[styles.footBar, { height: 14 }]} />
          <View style={[styles.footBar, { height: 6 }]} />
          <View style={[styles.footBar, { height: 11 }]} />
        </View>
        <Text style={styles.footText}>A STROFI TECHNOLOGIES APP</Text>
      </View>
    </View>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  rack: {
    width: SIDEBAR_W,
    height: '100%',
    alignSelf: 'stretch',
    backgroundColor: p.panel,
    paddingRight: 20,
    paddingBottom: 26,
    borderRightWidth: 1,
    borderRightColor: p.ink(0.08),
  },
  brand: {
    marginBottom: 34,
  },
  brandText: {
    color: p.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
  brandFm: {
    color: p.amber,
  },
  brandSub: {
    color: p.ink(0.42),
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 6,
  },
  nav: {
    gap: ROW_GAP,
  },
  marker: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: ROW_H,
    borderRadius: 16,
    backgroundColor: p.ink(0.1),
  },
  row: {
    height: ROW_H,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 14,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: ROW_H / 2 - 12,
    width: 3,
    height: 24,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  accentOn: {
    backgroundColor: p.amber,
  },
  rowLabel: {
    color: p.barMuted,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  rowLabelActive: {
    color: p.text,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  foot: {
    gap: 12,
  },
  footBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 16,
  },
  footBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: p.ink(0.22),
  },
  footText: {
    color: p.ink(0.3),
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
});
