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
  /** Pre-blurred copy of `image` — rendered instead of a live blurRadius,
   *  which froze the main thread long enough for iOS to kill the app. */
  imageBlur?: ImageSourcePropType;
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
    name: 'Night Run AM',
    tagline: 'Empty expressways. Blue-lit dashboards.',
    tags: ['dark vibes', 'neon nights'],
    premium: false,
    // TEAL, station-wide, TAKEN FROM THE PHOTOGRAPH (owner, 19.08: "have the
    // accents on night run station a teal colour from the background image").
    // Not picked by eye — the picture was measured: weighting every pixel by
    // saturation x brightness, as scripts/marketing/tints.py does, 83% of its
    // colour sits between hue 180 and 195 and the weighted mean is 182. So
    // the photograph is teal and the accents were jet blue at hue 218, which
    // is the same mismatch the 31.07 round fixed one step short of: it moved
    // magenta -> blue when the picture was never blue either.
    //
    // The anchors below are sampled rather than invented — the lit neon in
    // the shot averages rgb(95,181,200) and its deep tones rgb(22,90,99).
    // Every colour on the station still moves together (31.07's rule): a teal
    // mode over a blue card would be worse than either.
    gradientColors: ['#03151c', '#0d5f70', '#000000'],
    cardGradient: ['#1f9fb0', '#166f80', '#0d3a45'],
    iconName: 'weather-night',
    eqColors: ['#BDF1F5', '#19C6D4', '#0B6577'],
    glowColor: '#0d5f70',
    image: require('../../assets/stations/night-run.jpg'),
    imageBlur: require('../../assets/stations/blur/night-run.jpg'),
    icon: 'weather-night',
    iconBg: '#0a4a58',
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
    imageBlur: require('../../assets/stations/blur/rain-drive.jpg'),
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
    imageBlur: require('../../assets/stations/blur/coastal.jpg'),
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
    imageBlur: require('../../assets/stations/blur/mountain.jpg'),
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
    premium: true,
    gradientColors: ['#111118', '#0a0f2b', '#000000'],
    cardGradient: ['#3b34ac', '#283a7c', '#17174f'],
    iconName: 'star-four-points',
    eqColors: ['#FF4444', '#FF1111', '#FF0000'],
    glowColor: '#0a0f2b',
    image: require('../../assets/stations/after-midnight.jpg'),
    imageBlur: require('../../assets/stations/blur/after-midnight.jpg'),
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
    name: 'Sunset AM',
    tagline: 'Golden hour. Open roads.',
    tags: ['sunset glow', 'warm vibes'],
    premium: false,
    gradientColors: ['#8a3a05', '#5a1a6a', '#000000'],
    cardGradient: ['#c4461d', '#733061', '#331f47'],
    iconName: 'weather-sunset',
    // Golden hour, not neon nightclub. This used to be three hot pinks, which
    // made it the one station whose accents fought its own artwork and its
    // burnt-orange gradients — and it turned every warm surface (disco wash,
    // atmosphere smoke, bloom, EQ bars) magenta. Amber leads now, with pink
    // kept only as the last stop.
    eqColors: ['#FFA24B', '#FF6F5A', '#D2467F'],
    glowColor: '#8a3a05',
    image: require('../../assets/stations/sunset.jpg'),
    imageBlur: require('../../assets/stations/blur/sunset.jpg'),
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
    imageBlur: require('../../assets/stations/blur/cars-coffee.jpg'),
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
    cardGradient: ['#3E66F2', '#232E82', '#C85A14'],
    iconName: 'flash',
    eqColors: ['#FFD24C', '#FF8A2A', '#F03A2E'],
    glowColor: '#2a0a5a',
    image: require('../../assets/stations/tunnel.jpg'),
    imageBlur: require('../../assets/stations/blur/tunnel.jpg'),
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
    imageBlur: require('../../assets/stations/blur/downtown.jpg'),
    icon: 'city-variant',
    iconBg: '#1a1650',
    bestTime: 'Midnight',
    duration: '1 hr mix',
    trackCount: 20,
    spotifyUrl: 'https://open.spotify.com/search/downtown+night+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=downtown+night+drive',
  },
  {
    id: 'daylight',
    name: 'Daylight AM',
    tagline: 'Top down. Open road.',
    tags: ['summer', 'sunny'],
    premium: false,
    gradientColors: ['#3a2c08', '#7a5810', '#c9922a'],
    cardGradient: ['#FFD645', '#F5A81E', '#E07B14'],
    iconName: 'white-balance-sunny',
    // The one daytime station — sun-drenched gold/amber. Deep amber base keeps
    // the visualiser readable against the bright pale-sky backdrop.
    eqColors: ['#FFD84A', '#FBA518', '#E8720E'],
    glowColor: '#c9922a',
    image: require('../../assets/stations/daylight.jpg'),
    imageBlur: require('../../assets/stations/blur/daylight.jpg'),
    icon: 'white-balance-sunny',
    iconBg: '#5a3e0a',
    bestTime: 'Daytime',
    duration: '1 hr mix',
    trackCount: 20,
    spotifyUrl: 'https://open.spotify.com/search/summer+daytime+drive+playlist',
    appleMusicUrl: 'https://music.apple.com/search?term=summer+daytime+drive',
  },
];

export const RECOMMENDED_IDS = ['night-run', 'daylight', 'sunset'];

/**
 * Where each station sits on the Tuner's FM dial.
 *
 * Lives here rather than inside TunerMode because the share card draws the
 * same dial and needs the same number — and importing it from the mode would
 * make a cycle (mode → action row → share card → mode).
 */
export const STATION_FREQS: Record<string, number> = {
  'daylight': 90.5,
  'night-run': 92.1,
  'after-midnight': 94.7,
  'sunset': 96.3,
  'rain-drive': 98.9,
  'downtown': 100.1,
  'coastal': 101.3,
  'mountain-pass': 103.5,
  'cars-coffee': 105.1,
  'tunnel': 107.5,
};

/** A station's dial frequency. Stations the user made up themselves get a
 *  stable one derived from their id, so the same station always tunes to the
 *  same place instead of jumping about between screens. */
export function stationFrequency(id: string): number {
  const known = STATION_FREQS[id];
  if (known !== undefined) return known;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return Math.round((88.1 + (h % 1000) / 1000 * 20) * 10) / 10;
}

// ── The two bands ─────────────────────────────────────────────────────────────
//
// The Stations page is laid out like a real receiver: AM carries the free
// stations and the ones you make yourself, FM carries the premium ones. That
// gives the page a reason to look like a dial instead of a second list of
// cards, and it makes "what do I get for paying" a thing you can see at a
// glance rather than a badge repeated seven times.

export type Band = 'AM' | 'FM';

/** Where the free stations sit on the AM scale (kHz). */
export const STATION_AM: Record<string, number> = {
  'night-run': 810,
  'sunset': 1010,
  'daylight': 1240,
};

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** A made-up station's AM slot: stable, on the real 540–1600 kHz scale, and
 *  always a round 10 kHz so it looks like something a receiver would show. */
export function stationAm(id: string): number {
  return STATION_AM[id] ?? 540 + (hashOf(id) % 107) * 10;
}

/** What the dial reads for a station, and which band it's on. */
export function stationDial(id: string, premium: boolean): { band: Band; label: string; value: number } {
  if (premium) {
    const f = stationFrequency(id);
    return { band: 'FM', label: f.toFixed(1), value: f };
  }
  const a = stationAm(id);
  return { band: 'AM', label: String(a), value: a };
}
