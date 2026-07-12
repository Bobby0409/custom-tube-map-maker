## 2026-07-12 - Mobile map usability deployment

Previous production deployment: `7c79c5b4-9075-4e2b-91a2-9098e54dbc69`  
Current production deployment: `c8c93314-f197-4b2d-809e-464822432401`

### User-facing release notes

This release makes the map much easier to use on mobile. Station taps are more forgiving, selected stations are clearer, the map now pans smoothly only when needed, and the mobile map controls take up much less space. Users can also quickly jump back to the latest selected station or fit the current branch on screen.

### Detailed deployment summary

#### New features

- Added compact mobile map controls for:
  - zooming in;
  - zooming out;
  - centring on the latest selected station;
  - fitting the active branch on the map.
- Added mobile nearest-station tap resolution so tapping near a station selects the closest valid station.
- Added fit-current-branch behavior for selected stations in the active branch.

#### UX improvements

- Increased mobile station tap tolerance without visually enlarging station dots.
- Preserved the existing desktop map controls and desktop interaction behavior.
- Made selected stations render above unselected stations.
- Added a clearer highlight for the most recently selected station.
- Changed station-selection camera movement so it only recentres when the selected station is near or outside the visible edge area.
- Replaced abrupt recentering with a smooth pan animation while preserving the current zoom level.
- Reduced accidental pan-vs-tap conflicts by using a larger touch movement threshold before treating a gesture as map dragging.
- Kept mobile map controls clear of the OpenStreetMap attribution area.

#### Bug fixes

- Fixed mobile station selection being too difficult because station markers had small practical tap areas.
- Fixed mobile map controls occupying too much map space.
- Fixed station selection causing unnecessary camera jumps when the station was already comfortably visible.
- Fixed synthetic/mobile click fallback so a mobile-width click near a station can still select the nearest station.

#### Technical improvements

- Added mobile breakpoint detection at `max-width: 768px`.
- Added camera animation state handling with cancellation when the user starts another map interaction.
- Added safe-area viewport logic using approximately 18% map-edge padding.
- Added current-camera refs so map gesture handlers and animation code use the latest camera state.
- Added mobile-only SVG map click handling while preserving desktop station-node click handling.
- Added responsive CSS for a compact 2x2 mobile control cluster with 44px touch targets.

#### Known limitations or follow-up work

- Full source-to-source diff against the previous production deployment could not be verified. Wrangler exposes version metadata and script etags, but not the previous deployed source bundle through `versions view`, and this workspace is not a git repository.
- The previous deployment was identified and its metadata was verified, but its previous JavaScript/CSS asset files were no longer retrievable from the current production asset path.
- Mobile browser checks were performed through the in-app browser viewport simulator and one synthetic tap test; additional real-device testing on iOS Safari and Android Chrome is still recommended before broader launch.
- The PNG export was intentionally not changed in this deployment.

### Verification

- Production URL: https://custom-tube-map-maker.mytubemap.workers.dev
- Deployment time: `2026-07-12T14:30:54.450Z` version created, deployed at approximately `2026-07-12T14:30:57.088Z` (`15:30 BST`)
- Cloudflare deployment/version identifier: `c8c93314-f197-4b2d-809e-464822432401`
- Previous production deployment/version identifier: `7c79c5b4-9075-4e2b-91a2-9098e54dbc69`
- Current script etag: `cad3f497cea418b223b860eae25d55f388c08b715dfa2b90c8d7a43126e60e84`
- Previous script etag: `dc2b9c978edde739ed78f47b67f02ab4b453bb30a5f264f49d8a6a39db533fb2`
- Git commit deployed: unavailable; the workspace is not a git repository.
- Current production HTML verified as loading deployed assets including:
  - `/assets/page-B97QDX9w.js`
  - `/assets/index-C4ptiuDB.css`
- Current deployed bundle/source verified to include:
  - `MOBILE_TAP_TARGET_RADIUS`
  - `CAMERA_SAFE_PADDING`
  - `CAMERA_ANIMATION_MS`
  - `nearestMobileStation`
  - `fitActiveBranch`
  - `Centre on latest selected station`
  - `Fit current branch`
  - mobile `.mobile-map-control` CSS
- Checks completed:
  - `npm run lint`
  - `npm test`
  - production HTTP check returned `200 OK`
  - responsive checks at `320px`, `375px`, `390px`, and `430px`
  - mobile-width tap test selected Bank and enabled the latest-station and fit-branch controls

