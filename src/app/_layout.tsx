import { DarkTheme, Slot, ThemeProvider } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Cruise } from '@/constants/theme';
import { initCrashReports } from '@/utils/crashReports';

// First thing on launch, so even startup crashes get reported.
initCrashReports();
import { ThemeProvider as CruiseThemeProvider, useTheme } from '@/context/ThemeContext';
import { MotionProvider } from '@/context/MotionContext';
import { NowPlayingProvider } from '@/context/NowPlayingContext';
import { EntitlementsProvider } from '@/context/EntitlementsContext';
import { PlatformSelector, usePlatformSelector } from '@/components/PlatformSelector';
import { setPlatformSkipped } from '@/utils/musicPlatform';
import { claimFounderIfEligible } from '@/utils/founder';

// Stamp launch-week devices as Founders (fire-and-forget, idempotent).
claimFounderIfEligible();

function AppShell() {
  const platformSelector = usePlatformSelector();
  const { theme } = useTheme();

  const handleDismiss = async (skipped?: boolean) => {
    if (skipped) await setPlatformSkipped();
    platformSelector.dismiss();
  };

  // Ambient glow tracks accent color and glow intensity
  const glowAlpha = Math.round(theme.glowIntensity * 0.22 * 255).toString(16).padStart(2, '0');
  const glowColor = theme.accentColor + glowAlpha;

  return (
    <View style={styles.root}>
      <View style={[styles.ambientGlow, { backgroundColor: glowColor }]} />
      <Slot />
      <PlatformSelector
        visible={platformSelector.visible}
        onDismiss={handleDismiss}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <CruiseThemeProvider>
        <MotionProvider>
          <EntitlementsProvider>
            <NowPlayingProvider>
              <AppShell />
            </NowPlayingProvider>
          </EntitlementsProvider>
        </MotionProvider>
      </CruiseThemeProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Cruise.charcoal,
  },
  ambientGlow: {
    position: 'absolute',
    top: -160,
    alignSelf: 'center',
    width: 480,
    height: 480,
    borderRadius: 240,
  },
});
