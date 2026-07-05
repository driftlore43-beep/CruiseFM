// Tab navigation is now handled by src/app/(tabs)/_layout.tsx.
// The previous Tabs/TabSlot from expo-router/ui caused a duplicate
// NavigationContainer error on web. This file is intentionally a no-op.
export default function AppTabs() {
  return null;
}
