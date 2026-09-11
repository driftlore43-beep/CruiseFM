import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { knownMode } from '@/constants/modeCatalog';
import { loadCustomStations, resolveAnyStation } from '@/utils/customStations';
import { loadLastCruise, defaultStationForNow } from '@/utils/lastCruise';
import { requestDrive } from '@/utils/driveRequest';
import type { SessionKind } from '@/utils/sessionKind';

/**
 * WHERE A WIDGET TAP LANDS: cruisefm://drive?station=<id>&mode=<id>&kind=<k>
 *
 * A widget cannot start a drive itself — all it can do is open a URL — so
 * every widget that offers "Start Drive" points here, and this route does the
 * starting. Built as a ROUTE rather than a Linking listener because Expo
 * Router already turns an incoming URL into one, which is how auth.tsx has
 * handled the Spotify redirect since July; a hand-rolled listener would be a
 * second mechanism doing the same job.
 *
 * NOTHING IS TRUSTED FROM THE URL. A link can be stale (a station deleted
 * since the widget last drew it), hand-typed, or point at a mode that has
 * been retired — so the station is resolved and the mode goes through
 * `knownMode`, both of which fall back rather than fail. The worst case is a
 * drive on the hour's own station in the Equalizer, which is a perfectly good
 * drive; a dead end would not be.
 *
 * It renders a bare backdrop and immediately replaces itself with the home
 * tab, so backing out of the drive lands somewhere sensible instead of on a
 * blank screen that only exists to have been passed through.
 */
export default function DriveLink() {
  const params = useLocalSearchParams<{ station?: string; mode?: string; kind?: string }>();
  // The params are read once: a deep link is a single instruction, and
  // re-running it on a re-render would restart the music underneath someone.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let cancelled = false;

    (async () => {
      // A custom station may not be in the sync cache yet on a cold start,
      // which is exactly the case a widget tap creates — the app is launching
      // because of the tap.
      await loadCustomStations().catch(() => {});
      const last = await loadLastCruise().catch(() => null);
      if (cancelled) return;

      const wanted = params.station;
      // resolveAnyStation falls back to a real station for an unknown id, so
      // compare ids to find out whether the link actually named one we have.
      const station = wanted && resolveAnyStation(wanted).id === wanted
        ? wanted
        : (last?.stationId ?? defaultStationForNow());
      const mode = knownMode(params.mode ?? last?.mode ?? 'equalizer');
      // Nothing from a URL is trusted, this included: only the two words the
      // app itself uses are accepted, and anything else leaves the remembered
      // answer exactly where it was.
      const kind: SessionKind | undefined =
        params.kind === 'driving' || params.kind === 'listening' ? params.kind : undefined;

      // HAND OVER RATHER THAN OPEN HERE. The deck's host lives in the tabs
      // layout, which does not exist yet when a tap cold-starts the app into
      // this route — opening from here measured as a real session with the
      // right station and no deck on screen. See utils/driveRequest.
      requestDrive({ stationId: station, mode, kind });
      router.replace('/');
    })();

    return () => { cancelled = true; };
  }, [params.station, params.mode, params.kind]);

  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}
