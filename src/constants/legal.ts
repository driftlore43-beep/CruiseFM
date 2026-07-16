/** Single source of truth for the legal documents. The in-app Privacy pages
 * and the hosted HTML copies (docs/legal/) are both generated from this. */

export type LegalSection = { heading: string; body: string };
export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] };

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy Policy',
  updated: '16 July 2026',
  intro:
    'Cruise FM is a driving-companion music app. The short version: there is no Cruise FM account, there are no Cruise FM servers, and your data stays on your phone.',
  sections: [
    {
      heading: 'What stays on your device',
      body:
        'Your display name, preferences (theme, data saver, notification choices), drive statistics, custom stations, linked playlists and your Spotify connection are stored only on your device. Cruise FM has no server and never uploads them anywhere. Deleting the app deletes all of it.',
    },
    {
      heading: 'Spotify connection',
      body:
        'If you connect Spotify, you sign in on Spotify’s own page — Cruise FM never sees your password. Spotify gives the app a token, stored only on your device, used to control playback and read your playlists so drives can play your music. You can disconnect at any time in Profile, and you can also revoke access at spotify.com under Apps. Your use of Spotify is governed by Spotify’s own terms and privacy policy.',
    },
    {
      heading: 'Purchases',
      body:
        'Cruise FM Premium is billed through the Apple App Store or Google Play. Payment is handled entirely by them — Cruise FM never sees your card details. Subscription status may be processed by RevenueCat, our billing infrastructure provider, which receives only an anonymous purchase record (never your identity or payment details).',
    },
    {
      heading: 'Analytics and advertising',
      body: 'None. Cruise FM contains no analytics, no trackers and no advertising.',
    },
    {
      heading: 'Children',
      body: 'Cruise FM is not directed at children under 13 and does not knowingly collect information from them (it collects no personal information from anyone).',
    },
    {
      heading: 'Deleting your data',
      body:
        'Everything lives on your device, so deleting the app (or clearing its storage) removes all of it. To sever the Spotify connection completely, also remove Cruise FM under Apps in your Spotify account settings.',
    },
    {
      heading: 'Changes to this policy',
      body:
        'If Cruise FM ever changes how it handles data — for example if optional accounts are added — this policy will be updated and the change highlighted in the app before it applies to you.',
    },
    {
      heading: 'Contact',
      body: 'Questions about privacy: driftlore43@gmail.com.',
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDoc = {
  title: 'Terms of Service',
  updated: '16 July 2026',
  intro:
    'These terms cover your use of the Cruise FM app. Using the app means you accept them.',
  sections: [
    {
      heading: 'What Cruise FM is',
      body:
        'Cruise FM is a visual companion for music you already have: mood stations, cinematic visual modes and drive statistics. Music playback control requires your own Spotify Premium subscription; Cruise FM does not stream, host or sell music.',
    },
    {
      heading: 'Drive safely',
      body:
        'Cruise FM is designed to be set up before you drive and then left alone. Never look at, touch or interact with the app while driving. Set your station and mode while parked, keep your eyes on the road, and always follow local traffic laws. You are solely responsible for driving safely; Cruise FM accepts no liability for accidents arising from use of a phone while driving.',
    },
    {
      heading: 'Cruise FM Premium',
      body:
        'Premium is an optional monthly subscription billed through the Apple App Store or Google Play. It renews automatically until cancelled in your store’s subscription settings. Prices are shown in the app before purchase; refunds are handled by Apple or Google under their policies.',
    },
    {
      heading: 'Your music',
      body:
        'Your playlists and music remain yours (and Spotify’s, under their terms). Cruise FM claims no rights over them. Your use of Spotify through Cruise FM must comply with Spotify’s terms of use.',
    },
    {
      heading: 'Cruise FM’s property',
      body:
        'The app, its design, branding, logo and visual modes belong to Cruise FM. You may not copy, resell or redistribute them.',
    },
    {
      heading: 'No warranty',
      body:
        'Cruise FM is provided as-is. We work hard to keep it reliable, but we cannot promise uninterrupted or error-free operation, and to the maximum extent permitted by law we are not liable for indirect or consequential losses from using the app.',
    },
    {
      heading: 'Changes',
      body:
        'These terms may be updated as the app evolves; material changes will be highlighted in the app. Continuing to use Cruise FM after a change means you accept the updated terms.',
    },
    {
      heading: 'Contact',
      body: 'Questions about these terms: driftlore43@gmail.com.',
    },
  ],
};
