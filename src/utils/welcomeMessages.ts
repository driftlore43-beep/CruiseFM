import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_MESSAGE_KEY   = 'cruise_welcome_last_message';
const LAST_VISIT_KEY     = 'cruise_welcome_last_visit';
const HAS_LAUNCHED_KEY   = 'cruise_welcome_has_launched';

const SEVERAL_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export type WeatherCondition = 'sunny' | 'rain' | 'fog' | 'cold';

const MORNING = [
  "Good morning. Let's drive.",
  'Sunrise. Coffee. Music.',
  'A fresh road ahead.',
  'Wherever today takes you.',
  'Your soundtrack starts here.',
];

const AFTERNOON = [
  'Ready for another drive?',
  'Perfect weather for a cruise.',
  'Where to next?',
  'Enjoy the journey.',
  'Keep moving.',
];

const EVENING = [
  'Golden hour begins.',
  'One more drive today?',
  'Every drive deserves a soundtrack.',
  'Take the long way home.',
  "Let's make this drive memorable.",
];

const NIGHT = [
  'The road is calling.',
  'Night mode activated.',
  'Midnight cruising.',
  'The night is young.',
  'Perfect night for a cruise.',
  'Tonight deserves a soundtrack.',
  'Your soundtrack awaits.',
  'Escape starts now.',
  'Another drive awaits.',
  'Wherever the road leads.',
];

const WEATHER: Record<WeatherCondition, string[]> = {
  sunny: [
    'Perfect driving weather.',
    'Blue skies ahead.',
    'Windows down.',
    'Enjoy the sunshine.',
  ],
  rain: [
    'Rain sounds better with music.',
    'Slow down. Enjoy the rain.',
    'Rainy roads. Perfect soundtrack.',
    'Let the music do the driving.',
  ],
  fog: [
    'Easy does it today.',
    'Take it slow.',
    'Every road has a story.',
  ],
  cold: [
    'Warm cabin. Great playlist.',
    'Cozy drive incoming.',
  ],
};

const RETURNING_USER = [
  'Good to see you again.',
  'Welcome back.',
  'Ready for another adventure?',
];

const FIRST_LAUNCH = [
  'Welcome to Cruise FM.',
  "Let's make every drive memorable.",
  'Your journey starts here.',
];

const RETURNING_AFTER_DAYS = [
  "We've been saving your seat.",
  'Welcome back.',
  'Ready to hit the road again?',
];

const LONG_DRIVE = [
  "Looks like you've got some miles ahead.",
  'Settle in.',
  "This one's worth the playlist.",
  'Enjoy the road.',
];

const GENERAL = [
  'Take the long way home.',
  'Good music. Open roads.',
  'Every drive has a story.',
  'Find your rhythm.',
  'Drive your own story.',
  'Roads become movies.',
  'Chase the horizon.',
  'Let the road decide.',
  'Keep cruising.',
  'Drive without rushing.',
  'Built for the drive.',
  'Fuel the passion.',
  'Every corner counts.',
  'Find the perfect road.',
  'Keep the wheels turning.',
];

function timeOfDayPool(hour: number): string[] {
  if (hour >= 5 && hour < 12) return MORNING;
  if (hour >= 12 && hour < 17) return AFTERNOON;
  if (hour >= 17 && hour < 21) return EVENING;
  return NIGHT;
}

function pickRandom(pool: string[], exclude?: string | null): string {
  if (pool.length === 0) return GENERAL[0];
  if (pool.length === 1) return pool[0];
  let choice: string;
  do {
    choice = pool[Math.floor(Math.random() * pool.length)];
  } while (choice === exclude);
  return choice;
}

export type WelcomeContext = {
  weather?: WeatherCondition;
  longDriveMinutes?: number;
};

/**
 * Picks one welcome message using visit history + time of day (+ optional
 * weather / long-drive context), avoiding an immediate repeat of the last
 * message shown. Persists state so "returning after days" / "first launch"
 * can be detected across app opens.
 */
export async function pickWelcomeMessage(ctx: WelcomeContext = {}): Promise<string> {
  const now = Date.now();
  const [hasLaunched, lastVisitRaw, lastMessage] = await Promise.all([
    AsyncStorage.getItem(HAS_LAUNCHED_KEY),
    AsyncStorage.getItem(LAST_VISIT_KEY),
    AsyncStorage.getItem(LAST_MESSAGE_KEY),
  ]);

  const lastVisit = lastVisitRaw ? Number(lastVisitRaw) : null;
  const isFirstLaunch = !hasLaunched;
  const isReturningAfterDays = !isFirstLaunch && lastVisit !== null && now - lastVisit >= SEVERAL_DAYS_MS;
  const isReturning = !isFirstLaunch && !isReturningAfterDays;

  let pool: string[];

  if (ctx.longDriveMinutes && ctx.longDriveMinutes > 30) {
    pool = LONG_DRIVE;
  } else if (isFirstLaunch) {
    pool = FIRST_LAUNCH;
  } else if (isReturningAfterDays) {
    pool = RETURNING_AFTER_DAYS;
  } else {
    // Mix time-of-day, weather (if known), returning-user, and general so the
    // greeting varies drive to drive rather than always being the same category.
    const hour = new Date().getHours();
    pool = [
      ...timeOfDayPool(hour),
      ...(ctx.weather ? WEATHER[ctx.weather] : []),
      ...(isReturning ? RETURNING_USER : []),
      ...GENERAL,
    ];
  }

  const message = pickRandom(pool, lastMessage);

  await Promise.all([
    AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true'),
    AsyncStorage.setItem(LAST_VISIT_KEY, String(now)),
    AsyncStorage.setItem(LAST_MESSAGE_KEY, message),
  ]);

  return message;
}
