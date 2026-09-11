# DeepuNotes V1.2
Local-first OneNote-style iPad/PWA prototype.

## V1.2 changes
- Apple Pencil / stylus drawing uses robust Pointer Events and also accepts iPad Safari pointer input if Pencil is reported as touch.
- Incremental smooth stroke rendering with pressure-aware pen width.
- Full writing-area Focus mode.
- Explicit Blank / Ruled / Grid / Dot page controls.
- More reliable canvas sizing and page rendering.
- Versioned service-worker cache to prevent the old JavaScript from being served.
- Existing IndexedDB notebooks remain compatible with V1/V1.1.
