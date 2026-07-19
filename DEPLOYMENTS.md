# Deployments

## 2026-07-19T01:24:00.169Z - Production deployment

- Production URL: https://mindthemap.mytubemap.workers.dev
- Cloudflare version ID: `0ac19081-b12c-426a-a363-47482c6dd630`
- Git SHA: `703f8d8307a3032d63bd0b00f8ae2453c4912bf5`
- Previous Cloudflare version ID: `0768b3d8-8a36-4993-9b8c-3f10c20bc8d7`
- Previous Git SHA: `2e06b0418a9541551fd41de8a2ccb74b743348ef`
- Verified diff command: `git diff --stat 2e06b0418a9541551fd41de8a2ccb74b743348ef..703f8d8307a3032d63bd0b00f8ae2453c4912bf5`
- Wrangler command: `npx wrangler deploy --config wrangler.json` from `dist/server`
- Validation: `npm run lint`, `npm test`, `npm run build`, production HTTP 200 check.
- Smoke test: production showed the compact map toolbar with no `Your Tube map` heading; user-facing branch controls were absent; line cards exposed `Change colour for My Tube Line` and `Rename My Tube Line`; `Undo` and `Reset` appeared inside the `Custom lines` section.

## 2026-07-19T00:13:17.082Z - Production deployment

- Production URL: https://mindthemap.mytubemap.workers.dev
- Cloudflare version ID: `0768b3d8-8a36-4993-9b8c-3f10c20bc8d7`
- Git SHA: `2e06b0418a9541551fd41de8a2ccb74b743348ef`
- Previous Cloudflare version ID: `85aa3c2c-5785-4fbe-98eb-d1972118379d`
- Previous Git SHA: `5eb4d573fdfebfe74cb42264a1378bcf2a2254c7`
- Verified diff command: `git diff --stat 5eb4d573fdfebfe74cb42264a1378bcf2a2254c7..2e06b0418a9541551fd41de8a2ccb74b743348ef`
- Wrangler command: `npx wrangler deploy --config wrangler.json` from `dist/server`
- Validation: `npm run lint`, `npm test`, `npm run build`, production HTTP 200 check.
- Smoke test: production showed `Mind the Map` as the main title, metadata and canonical URLs pointed at `https://mindthemap.mytubemap.workers.dev/`, the new `/og.svg` social card returned HTTP 200, and the old `/og.png` returned HTTP 404.

## 2026-07-12T18:47:06Z - Production deployment

- Production URL: https://custom-tube-map-maker.mytubemap.workers.dev
- Cloudflare version ID: `85aa3c2c-5785-4fbe-98eb-d1972118379d`
- Git SHA: `5eb4d573fdfebfe74cb42264a1378bcf2a2254c7`
- Git tag: `prod-2026-07-12-header-polish`
- Previous production Git SHA: `b3c599c183e68a6ad9695a0af279254557d446eb`
- Verified diff command: `git diff --stat b3c599c183e68a6ad9695a0af279254557d446eb..5eb4d573fdfebfe74cb42264a1378bcf2a2254c7`
- Wrangler command: `npx wrangler deploy --config wrangler.json` from `dist/server`
- Validation: repository path, branch, clean worktree, local HEAD and `origin/main` SHA checks; staged-file review; targeted secret scan; `npm run lint`; `npm test`; `npm run build`; production HTTP 200 check.
- Smoke test: production showed `Custom Tube Map Maker` as the main title, `Build your own London Tube network`, the original custom-route SVG icon, no `.roundel` element, no `Live map`, `Your Tube map`, no `Report a map issue`, linked `© OpenStreetMap contributors`, `Send app feedback`, and the visible unofficial Transport for London disclaimer.
- Workflow smoke test: production line building created `Line 2`; branch building created `Branch 2`; selecting Baker Street and Bond Street showed `2 stations selected`; PNG export was enabled and the app reported `PNG downloaded.`
- Mobile smoke test: checked `430px`, `390px`, `375px`, and `320px`; no horizontal overflow; header did not overlap workspace; title, subtitle, and `Your Tube map` remained single-line; attribution stayed inside the map and did not overlap controls.
- Smoke-test limitation: the in-app browser did not emit a download event for the programmatic PNG download, so export verification is based on the app success state and absence of console errors rather than an inspected downloaded file.

## 2026-07-12T17:39:56Z - Production deployment

- Production URL: https://custom-tube-map-maker.mytubemap.workers.dev
- Cloudflare version ID: `6164e034-b975-41b5-97df-c629c5431069`
- Git SHA: `b3c599c183e68a6ad9695a0af279254557d446eb`
- Git tag: none
- Previous Git baseline: `b7d1a99` (`Initial unverified Git baseline`)
- Verified diff command: `git diff --stat b7d1a99..b3c599c183e68a6ad9695a0af279254557d446eb`
- Limitation: `b7d1a99` is a reconstructed pre-polish local baseline and has not been verified as an exact match for the previous Cloudflare production source, so this deployment record must not be treated as a complete verified diff against the previous production deployment.
- Wrangler command: `npx wrangler deploy --config wrangler.json` from `dist/server`
- Validation: repository path, branch, clean worktree, local HEAD and `origin/main` SHA checks; `npm run lint`; `npm test`; `npm run build`; production HTTP 200 check.
- Smoke test: production copy showed `1 line`, `0 stations selected`, the first-action hint, and `Send app feedback`; interactive station selection added Baker Street and Bond Street, showed `2 stations selected`, enabled `Download PNG`, and the app reported `PNG downloaded.`
- Smoke-test limitation: the in-app browser did not emit a download event for the programmatic PNG download, so export verification is based on the app success state and absence of console errors rather than an inspected downloaded file.

## 2026-07-12T14:30:54.450Z - Production deployment

- Production URL: https://custom-tube-map-maker.mytubemap.workers.dev
- Cloudflare version ID: `c8c93314-f197-4b2d-809e-464822432401`
- Git SHA: `unavailable`
- Previous Cloudflare version ID: `7c79c5b4-9075-4e2b-91a2-9098e54dbc69`
- Previous Git SHA: `unavailable`
- Verified diff command: unavailable; this deployment happened before Git deployment tracking was introduced.
- Limitation: release notes for this deployment are not a complete verified Git diff because the workspace was not a Git repository at deployment time.
- Verification: `npm run lint`, `npm test`, production HTTP 200 check, mobile viewport checks at `320px`, `375px`, `390px`, and `430px`.
