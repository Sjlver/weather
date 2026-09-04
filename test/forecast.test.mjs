// Runs index.html's forecast processing over the captured API responses in
// testdata/, and pins down what those captures show about the API.
//
//   node --test
//
// Like the other tests, the code under test is read straight out of
// index.html: the sections it needs are pure (no fetch, no DOM).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url);
const html = readFileSync(new URL("../index.html", HERE), "utf8");

// A section runs from its "/* ---------------- name" banner to the next one.
const section = (name) => {
  const start = html.indexOf(`/* ---------------- ${name}`);
  assert.ok(start >= 0, `could not find the "${name}" section of index.html — if it was renamed, update this`);
  const end = html.indexOf("/* ----------------", start + 1);
  return html.slice(start, end < 0 ? undefined : end);
};
const { processForecast, quantile } = await import(
  "data:text/javascript," +
  encodeURIComponent(["percentiles", "process", "time helpers"].map(section).join("\n") +
    "\nexport { processForecast, quantile };"));

const capture = (name) => JSON.parse(readFileSync(new URL(`../testdata/${name}`, HERE), "utf8"));
const maputo = capture("ensemble-maputo-gmt-2026-09-04.json");
const TZ = "Africa/Maputo"; // UTC+2, no DST
const hourUTC = (t) => (t / 3600) % 24;

test("quantile interpolates between order statistics (numpy's default)", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([1, 2, 3, 4], 0.1), 1.3);
  assert.equal(quantile([1, 2, 3, 4], 0.9), 3.7);
  assert.equal(quantile([5], 0.9), 5);
  assert.ok(Number.isNaN(quantile([], 0.5)));
});

test("the page's request comes back as 64 members per variable on the 00/06/12/18 UTC grid", () => {
  const d = processForecast(maputo, TZ);
  assert.equal(d.nMembers, 64);
  assert.deepEqual(d.times.map(hourUTC), [0, 6, 12, 18, 0, 6, 12, 18]);
  assert.equal(d.tempUnit, "°C");
  assert.equal(d.precUnit, "mm");
  assert.equal(d.windUnit, "km/h");
  assert.ok(d.wind, "wind series present");
  for (const [name, s] of Object.entries({ temp: d.temp, prec: d.prec, wind: d.wind })) {
    for (let i = 0; i < d.times.length; i++) {
      assert.ok(s.lo[i] <= s.p50[i] && s.p50[i] <= s.hi[i], `${name} percentiles ordered at step ${i}`);
    }
  }
  assert.ok(d.prec.prob.every((p) => p >= 0 && p <= 1));
  assert.ok(d.wind.lo.every((v) => v >= 0));
});

test("wind direction is the mean wind vector, so members straddling north average to north", () => {
  const d = processForecast(maputo, TZ);
  // At the first step the members blow from between 306° and 14°, through
  // north; the control member says 329°. The arithmetic mean of the angles
  // is 312°, dragged towards west by the members just past 360°.
  const dirs = Object.keys(maputo.hourly)
    .filter((k) => k.startsWith("wind_direction_10m")).map((k) => maputo.hourly[k][0]);
  const arithmetic = dirs.reduce((a, b) => a + b) / dirs.length;
  assert.ok(arithmetic < 320, `arithmetic mean is ${arithmetic}: the capture no longer straddles north`);
  assert.ok(d.wind.dir[0] > 340 && d.wind.dir[0] < 352, `vector mean ${d.wind.dir[0]}`);
  // Where the members agree, the two means agree too.
  assert.ok(Math.abs(d.wind.dir[1] - 170) < 2, `step 1: ${d.wind.dir[1]}`);
});

test("each 6-h interval goes to the local day of its midpoint", () => {
  const d = processForecast(maputo, TZ);
  // The interval ending 00:00 UTC on the 4th ends 02:00 local, so its
  // midpoint is 23:00 local on the 3rd. Two days of steps thus become a
  // partial 3rd (one interval), a full 4th and a partial 5th (three).
  assert.deepEqual(d.daily.map((x) => [x.label, x.partial]),
    [["Thu 3 Sep", true], ["Fri 4 Sep", false], ["Sat 5 Sep", true]]);
  // The full day's median is the median of the members' own sums over the
  // four intervals whose midpoints fall on the 4th (steps 1–4).
  const sums = Object.keys(maputo.hourly).filter((k) => k.startsWith("precipitation"))
    .map((k) => [1, 2, 3, 4].reduce((sum, i) => sum + maputo.hourly[k][i], 0))
    .sort((a, b) => a - b);
  assert.ok(Math.abs(d.daily[1].p50 - quantile(sums, 0.5)) < 1e-9);
  assert.ok(d.daily[1].lo <= d.daily[1].p50 && d.daily[1].p50 <= d.daily[1].hi);
});

test("a response without wind leaves the wind series out rather than failing", () => {
  const json = { hourly_units: {}, hourly: {} };
  for (const k of Object.keys(maputo.hourly)) {
    if (!k.startsWith("wind")) { json.hourly[k] = maputo.hourly[k]; json.hourly_units[k] = maputo.hourly_units[k]; }
  }
  // …and the shape an unsupported variable arrives in: null values, no error.
  json.hourly.wind_speed_10m = maputo.hourly.time.map(() => null);
  json.hourly_units.wind_speed_10m = "undefined";
  const d = processForecast(json, TZ);
  assert.equal(d.wind, null);
  assert.equal(d.nMembers, 64);
  assert.equal(d.temp.p50.length, 8);
});

// Why the page asks for timezone=GMT: captured minutes apart, the same
// request with timezone=auto carries the same numbers on a shifted grid.
test("timezone=auto relabels the native steps instead of keeping them", () => {
  const auto = capture("munich-tz-auto-2026-09-04.json");
  const gmt = capture("munich-tz-gmt-2026-09-04.json");
  assert.deepEqual(gmt.hourly.time.map(hourUTC), [0, 6, 12, 18]);
  // Local midnight in CEST, then 6-h steps — despite temporal_resolution=native.
  assert.equal(auto.timezone, "Europe/Berlin");
  assert.deepEqual(auto.hourly.time.map(hourUTC), [22, 4, 10, 16]);
  // The values are not interpolated onto that grid: what auto labels 04:00
  // UTC is, member for member, the native 00:00 UTC value — four hours stale.
  for (const k of Object.keys(gmt.hourly)) {
    if (k === "time") continue;
    assert.deepEqual(auto.hourly[k].slice(1), gmt.hourly[k].slice(0, 3), k);
  }
});
