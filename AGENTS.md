# Architecture rules
- Keep zeroing math in lib/zeroing and reuse ZeroingTarget for entry and history; coordinate conversion must use the SVG screen matrix so recorded millimetres match the rendered target.
- Store digital shooting entries in shooting_sessions with athlete/author ownership and linked-coach RLS; retain shooting_zeroings only as deprecated legacy storage.
- Derive digital hit/miss counts in generated database columns and merge digital entries with block shooting sets only when reading analytics; this keeps statistics synchronized without duplicating diary records. Use actual digital shot counts and leave missing timings absent.
- Keep official Strava attribution and connection artwork in reusable StravaBadge and StravaConnectButton components backed by CDN asset pointers; this preserves original artwork and consistent theme handling.
- Render training-page attribution in AppShell and repeat it in standalone Strava charts shown inside dialogs; shared pages and obscured dialog content both need visible attribution.
- Keep the page canvas in a dedicated --canvas token and reserve --background for white surfaces (inputs, dialogs, popovers, active tabs); this lets light mode use a grey canvas without greying form controls, and both themes stay token-driven.
