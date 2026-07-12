# Deployments

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
