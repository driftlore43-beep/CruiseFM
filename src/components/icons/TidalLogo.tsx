import Svg, { Path } from 'react-native-svg';

/** Tidal's four-diamond "wave" mark — geometric logotype, public domain. */
export function TidalLogo({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * (21 / 24)} viewBox="0 0 24 21" fill="none">
      <Path d="M5 3.5 L8.5 7 L5 10.5 L1.5 7 Z" fill={color} />
      <Path d="M12 3.5 L15.5 7 L12 10.5 L8.5 7 Z" fill={color} />
      <Path d="M19 3.5 L22.5 7 L19 10.5 L15.5 7 Z" fill={color} />
      <Path d="M12 10.5 L15.5 14 L12 17.5 L8.5 14 Z" fill={color} />
    </Svg>
  );
}
