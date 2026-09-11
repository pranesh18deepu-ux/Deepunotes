# DeepuNotes V1
iPad-first local notebook prototype.

Included:
- Notebook / section / page hierarchy
- Apple Pencil pointer-based handwriting canvas
- Pen, highlighter, eraser
- Typed text boxes
- Ruled/grid/dot backgrounds
- Undo/redo
- IndexedDB local persistence
- Offline PWA service worker
- .deepunotes JSON backup/restore

Important:
This V1 does NOT yet implement PDF import/annotation/export. Those should be V2.

For best iPad use, serve the folder from HTTPS or localhost; opening index.html directly from Files may prevent the service worker/PWA features from working.


## V1.1 Pencil fix
This version improves Apple Pencil support on iPad Safari/PWA using robust Pointer Events,
pointer capture, coalesced Pencil points, pointer cancellation handling, and a versioned
service-worker cache so the updated JavaScript is loaded.
