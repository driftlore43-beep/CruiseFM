/**
 * Take the push-notification entitlement back out.
 *
 * WHY THIS EXISTS. `expo-notifications` applies its own iOS config plugin
 * automatically (it is in package.json, so Expo picks it up without being
 * listed in `plugins`), and that plugin sets `aps-environment` unconditionally
 * — see node_modules/expo-notifications/plugin/build/withNotificationsIOS.js.
 * That entitlement is for REMOTE push, which needs the Push Notifications
 * capability enabled on the Apple app ID and a provisioning profile that
 * carries it. Ours does not, so build 24 died at the Xcode step with:
 *
 *   Provisioning profile "...AppStore..." doesn't include the Push
 *   Notifications capability / doesn't include the aps-environment entitlement
 *
 * Cruise FM's notifications are entirely LOCAL — scheduled on the phone by
 * src/utils/notifications.ts, no server, no push tokens, nothing leaving the
 * device, which is exactly what the Privacy page promises. Local notifications
 * need no entitlement at all. So the fix is to drop the entitlement rather
 * than to enable a capability the app will never use: enabling it would mean
 * an Apple-side change, a new profile, and a push capability on the listing
 * for a feature that does not exist.
 *
 * ORDER MATTERS. Auto-applied plugins run before the ones named in app.json,
 * so listing this LAST is what lets it undo the entitlement. If notifications
 * ever do become remote, delete this file — do not work around it.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
