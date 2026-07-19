# Changelog

## 2026-07-19T01:24:00.169Z

- Simplified the MVP line-building controls by removing user-facing branch creation.
- Removed the large `Your Tube map` section heading and tightened the map toolbar spacing.
- Integrated line colour and line-name editing into the `Custom lines` cards with colour-dot and pencil controls.
- Moved `Undo` and `Reset` closer to the active line controls.
- Deployed Git SHA `703f8d8307a3032d63bd0b00f8ae2453c4912bf5` to production with Cloudflare version `0ac19081-b12c-426a-a363-47482c6dd630`.
- Release notes can be verified with the Git diff listed in DEPLOYMENTS.md.

## 2026-07-19T00:13:17.082Z

- Renamed the product from `Custom Tube Map Maker` to `Mind the Map`.
- Updated page title, header, feedback email subject, share copy, README, package metadata, and rendered HTML tests for the new name.
- Updated the Cloudflare Worker name to `mindthemap`, moving production to `https://mindthemap.mytubemap.workers.dev`.
- Replaced the old branded Open Graph PNG with a text-accurate SVG social card.
- Deployed Git SHA `2e06b0418a9541551fd41de8a2ccb74b743348ef` to production with Cloudflare version `0768b3d8-8a36-4993-9b8c-3f10c20bc8d7`.
- Release notes can be verified with the Git diff listed in DEPLOYMENTS.md.

## 2026-07-12T18:47:06Z

- Updated the page header to use the product name as the main title, a new subtitle, and the visible unofficial Transport for London disclaimer.
- Replaced the old TfL-like roundel treatment with an original custom-route SVG icon.
- Renamed the workspace heading to `Your Tube map`, removed the misleading `Live map` label, and simplified map attribution to OpenStreetMap plus app feedback.
- Deployed Git SHA `5eb4d573fdfebfe74cb42264a1378bcf2a2254c7` to production with Cloudflare version `85aa3c2c-5785-4fbe-98eb-d1972118379d`.
- Production tag: `prod-2026-07-12-header-polish`.

## 2026-07-12T17:39:56Z

- Polished the pre-promotion live map copy: singular/plural counts now read naturally, selected stations are labelled clearly, and first-time users see a short prompt to search or tap the map.
- Added a dedicated app feedback link alongside the OpenStreetMap map-data links.
- Deployed Git SHA `b3c599c183e68a6ad9695a0af279254557d446eb` to production with Cloudflare version `6164e034-b975-41b5-97df-c629c5431069`.
- Note: `b7d1a99` is a reconstructed pre-polish Git baseline and has not been verified as an exact match for the previous Cloudflare production source.

## 2026-07-12T14:30:54.450Z

- Production deployment completed for the mobile map usability update.
- Cloudflare version ID: `c8c93314-f197-4b2d-809e-464822432401`
- Git SHA: `unavailable`
- Note: this entry was backfilled after deployment tracking was introduced. It cannot be treated as a complete verified Git diff because the workspace was not a Git repository at deployment time.
