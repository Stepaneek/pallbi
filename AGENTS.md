# Architecture rules
- Keep zeroing math in lib/zeroing and reuse ZeroingTarget for entry and history; coordinate conversion must use the SVG screen matrix so recorded millimetres match the rendered target.
- Store digital shooting entries in shooting_sessions with athlete/author ownership and linked-coach RLS; retain shooting_zeroings only as deprecated legacy storage.
- Keep official Strava attribution and connection artwork in reusable StravaBadge and StravaConnectButton components backed by CDN asset pointers; this preserves original artwork and consistent theme handling.
- Render training-page attribution in AppShell and repeat it in standalone Strava charts shown inside dialogs; shared pages and obscured dialog content both need visible attribution.
