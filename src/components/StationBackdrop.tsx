import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useDaylight } from '@/context/MotionContext';
import type { Station } from '@/constants/stations';

/**
 * Daylight veil. Every white label in the app that sits on a photograph gets
 * its contrast from how dark the photograph is behind it, and in sun a
 * mid-bright photo swallows white type whole. A flat 22% black knocks the
 * picture back just enough for the type to hold, everywhere at once — this
 * component is the backdrop for all eight modes, the station hero and the
 * landscape deck, so one veil covers the lot.
 */
function DaylightVeil() {
  const daylight = useDaylight();
  if (!daylight) return null;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,3,10,0.22)' }]} pointerEvents="none" />;
}

/**
 * Full-bleed station background. If the station has a looping `motion` clip
 * (animated WebP) it plays that via expo-image, with the static photo as an
 * instant placeholder; otherwise it renders the plain blurred photo.
 * Custom stations have no photo — they get their chosen palette instead.
 */
export function StationBackdrop({
  station,
  blurRadius = 2.5,
  motionAllowed = false,
}: {
  station: Station;
  blurRadius?: number;
  /** Gate for the looping clip (premium + not Data Saver). Hero passes true. */
  motionAllowed?: boolean;
}) {
  if (!station.image) {
    return (
      <LinearGradient
        colors={station.gradientColors}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  if (station.motion && motionAllowed) {
    return (
      <>
        <ExpoImage
          source={station.motion}
          placeholder={station.imageBlur ?? station.image}
          placeholderContentFit="cover"
          contentFit="cover"
          blurRadius={blurRadius}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
        />
        <DaylightVeil />
      </>
    );
  }
  // Pre-blurred asset when we have one: a live blurRadius re-blurs the full
  // image on the main thread every re-display (mode open, app re-entry) —
  // Sentry caught iOS killing the app for exactly that. Displaying an
  // already-blurred JPEG costs the same as any photo.
  //
  // expo-image with contentFit="cover", NOT ImageBackground. The old version
  // forced `imageStyle={{width:'100%',height:'100%'}}` to work around web
  // rendering the photo at its intrinsic size — but explicit dimensions fight
  // resizeMode, and in LANDSCAPE that showed as the photo failing to reach
  // the left and bottom edges, leaving a hard black margin in the corner
  // (owner, 30.07). The station assets are portrait (1080 wide), so a wide
  // window is exactly the case that exposed it. contentFit covers correctly
  // on every platform and orientation with no override needed, and
  // expo-image is already in the build for the motion clips.
  // A user's own photo is a file path; the built-ins are bundled assets, so
  // numbers. That free discrimination decides how the softening happens.
  //
  // The ten built-ins ship a PRE-BLURRED file, so they want no live blur at
  // all. A user's photo does the opposite: its companion file is a plain
  // downscale, never pre-blurred, because two attempts at baking a blur in
  // with resampling both came back blocky on the phone (see stationPhoto.ts —
  // enlarging can only ever put hard edges back). So the blur happens here,
  // where it is a real gaussian and cannot block.
  //
  // THE CORRECTION IS A DIVISION, AND IT USED TO BE A MULTIPLICATION.
  //
  // This was `blurRadius * 3`, on the reasoning that the companion file is 540
  // wide against a built-in's 1080, so the same radius would read as half the
  // softening. That is upside down. The blur happens at the file's OWN size and
  // the result is then enlarged to fill the screen, so the enlargement scales
  // the blur up with everything else — a small source needs LESS radius, not
  // more. Getting it backwards made it wrong by roughly the square of the
  // factor, which is why a user's photo came out far softer than any built-in.
  //
  // MEASURED rather than judged (owner, 11.08, third round on this: "reduce the
  // blur of the selected photos much more"). Taking a built-in station's
  // shipped backdrop as 1.0 — the softness the app has always had — a user's
  // photo was landing at 0.22-0.60 of its detail, i.e. two to five times softer
  // than the thing it sits beside. At /3 it lands at about 2x, so it is now
  // clearly the sharpest backdrop in the app, which is the point: it is their
  // picture. Harness in scratchpad/photoblur (measure.py / sweep.py) reports
  // any candidate as a multiple of that reference — reuse it, there is plenty
  // of headroom left (radius 0 would be ~4x).
  //
  // NOTE THE 540 SOURCE IS NOT THE LIMIT and was never the problem: at radius 0
  // it retains MORE detail than a built-in backdrop. Raising it would buy finer
  // texture but only for photos picked afterwards, so old and new stations
  // would stop matching. This is the one number to move.
  const userPhoto = typeof station.image === 'string';
  const liveBlur = userPhoto ? blurRadius / 3 : station.imageBlur ? 0 : blurRadius;

  return (
    <>
      <ExpoImage
        source={station.imageBlur ?? station.image}
        contentFit="cover"
        blurRadius={liveBlur}
        cachePolicy="memory-disk"
        style={StyleSheet.absoluteFill}
      />
      <UserPhotoVeil station={station} />
      <DaylightVeil />
    </>
  );
}

/**
 * An extra knock-back for a photo of the user's own.
 *
 * The ten built-in stations are photographed dark on purpose — dusk, tunnels,
 * night roads — and every white label in the app leans on that. Someone's own
 * photo has no such discipline: a bright beach shot swallows the song title
 * whole. A file path means a user photo (the built-ins are bundled assets, so
 * numbers), which makes the check free and needs no extra field.
 *
 * 0.30 -> 0.14 on 10.08 (owner: "reduce the darkness layer that goes on top of
 * the custom image"). It was doing too much of the work and doing it in the
 * wrong shape: this veil is FLAT, so it dims the whole picture evenly, while
 * the station page and the modes already lay GRADIENTS over the photograph
 * that deepen exactly where white type sits. Legibility was never this layer's
 * job alone — it only has to stop the brightest photos blowing out, and the
 * shaped scrims underneath handle the rest.
 *
 * This is the one number to move if a pale photo ever proves unreadable.
 */
function UserPhotoVeil({ station }: { station: Station }) {
  if (typeof station.image !== 'string') return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,6,14,0.14)' }]}
      pointerEvents="none"
    />
  );
}
