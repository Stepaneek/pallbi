# Architecture rules
- Keep official Strava attribution and connection artwork in reusable StravaBadge and StravaConnectButton components backed by CDN asset pointers; this preserves original artwork and consistent theme handling.
- Render training-page attribution in AppShell and repeat it in standalone Strava charts shown inside dialogs; shared pages and obscured dialog content both need visible attribution.
