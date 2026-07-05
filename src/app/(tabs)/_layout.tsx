import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; label: string; icon: IoniconName; iconActive: IoniconName }[] = [
  { name: 'cruise',  label: 'CRUISE',   icon: 'car-sport-outline',    iconActive: 'car-sport' },
  { name: 'stations', label: 'STATIONS', icon: 'radio-outline',        iconActive: 'radio' },
  { name: 'modes',   label: 'MODES',    icon: 'disc-outline',          iconActive: 'disc' },
  { name: 'profile', label: 'PROFILE',  icon: 'person-circle-outline', iconActive: 'person-circle' },
];

function FloatingTabBar({
  state,
  navigation,
}: {
  state: { routes: { key: string; name: string }[]; index: number };
  navigation: { navigate: (name: string) => void };
}) {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'ios'
    ? Math.max(insets.bottom, TAB_BAR_BOTTOM)
    : TAB_BAR_BOTTOM;

  return (
    <View style={[styles.wrapper, { bottom }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const active = state.index === index;
          return (
            <Pressable
              key={route.key}
              style={styles.tabItem}
              onPress={() => navigation.navigate(route.name)}>
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={28}
                color={active ? '#FFFFFF' : '#6A6A72'}
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
    <Tabs
      tabBar={(props) => <FloatingTabBar state={props.state} navigation={props.navigation} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="cruise"  options={{ title: 'Cruise' }} />
      <Tabs.Screen name="stations" options={{ title: 'Stations' }} />
      <Tabs.Screen name="modes"   options={{ title: 'Modes' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0d0d0d',
    borderRadius: 30,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
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
    color: '#6A6A72',
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
