# Mind the Map

Create a fictional London Tube line from real stations, choose a colour, name it,
and export the finished map as a PNG.

## MVP

- Interactive station map with local JSON station data
- Click stations to build a custom line in order
- Tube-style colour swatches and a free colour picker
- Line name, selected station list, undo, reset, PNG download, and native share
- No live TfL API calls during normal app usage

## Station Data

The app ships with `app/data/stations.json`. To regenerate it from TfL data:

```bash
npm run data:stations
```

That script fetches station data once from TfL, simplifies it into the local
`Station` shape, and writes the JSON file used by the app.

## Development

```bash
npm install
npm run dev
npm run build
npm test
```

The site is built with vinext, Next.js, React, TypeScript, and Tailwind CSS.

## Production Deployment

Production deploys should go through the guarded deployment command:

```bash
npm run deploy:production
```

The command intentionally fails unless the workspace is a Git repository and
the working tree is clean. This keeps each Cloudflare deployment mapped to an
exact Git SHA so release notes can be verified with a real Git diff.

The deployment flow is:

1. Confirm Git history exists.
2. Confirm there are no unintended uncommitted changes.
3. Record the current Git commit SHA.
4. Look up the previous production Git SHA from `DEPLOYMENTS.md`.
5. Show the actual Git diff from the previous production SHA to the new SHA.
6. Run validation with `npm run lint` and `npm test`.
7. Deploy with Wrangler.
8. Parse and record the new Cloudflare version ID.
9. Update `DEPLOYMENTS.md` and `CHANGELOG.md` only after deployment succeeds.

If a previous Cloudflare deployment cannot be mapped to a Git commit, release
notes must clearly state that limitation and must not claim to be a complete
verified diff.
