import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

/** Glassmorphic overlay for premium/PRO cards. Reads like a pane of glass:
 * a soft top sheen fading to a faint bottom shadow (3D bevel), plus — when a
 * radius is supplied — a bright edge rim and a top highlight line. */
export function GlossSheen({ radius }: { radius?: number }) {
  return (
    <>
      {/* Vertical glass sheen — light gathers at the top, a hint of shadow
          grounds the bottom, giving the card dimension. */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.20)',
          'rgba(255,255,255,0.05)',
          'transparent',
          'rgba(0,0,0,0.16)',
        ]}
        locations={[0, 0.28, 0.6, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Soft upper-left corner glow — the ambient light catch on glass. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.55, y: 0.55 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {radius != null && (
        <>
          {/* Bright glass rim around every edge. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: radius, borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
            ]}
          />
          {/* Extra-bright highlight along the very top edge. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: '7%', right: '7%', height: 1.5,
              backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 1,
            }}
          />
        </>
      )}
    </>
  );
}
