import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { publishWidgetData } from '@/utils/widgetData';

/**
 * Keeps the Home Screen and Lock Screen widgets in step with the app.
 *
 * THE MOMENT THAT MATTERS IS LEAVING, not arriving — a widget is only ever
 * looked at once the app is closed, so the snapshot has to be right at the
 * point someone swipes away, not refreshed on a timer while they are still
 * inside. So this publishes when the app goes to the background (the state
 * the widgets will actually be read in), and again on return, which is the
 * cheapest way to catch a schedule that rolled over while the phone sat in a
 * pocket.
 *
 * NO TIMER ANYWHERE. A repeating interval is what got the app SIGKILLed on
 * 27.07, and it would buy nothing here: WidgetKit renders the timeline this
 * snapshot already contains without waking us at all.
 *
 * Mounted once in the root layout beside AutoUpdateHost, renders nothing, and
 * does nothing at all on a build without the widget extension —
 * publishWidgetData no-ops when the native bridge is absent, which is every
 * build until the one that carries it.
 */
export function WidgetSyncHost() {
  const last = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Launch: the widgets may be showing yesterday's snapshot.
    publishWidgetData();

    const onChange = (next: AppStateStatus) => {
      const prev = last.current;
      last.current = next;
      // Leaving (active → background/inactive), or coming back. Both are worth
      // a write and neither can happen often enough to cost anything.
      if (prev === 'active' || next === 'active') publishWidgetData();
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return null;
}
