import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingHost } from '@/components/NowPlayingHost';
import { useStyles, usePalette } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import { PAGE_GUTTER, TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; label: string; icon: IoniconName; iconActive: IoniconName }[] = [
  { name: 'cruise',  label: 'CRUISE',   icon: 'car-sport-outline',    iconActive: 'car-sport' },
  { name: 'stations', label: 'STATIONS', icon: 'radio-outline',        iconActive: 'radio' },
  { name: 'modes',   label: 'MODES',    icon: 'disc-outline',          iconActive: 'disc' },
  { name: 'profile', label: 'PROFILE',  icon: 'person-circle-outline', iconActive: 'person-circle' },
];

const PILL_PAD_H = 16;
const POD_INSET = 5;

function FloatingTabBar({
  state,
  navigation,
}: {
  state: { routes: { key: string; name: string }[]; index: number };
  navigation: { navigate: (name: string) => void };
}) {
  const styles = useStyles(makeStyles);
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'ios'
    ? Math.max(insets.bottom, TAB_BAR_BOTTOM)
    : TAB_BAR_BOTTOM;

  // App Store-style: a grey pod glides to the active tab; the whole bar
  // brightens slightly while a finger is down on it.
  const [barW, setBarW] = useState(0);
  const podX = useRef(new Animated.Value(0)).current;
  const podPlaced = useRef(false);
  const pressGlow = useRef(new Animated.Value(0)).current;

  const slotW = barW > 0 ? (barW - PILL_PAD_H * 2) / state.routes.length : 0;
  const podW = Math.max(0, slotW - POD_INSET * 2);

  useEffect(() => {
    if (barW === 0) return;
    const target = PILL_PAD_H + state.index * slotW + POD_INSET;
    if (!podPlaced.current) {
      // First layout: park the pod on the active tab without animating.
      podX.setValue(target);
      podPlaced.current = true;
      return;
    }
    Animated.spring(podX, {
      toValue: target,
      useNativeDriver: true,
      tension: 120,
      friction: 16,
    }).start();
  }, [state.index, barW, slotW]);

  const glowIn = () =>
    Animated.timing(pressGlow, { toValue: 1, duration: 110, useNativeDriver: true }).start();
  const glowOut = () =>
    Animated.timing(pressGlow, { toValue: 0, duration: 260, useNativeDriver: true }).start();

  return (
    <View style={[styles.wrapper, { bottom }]} pointerEvents="box-none">
      <View style={styles.pill} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        {/* Whole-bar press glow */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pressGlow,
            { opacity: pressGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] }) },
          ]}
        />
        {/* Sliding pod behind the active tab */}
        {barW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.pod, { width: podW, transform: [{ translateX: podX }] }]}
          />
        )}
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const active = state.index === index;
          return (
            <Pressable
              key={route.key}
              style={styles.tabItem}
              onPressIn={glowIn}
              onPressOut={glowOut}
              onPress={() => navigation.navigate(route.name)}>
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={28}
                color={active ? palette.text : palette.barMuted}
              />
              <Text style={[styles.label, active && styles.labelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <>
      <Tabs
        tabBar={(props) => <FloatingTabBar state={props.state} navigation={props.navigation} />}
        screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="cruise"  options={{ title: 'Cruise' }} />
        <Tabs.Screen name="stations" options={{ title: 'Stations' }} />
        <Tabs.Screen name="modes"   options={{ title: 'Modes' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      {/* One home for every mode fullscreen + the Spotify-style mini-player */}
      <NowPlayingHost />
    </>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: PAGE_GUTTER,
    right: PAGE_GUTTER,
    zIndex: 100,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: p.bar,
    borderRadius: 30,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: p.ink(0.08),
    shadowColor: p.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55 * p.shadowOpacity,
    shadowRadius: 24,
    elevation: 18,
  },
  pressGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: p.mode === 'light' ? '#000000' : '#ffffff',
    borderRadius: 30,
  },
  pod: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    borderRadius: 24,
    backgroundColor: p.ink(0.13),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: p.barMuted,
  },
  labelActive: {
    color: p.text,
  },
});
