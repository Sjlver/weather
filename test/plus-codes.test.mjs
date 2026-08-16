// Checks index.html's plus-code encoder and decoder against the official
// Open Location Code test vectors in open-location-code/.
//
//   node --test
//
// Node's built-in test runner, no package.json and no network: the page has no
// build step or dependencies, and its tests shouldn't introduce either.
//
// The functions are read out of index.html rather than kept in a copy here, so
// there is nothing to drift.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url);
const html = readFileSync(new URL("../index.html", HERE), "utf8");

const START = "const OLC_ALPHABET", END = "/* ---------------- coordinates -> place";
const from = html.indexOf(START), to = html.indexOf(END);
assert.ok(from >= 0 && to > from,
  `could not find the plus-code section of index.html between ${JSON.stringify(START)} ` +
  `and ${JSON.stringify(END)} — if it moved or was renamed, update these markers`);
const { olcEncode, olcDecode } = await import(
  "data:text/javascript," +
  encodeURIComponent(html.slice(from, to) + "\nexport { olcEncode, olcDecode };"));

const rows = (name) =>
  readFileSync(new URL(`open-location-code/${name}`, HERE), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(","));

// The integer columns, not the printed degrees, are a row's exact position.
// A few rows print coordinates that land one unit lower once parsed into a
// double, so no implementation reading the degrees can produce the listed code
// — the reference one included. Such a row is excused only when it actually
// disagrees, and the count is pinned, so this can neither hide a real bug nor
// quietly grow.
const LAT_P = 25000000, LNG_P = 8192000;
const exactInDouble = (lat, lng, latInt, lngInt) =>
  Math.floor(Number(lat) * LAT_P) + 90 * LAT_P === Number(latInt) &&
  Math.floor(Number(lng) * LNG_P) + 180 * LNG_P === Number(lngInt);

test("encodes the vectors in encoding.csv", () => {
  let checked = 0, excused = 0;
  for (const [lat, lng, latInt, lngInt, len, code] of rows("encoding.csv")) {
    const n = Number(len);
    if (n > 10 || n % 2) continue;          // the page only encodes the pair section
    const got = olcEncode(Number(lat), Number(lng), n);
    if (got !== code && !exactInDouble(lat, lng, latInt, lngInt)) { excused++; continue; }
    assert.equal(got, code, `encode(${lat}, ${lng}, ${n})`);
    checked++;
  }
  assert.ok(checked > 100, `only ${checked} rows checked`);
  assert.equal(excused, 3, `${excused} rows unreachable from their printed degrees, expected 3`);
});

test("decodes the vectors in decoding.csv to the centre of the named area", () => {
  let checked = 0;
  for (const [code, , latLo, lngLo, latHi, lngHi] of rows("decoding.csv")) {
    const got = olcDecode(code);
    assert.ok(got, `decode(${code}) returned null`);
    assert.ok(Math.abs(got.latitude - (Number(latLo) + Number(latHi)) / 2) < 1e-9 &&
              Math.abs(got.longitude - (Number(lngLo) + Number(lngHi)) / 2) < 1e-9,
              `decode(${code}) = ${got.latitude}, ${got.longitude}`);
    checked++;
  }
  assert.ok(checked > 400, `only ${checked} rows checked`);
});

// Full codes are accepted and short ones are not: a short code names an area
// relative to a reference location, which a share link has no way to carry, so
// decoding one would silently put the forecast somewhere else entirely.
test("accepts exactly the full codes in validityTests.csv", () => {
  let checked = 0;
  for (const [code, , , isFull] of rows("validityTests.csv")) {
    assert.equal(olcDecode(code) !== null, isFull === "true", `decode(${JSON.stringify(code)})`);
    checked++;
  }
  assert.ok(checked > 20, `only ${checked} rows checked`);
});

// Share links leave out the separator, which would otherwise have to be
// escaped as %2B in a query string to not mean a space.
test("accepts the separator-less form share links use", () => {
  const canonical = olcDecode("8FW4V75V+");
  for (const form of ["8FW4V75V", "8fw4v75v+", "8FW4V75V+00", "8fw4v75v", "8FW4V75V+0"]) {
    assert.deepEqual(olcDecode(form), canonical, `decode(${form})`);
  }
  assert.deepEqual(olcDecode("8FVC22"), olcDecode("8FVC2200+"), "padding may be dropped too");
});

test("rejects what isn't a code at all", () => {
  for (const bad of ["", "+", "0000", "hello", "8FW4V7 5V", "8FW4V75!", null, undefined]) {
    assert.equal(olcDecode(bad), null, `decode(${JSON.stringify(bad)})`);
  }
});

// Everything the page encodes must survive the round trip its share links make.
test("round-trips share-length codes back into the same cell", () => {
  const DIGITS = 8, CELL = 0.0025;
  let seed = 12345;                      // fixed, so a failure is reproducible
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 50000; i++) {
    const lat = rand() * 180 - 90, lng = rand() * 360 - 180;
    const code = olcEncode(lat, lng, DIGITS);
    const back = olcDecode(code);
    assert.ok(back, `decode(${code}) from ${lat}, ${lng}`);
    assert.ok(Math.abs(back.latitude - lat) <= CELL / 2 + 1e-9 &&
              Math.abs(back.longitude - lng) <= CELL / 2 + 1e-9,
              `${lat}, ${lng} -> ${code} -> ${back.latitude}, ${back.longitude}`);
    assert.equal(olcEncode(back.latitude, back.longitude, DIGITS), code,
                 `re-encoding the centre of ${code} moved it`);
  }
});

// Why SHARE_DIGITS is 8 and not 6: rounding to a 6-digit cell lands outside the
// WeatherNext 2 grid cell the exact point falls in often enough to matter.
test("share precision resolves the model's 0.25° grid cell exactly", () => {
  const cell = (lat, lng) => Math.round(lat / 0.25) + ":" + Math.round(lng / 0.25);
  let seed = 6789;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let hits8 = 0, hits6 = 0, n = 50000;
  for (let i = 0; i < n; i++) {
    const lat = rand() * 170 - 85, lng = rand() * 360 - 180;
    const at = (d) => { const c = olcDecode(olcEncode(lat, lng, d));
                        return cell(c.latitude, c.longitude) === cell(lat, lng); };
    if (at(8)) hits8++;
    if (at(6)) hits6++;
  }
  assert.equal(hits8, n, `${n - hits8} of ${n} points miss their grid cell at 8 digits`);
  assert.ok(hits6 < n * 0.9,
    `6 digits hit ${(100 * hits6 / n).toFixed(1)} % — if it is now reliable, ` +
    `SHARE_DIGITS could drop to 6 and shorten every share link`);
});
