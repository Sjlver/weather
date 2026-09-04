// Checks index.html's local-time helpers: per-instant zone offsets and the
// labels built from them, in particular the interval label that has to name
// both days when a 6-h interval crosses local midnight.
//
//   node --test
//
// Like plus-codes.test.mjs, the code under test is read straight out of
// index.html, so there is no copy to drift. The section only needs Intl.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url);
const html = readFileSync(new URL("../index.html", HERE), "utf8");

const START = "/* ---------------- time helpers", END = "/* ---------------- drawing";
const from = html.indexOf(START), to = html.indexOf(END);
assert.ok(from >= 0 && to > from,
  `could not find the time-helper section of index.html between ${JSON.stringify(START)} ` +
  `and ${JSON.stringify(END)} — if it moved or was renamed, update these markers`);
const { tzOffset, fromLocal, localParts, rangeLabel, compass } = await import(
  "data:text/javascript," +
  encodeURIComponent(html.slice(from, to) +
    "\nexport { tzOffset, fromLocal, localParts, rangeLabel, compass };"));

const utc = (...ymdhm) => Date.UTC(...ymdhm) / 1000;
const H = 3600;

test("offsets are taken per instant, so DST inside the window is honoured", () => {
  assert.equal(tzOffset(utc(2026, 6, 1, 12), "Europe/Berlin"), 2 * H, "CEST");
  assert.equal(tzOffset(utc(2026, 0, 1, 12), "Europe/Berlin"), 1 * H, "CET");
  assert.equal(tzOffset(utc(2026, 6, 1, 12), "Africa/Maputo"), 2 * H, "CAT, no DST");
  assert.equal(tzOffset(utc(2026, 6, 1, 12), "Asia/Kolkata"), 5.5 * H, "half-hour zone");
});

test("fromLocal inverts localParts, including on the autumn DST day", () => {
  // Berlin, 2026-10-25: 03:00 CEST becomes 02:00 CET, i.e. 01:00 UTC. The page
  // only ever converts local midnights and noons (day boundaries, day-label
  // positions), which are unambiguous; a wall-clock time in the repeated hour
  // (02:00–03:00) names two instants and is not expected to round-trip.
  for (const t of [utc(2026, 9, 24, 22), utc(2026, 9, 24, 23), utc(2026, 9, 25, 3), utc(2026, 9, 25, 11)]) {
    const p = localParts(t, "Europe/Berlin");
    const local = Date.UTC(2026, p.month, p.date, p.h, p.min) / 1000;
    assert.equal(fromLocal(local, "Europe/Berlin"), t, `round trip of ${new Date(t * 1000).toISOString()}`);
  }
  // Local midnight of the DST day (Sun 00:00 CEST = Sat 22:00 UTC) and the
  // day after (Mon 00:00 CET = Sun 23:00 UTC): the day is 25 hours long.
  assert.equal(fromLocal(Date.UTC(2026, 9, 25) / 1000, "Europe/Berlin"), utc(2026, 9, 24, 22));
  assert.equal(fromLocal(Date.UTC(2026, 9, 26) / 1000, "Europe/Berlin"), utc(2026, 9, 25, 23));
});

// The precipitation tooltip labels the interval (t-6h, t]. An evening interval
// that runs past midnight used to be labelled with the end's weekday only
// ("Sat 20:00–02:00"), which is Friday evening wearing Saturday's name.
test("interval labels name both days when the interval crosses local midnight", () => {
  const tz = "Africa/Maputo"; // UTC+2, no DST: 2026-09-05 00:00 UTC is Sat 02:00
  const sat02 = utc(2026, 8, 5, 0);
  assert.equal(rangeLabel(sat02 - 6 * H, sat02, tz), "Fri 20:00 – Sat 02:00");
  assert.equal(rangeLabel(sat02, sat02 + 6 * H, tz), "Sat 02:00–08:00");
  assert.equal(rangeLabel(sat02 + 6 * H, sat02 + 12 * H, tz), "Sat 08:00–14:00");
  // An interval ending exactly at midnight belongs to the day before it.
  const sat00 = utc(2026, 8, 4, 22);
  assert.equal(rangeLabel(sat00 - 6 * H, sat00, tz), "Fri 18:00 – Sat 00:00");
});

test("interval labels keep minutes in half-hour zones", () => {
  const t = utc(2026, 8, 5, 0); // Sat 05:30 IST
  assert.equal(rangeLabel(t - 6 * H, t, "Asia/Kolkata"), "Fri 23:30 – Sat 05:30");
});

test("interval labels use wall-clock time either side of a DST switch", () => {
  // Berlin, Sun 2026-10-25: the six real hours from 00:00 UTC to 06:00 UTC
  // read 02:00 CEST to 07:00 CET on the wall clock.
  const t = utc(2026, 9, 25, 6);
  assert.equal(rangeLabel(t - 6 * H, t, "Europe/Berlin"), "Sun 02:00–07:00");
});

test("compass points", () => {
  const cases = { 0: "N", 11: "N", 12: "NNE", 45: "NE", 90: "E", 135: "SE", 180: "S",
                  225: "SW", 270: "W", 315: "NW", 348: "NNW", 349: "N", 359.9: "N" };
  for (const [deg, name] of Object.entries(cases)) assert.equal(compass(Number(deg)), name, `${deg}°`);
});
