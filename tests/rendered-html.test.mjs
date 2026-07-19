import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function optionalPreviewFiles() {
  try {
    return await readdir(previewRoot);
  } catch {
    return [];
  }
}

test("server-renders the Mind the Map app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Mind the Map<\/title>/i);
  assert.match(html, /Mind the Map/i);
  assert.doesNotMatch(html, /Custom Tube Map Maker/i);
  assert.match(html, /\/og\.svg/i);
  assert.match(html, /Build your own London Tube network/i);
  assert.match(
    html,
    /Unofficial fan-made project\. Not affiliated with Transport for London\./i,
  );
  assert.match(html, /My Tube Line/i);
  assert.match(html, /Search for a station or tap one on the map to begin/i);
  assert.match(html, /Find station/i);
  assert.match(html, /stations selected/i);
  assert.match(html, /Selected stations/i);
  assert.match(html, /Custom lines/i);
  assert.match(html, /Change colour for My Tube Line/i);
  assert.match(html, /Rename My Tube Line/i);
  assert.match(html, /Add line/i);
  assert.match(html, /Zoom in/i);
  assert.match(html, /Centre on London/i);
  assert.match(html, /Fit current line/i);
  assert.match(html, /© OpenStreetMap contributors/i);
  assert.match(html, /Send app feedback/i);
  assert.match(html, /Mind%20the%20Map%20feedback/i);
  assert.doesNotMatch(html, /Live map/i);
  assert.doesNotMatch(html, /Report a map issue/i);
  assert.doesNotMatch(html, /Your Tube map/i);
  assert.doesNotMatch(html, /Branches/i);
  assert.doesNotMatch(html, /Active line name/i);
  assert.doesNotMatch(html, /Active line colour/i);
  assert.doesNotMatch(html, /Active branch name/i);
  assert.doesNotMatch(html, /Add branch/i);
  assert.doesNotMatch(html, /Fit current branch/i);
  assert.match(html, /https:\/\/tile\.openstreetmap\.org\//i);
  assert.match(html, /Download PNG/i);
  assert.match(html, /Baker Street/i);
  assert.match(html, /King&#x27;s Cross St Pancras/i);
  assert.match(html, /Nine Elms/i);
  assert.match(html, /Battersea Power Station/i);
  assert.match(html, /Cockfosters/i);
  assert.match(html, /South Wimbledon/i);
  assert.match(html, /Shepherd&#x27;s Bush/i);
  assert.match(html, /Heathrow Terminals 2 &amp; 3/i);
  assert.match(html, /Reading/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
  assert.doesNotMatch(html, /See the launch plan|Explore the MVP/i);
});

test("keeps local station data and removes starter preview metadata", async () => {
  const [page, layout, packageJson, stationJson, previewFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/stations.json", import.meta.url), "utf8"),
    optionalPreviewFiles(),
  ]);
  const stations = JSON.parse(stationJson);

  assert.deepEqual(previewFiles, []);
  assert.match(page, /downloadMap/);
  assert.match(page, /shareMap/);
  assert.match(page, /focusStation/);
  assert.match(page, /createNewLine/);
  assert.match(page, /activeBranch/);
  assert.doesNotMatch(page, /createNewBranch/);
  assert.doesNotMatch(page, /removeActiveBranch/);
  assert.match(page, /customLines/);
  assert.match(page, /STATION_LABEL_ZOOM/);
  assert.match(page, /showStationLabel/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  const requiredTubeLines = [
    "Bakerloo",
    "Central",
    "Circle",
    "District",
    "Hammersmith & City",
    "Jubilee",
    "Metropolitan",
    "Northern",
    "Piccadilly",
    "Victoria",
    "Waterloo & City",
    "Overground",
    "Elizabeth",
  ];
  const stationNames = stations.map((station) => station.name);

  assert.equal(stations.length >= 380, true);
  assert.equal(new Set(stationNames).size, stationNames.length);
  assert.deepEqual(
    requiredTubeLines.filter(
      (line) => !stations.some((station) => station.lines.includes(line)),
    ),
    [],
  );
  assert.equal(
    stations.every(
      (station) =>
        station.id &&
        station.name &&
        typeof station.lat === "number" &&
        typeof station.lon === "number" &&
        Array.isArray(station.lines),
    ),
    true,
  );
  assert.equal(stations.some((station) => station.name === "Cockfosters"), true);
  assert.equal(
    stations.some(
      (station) =>
        station.name === "South Wimbledon" &&
        station.lines.includes("Northern"),
    ),
    true,
  );
  assert.equal(
    stations.some(
      (station) =>
        station.name === "Uxbridge" &&
        station.lines.includes("Piccadilly") &&
        station.lines.includes("Metropolitan"),
    ),
    true,
  );
  assert.equal(
    stations.some(
      (station) =>
        station.name === "Shepherd's Bush" &&
        station.lines.includes("Central") &&
        station.lines.includes("Overground"),
    ),
    true,
  );
  assert.equal(
    stations.filter((station) => station.name.includes("Shepherd")).length,
    2,
  );
  assert.equal(
    stations.some(
      (station) =>
        station.name === "Paddington" &&
        station.lines.includes("Bakerloo") &&
        station.lines.includes("Elizabeth"),
    ),
    true,
  );
  assert.equal(stations.some((station) => station.name === "London Paddington"), false);
  assert.equal(
    stations.some(
      (station) =>
        station.name === "Heathrow Terminals 2 & 3" &&
        station.lines.includes("Piccadilly") &&
        station.lines.includes("Elizabeth"),
    ),
    true,
  );
  assert.equal(stations.some((station) => station.name === "New Cross"), true);
  assert.equal(stations.some((station) => station.name === "New Cross ELL"), false);
  assert.equal(stations.some((station) => station.name === "New Cross Gate"), true);
  assert.equal(
    stations.some(
      (station) =>
        station.id === "nine-elms" &&
        station.name === "Nine Elms" &&
        station.lines.includes("Northern"),
    ),
    true,
  );
  assert.equal(
    stations.some(
      (station) =>
        station.id === "battersea-power-station" &&
        station.name === "Battersea Power Station" &&
        station.lines.includes("Northern"),
    ),
    true,
  );
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await readFile(new URL("app/page.tsx", templateRoot), "utf8");
});
