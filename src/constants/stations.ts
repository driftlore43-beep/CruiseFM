import type { ImageSourcePropType } from 'react-native';

export type Station = {
  id: string;
  name: string;
  tagline: string;
  tags: string[];
  premium: boolean;
  gradientColors: [string, string, string];
  /** Vibrant mood gradient used for the card previews (top-left → bottom-right) */
  cardGradient: [string, string, string];
  /** MaterialCommunityIcons glyph name — clean white icon for the card */
  iconName: string;
  /** Equalizer bar gradient, bottom → mid → top. Optional; modes fall back to a default. */
  eqColors?: [string, string, string];
  glowColor: string;
  image: ImageSourcePropType;
  /** Optional looping motion background (animated WebP). Falls back to `image`. */
  motion?: ImageSourcePropType;
  icon: string;
  iconBg: string;
  bestTime: string;
  duration: string;
  trackCount: number;
  spotifyUrl: string;
  appleMusicUrl: string;
};

export const STATIONS: Station[] = [
  {
    id: 'night-run',
    name: 'Night Run FM',
    tagline: 'Empty expressways. Violet dashboards.',
    tags: ['dark vibes', 'neon nights'],
    premium: false,
    gradientColors: ['#1a0533', '#4a1a7a', '#000000'],
    cardGradient: ['#5626bb', '#2d2282', '#181353'],
    iconName: 'weather-night',
    eqColors: ['#5EE7FF', '#5B7BFF', '#C44CFF'],
    glowColor: '#4a1a7a',
    image: require('../../assets/stations/night-run.jpg'),
    icon: 'weather-night',
    iconBg: '#2d1060',
    bestTime: 'Late night',
    duration: '2 hr mix',
    trackCount: 24,
    spotifyUrl: 'https://open.spotify.com/search/night%20drive%20playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=night+drive',
  },
  {
    id: 'rain-drive',
    name: 'Rain Drive FM',
    tagline: 'Streetlights reflected in glass. Slow roads.',
    tags: ['rainy', 'reflective'],
    premium: true,
    gradientColors: ['#051530', '#0a3a5c', '#2a1060'],
    cardGradient: ['#1579cc', '#208367', '#133353'],
    iconName: 'weather-pouring',
    eqColors: ['#FFF3B8', '#FFE070', '#F0C24C'],
    glowColor: '#0a3a5c',
    image: require('../../assets/stations/rain-drive.jpg'),
    icon: 'weather-pouring',
    iconBg: '#0c2b45',
    bestTime: 'Rainy days',
    duration: '45 min',
    trackCount: 18,
    spotifyUrl: 'https://open.spotify.com/search/rainy+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=rainy+drive',
  },
  {
    id: 'coastal',
    name: 'Coastal FM',
    tagline: 'Ocean air. Open horizons. Golden hour.',
    tags: ['sunset', 'coastal'],
    premium: true,
    gradientColors: ['#032830', '#1a6b50', '#c45a10'],
    cardGradient: ['#1fad8e', '#a0680d', '#702400'],
    iconName: 'waves',
    eqColors: ['#4FE0C0', '#F0B048', '#FF7A3C'],
    glowColor: '#c45a10',
    image: require('../../assets/stations/coastal.jpg'),
    icon: 'waves',
    iconBg: '#1a4030',
    bestTime: 'Golden hour',
    duration: '1.5 hr mix',
    trackCount: 30,
    spotifyUrl: 'https://open.spotify.com/search/coastal+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=coastal+drive',
  },
  {
    id: 'mountain-pass',
    name: 'Mountain Pass FM',
    tagline: 'Cold air. Fog ahead. One more corner.',
    tags: ['mountain', 'adventure'],
    premium: true,
    gradientColors: ['#021a15', '#0d4a3a', '#000000'],
    cardGradient: ['#30b095', '#2e6476', '#1b414b'],
    iconName: 'image-filter-hdr',
    // Pure white — the teal/green mood blended into the snowy mountain photo,
    // so every mode's visualiser reads clean white against it.
    eqColors: ['#FFFFFF', '#F2F6FF', '#FFFFFF'],
    glowColor: '#0d4a3a',
    image: require('../../assets/stations/mountain.jpg'),
    icon: 'image-filter-hdr',
    iconBg: '#0d3a2a',
    bestTime: 'Morning',
    duration: '1 hr mix',
    trackCount: 20,
    spotifyUrl: 'https://open.spotify.com/search/mountain+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=mountain+drive',
  },
  {
    id: 'after-midnight',
    name: 'After Hours FM',
    tagline: 'When the world is asleep. And the road belongs to you.',
    tags: ['late night', 'solitude'],
    premium: false,
    gradientColors: ['#111118', '#0a0f2b', '#000000'],
    cardGradient: ['#3b34ac', '#283a7c', '#17174f'],
    iconName: 'star-four-points',
    eqColors: ['#FF4444', '#FF1111', '#FF0000'],
    glowColor: '#0a0f2b',
    image: require('../../assets/stations/after-midnight.jpg'),
    icon: 'star-four-points',
    iconBg: '#16162a',
    bestTime: 'After hours',
    duration: '1.5 hr mix',
    trackCount: 22,
    spotifyUrl: 'https://open.spotify.com/search/after+midnight+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=after+midnight+drive',
  },
  {
    id: 'sunset',
    name: 'Sunset FM',
    tagline: 'Golden hour. Open roads.',
    tags: ['sunset glow', 'warm vibes'],
    premium: false,
    gradientColors: ['#8a3a05', '#5a1a6a', '#000000'],
    cardGradient: ['#c4461d', '#733061', '#331f47'],
    iconName: 'weather-sunset',
    eqColors: ['#FFC24C', '#FF7A48', '#D84C8A'],
    glowColor: '#8a3a05',
    image: require('../../assets/stations/sunset.jpg'),
    // motion: temporarily disabled — new still artwork used everywhere until a
    // fresh motion clip is made for it. Old clip kept at assets/stations/sunset-motion.webp.
    icon: 'weather-sunset',
    iconBg: '#5a2800',
    bestTime: 'Sunset',
    duration: '1 hr mix',
    trackCount: 20,
    spotifyUrl: 'https://open.spotify.com/search/sunset+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=sunset+drive',
  },
  {
    id: 'cars-coffee',
    name: 'Cars & Coffee FM',
    tagline: 'Cold mornings. Warm cups. Engines idling.',
    tags: ['sunday morning', 'motors'],
    premium: true,
    gradientColors: ['#2a1505', '#6b3a10', '#000000'],
    cardGradient: ['#ae6f32', '#77502d', '#49331d'],
    iconName: 'coffee',
    eqColors: ['#FFD9A0', '#F0A050', '#C06A28'],
    glowColor: '#8a5a1a',
    image: require('../../assets/stations/cars-coffee.jpg'),
    icon: 'coffee',
    iconBg: '#3a2410',
    bestTime: 'Sunday morning',
    duration: '1 hr mix',
    trackCount: 20,
    spotifyUrl: 'https://open.spotify.com/search/cars+and+coffee+morning+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=cars+and+coffee+morning',
  },
  {
    id: 'tunnel',
    name: 'Tunnel FM',
    tagline: 'Underground. Neon tubes. Bass reverberating.',
    tags: ['tunnel run', 'high energy'],
    premium: true,
    gradientColors: ['#2a0a5a', '#0a2a40', '#000000'],
    cardGradient: ['#492eb3', '#243b80', '#1d1452'],
    iconName: 'flash',
    eqColors: ['#FFD24C', '#FF8A2A', '#F03A2E'],
    glowColor: '#2a0a5a',
    image: require('../../assets/stations/tunnel.jpg'),
    icon: 'flash',
    iconBg: '#1a1040',
    bestTime: 'Any time',
    duration: '45 min',
    trackCount: 16,
    spotifyUrl: 'https://open.spotify.com/search/tunnel+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=tunnel+drive',
  },
  {
    id: 'downtown',
    name: 'Downtown FM',
    tagline: 'Violet towers. Sleeping streets.',
    tags: ['city lights', 'midnight'],
    premium: true,
    gradientColors: ['#0c1034', '#241a58', '#05030f'],
    cardGradient: ['#8A3FFF', '#4E52F5', '#2a2a9e'],
    iconName: 'city-variant',
    eqColors: ['#6E8CFF', '#9B5CFF', '#E24CFF'],
    glowColor: '#241a58',
    image: require('../../assets/stations/downtown.jpg'),
    icon: 'city-variant',
    iconBg: '#1a1650',
    bestTime: 'Midnight',
    duration: '1 hr mix',
    trackCount: 20,
    spotifyUrl: 'https://open.spotify.com/search/downtown+night+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=downtown+night+drive',
  },
];

export const RECOMMENDED_IDS = ['night-run', 'after-midnight', 'sunset'];
