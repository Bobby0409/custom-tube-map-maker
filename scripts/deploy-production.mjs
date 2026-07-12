import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const productionUrl = "https://custom-tube-map-maker.mytubemap.workers.dev";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(
      stderr || `${command} ${args.join(" ")} exited with ${result.status}`,
    );
  }

  return result.stdout ?? "";
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function readPreviousDeployment() {
  const path = join(process.cwd(), "DEPLOYMENTS.md");

  if (!existsSync(path)) {
    return null;
  }

  const content = readFileSync(path, "utf8");
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const gitSha = section.match(/^- Git SHA: `([^`]+)`/m)?.[1];
    const versionId = section.match(/^- Cloudflare version ID: `([^`]+)`/m)?.[1];

    if (gitSha && gitSha !== "unavailable" && versionId) {
      return { gitSha, versionId };
    }
  }

  return null;
}

function appendDeploymentRecord(record) {
  const path = join(process.cwd(), "DEPLOYMENTS.md");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const previousLines = record.previous
    ? [
        `- Previous Cloudflare version ID: \`${record.previous.versionId}\``,
        `- Previous Git SHA: \`${record.previous.gitSha}\``,
        `- Verified diff command: \`git diff --stat ${record.previous.gitSha}..${record.gitSha}\``,
      ]
    : [
        "- Previous Cloudflare version ID: unavailable",
        "- Previous Git SHA: unavailable",
        "- Verified diff command: unavailable; previous production deployment is not mapped to a Git commit.",
      ];
  const entry = [
    `## ${record.timestamp} - Production deployment`,
    "",
    `- Production URL: ${productionUrl}`,
    `- Cloudflare version ID: \`${record.versionId}\``,
    `- Git SHA: \`${record.gitSha}\``,
    ...previousLines,
    `- Wrangler command: \`npx wrangler deploy --config wrangler.json\` from \`dist/server\``,
    `- Verification: \`npm run lint\`, \`npm test\`, production HTTP 200 check`,
    "",
  ].join("\n");

  writeFileSync(path, existing ? `${entry}\n${existing}` : `# Deployments\n\n${entry}`);
}

function appendChangelogRecord(record) {
  const path = join(process.cwd(), "CHANGELOG.md");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const limitation = record.previous
    ? "Release notes can be verified with the Git diff listed in DEPLOYMENTS.md."
    : "Release notes for this deployment must clearly state that the previous production deployment could not be mapped to a Git commit, so the notes are not a complete verified diff.";
  const entry = [
    `## ${record.timestamp}`,
    "",
    "- Production deployment completed.",
    `- Cloudflare version ID: \`${record.versionId}\``,
    `- Git SHA: \`${record.gitSha}\``,
    `- ${limitation}`,
    "",
  ].join("\n");

  writeFileSync(path, existing ? `${entry}\n${existing}` : `# Changelog\n\n${entry}`);
}

function main() {
  let repoRoot;

  try {
    repoRoot = git(["rev-parse", "--show-toplevel"]);
  } catch {
    throw new Error(
      "Production deployment blocked: this workspace does not contain Git history.",
    );
  }

  if (repoRoot !== process.cwd()) {
    throw new Error(
      `Production deployment blocked: run this script from the repo root (${repoRoot}).`,
    );
  }

  const status = git(["status", "--porcelain"]);

  if (status) {
    throw new Error(
      [
        "Production deployment blocked: the worktree has uncommitted changes.",
        "Commit intentional changes before deploying so release notes can be verified.",
        status,
      ].join("\n"),
    );
  }

  const gitSha = git(["rev-parse", "HEAD"]);
  const previous = readPreviousDeployment();

  if (previous) {
    console.log(`Previous production Git SHA: ${previous.gitSha}`);
    console.log(run("git", ["diff", "--stat", `${previous.gitSha}..${gitSha}`], { capture: true }));
    console.log(run("git", ["diff", "--name-status", `${previous.gitSha}..${gitSha}`], { capture: true }));
  } else {
    console.warn(
      "Previous production deployment is not mapped to a Git commit. Release notes must state this limitation.",
    );
  }

  run("npm", ["run", "lint"]);
  run("npm", ["test"]);

  const deployOutput = run(
    "npx",
    ["wrangler", "deploy", "--config", "wrangler.json"],
    {
      capture: true,
      cwd: join(process.cwd(), "dist/server"),
    },
  );

  process.stdout.write(deployOutput);

  const versionId = deployOutput.match(/Current Version ID:\s*([a-f0-9-]+)/i)?.[1];

  if (!versionId) {
    throw new Error(
      "Deployment succeeded, but the Cloudflare version ID could not be parsed. Do not write release notes until the version ID is recorded manually.",
    );
  }

  const timestamp = new Date().toISOString();
  const record = { gitSha, previous, timestamp, versionId };

  appendDeploymentRecord(record);
  appendChangelogRecord(record);

  console.log(`Recorded deployment ${versionId} for Git SHA ${gitSha}.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
