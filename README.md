# WeatherNext ensemble

A small personal weather page showing the [Google DeepMind WeatherNext 2
ensemble](https://open-meteo.com/en/docs/ensemble-api) forecast via
[Open-Meteo](https://open-meteo.com/): temperature, 6-hourly precipitation and
10 m wind with uncertainty bands (median and 10–90 % interval across the 64
ensemble members), plus per-day precipitation totals.

Live at <https://dev.purpureus.net/weather>.

## Design notes

- A single static `index.html`, no build step and no runtime dependencies (the
  tests need only a stock `node`). Network
  requests go to Open-Meteo (the forecast, place search, and the time zone of a
  bare coordinate) and to Nominatim (the name of a bare coordinate).
- Fonts are self-hosted ([Inter](https://rsms.me/inter/), SIL OFL 1.1, see
  `fonts/OFL.txt`).
- All times are shown in the forecast location's local time. The IANA time
  zone comes from the geocoding result, from the browser for "use my location",
  or — for a shared link, which is routinely opened from a different zone than
  it points at — from a small `timezone=auto` request to the forecast API.
  That request is handed to `loadForecast` unresolved so it runs alongside the
  much larger ensemble download, which is the only thing that has to finish
  before the zone is needed. Per-timestamp offsets are computed with `Intl.DateTimeFormat` — the
  API's single `utc_offset_seconds` is not trusted, since it can be missing
  and is wrong across a DST change inside the forecast window.
- Coordinates get a name. "Use my location" and shared links are labelled with
  the coordinates (or the plus code) to start with, and relabelled once
  Nominatim's reverse geocoder answers. The forecast never waits on that
  request, and a lookup that fails just leaves the coordinates showing.
  Open-Meteo's own geocoding API is forward-only, so this is the one request
  the page makes to a service other than Open-Meteo
  ([open-meteo#698](https://github.com/open-meteo/open-meteo/discussions/698)).
- "Share this location" hands over a link like `?at=8FW4V75V`, carrying an
  [Open Location Code](https://github.com/google/open-location-code) ("plus
  code"). Opening one decodes the code, looks up the location's name and time
  zone, and stores it exactly like a place picked from the search box — then
  drops the parameter from the address bar, so a later reload shows whatever
  the visitor last chose rather than snapping back to the link. The `+`
  separator is left out of the URL, where it would have to be escaped as `%2B`
  to not mean a space; the decoder puts it back, and also takes full-length
  codes pasted from elsewhere.
- Plus codes are encoded and decoded in the page (~40 lines): the format is a
  published spec, and pulling in a library would be more code than the thing
  it does. The share precision is eight digits, 0.0025° ≈ 280 m. WeatherNext 2
  runs on a 0.25° grid, so the *forecast* alone would be happy with six digits
  (0.05° ≈ 5 km) — but rounding that coarsely still lands in a neighbouring
  grid cell about a fifth of the time, and it hands the reverse geocoder a
  point that can sit in the next town. Encoding scales the signed coordinate
  before shifting it positive, as the reference implementation does; the other
  order rounds a hair the wrong way at cell boundaries and drops codes a whole
  cell south. `test/` checks all of this against the official test vectors;
  both of those subtleties were found that way, and both are still caught if
  reintroduced.
- The forecast is requested with `timezone=GMT`, not `timezone=auto`: `auto`
  re-anchors the 6-hourly grid to local midnight and hands out the native
  values relabelled onto it, i.e. a few hours stale (see `testdata/`). With
  GMT the native grid is kept and only the *display* is converted to local
  time, so tick and tooltip hours land on the same instants (e.g. 02/08/14/20
  in CEST).
- Daily precipitation totals are computed member-wise first (sum each member's
  6-h values over the local day), then percentiles are taken across members.
- Wind is the 10 m wind, which is what matters on the ground and what the
  Beaufort scale and tropical-cyclone categories are defined on. WeatherNext 2
  outputs it as u/v components; Open-Meteo derives `wind_speed_10m` and
  `wind_direction_10m` from them, and has no gust field for this model, so
  none is shown. Speed gets the same median + 10–90 % band as temperature.
  Direction is one arrow per time step above the plot, pointing *downwind*
  like streamlines on a weather map, from the mean of the members' wind
  *vectors* — averaging the angles would turn 350° and 10° into south. Dashed
  reference lines mark Beaufort 8 (62 km/h, gale / tropical-storm strength)
  and 12 (118 km/h, hurricane force) once the scale reaches them. The values
  are 0.25° grid-cell averages, so a cyclone's eyewall winds and any gusts
  run higher than the chart shows; the footer says so.
- Hovering a chart picks the nearest time step for the instantaneous series
  (temperature, wind) and the containing interval for precipitation; the index
  is shared, so all three charts show the same instant. Precipitation
  intervals are labelled with the weekday of each end when they cross local
  midnight ("Fri 20:00 – Sat 02:00"), not just the end's.
- Axis labels adapt to the chart width: hour labels thin out (and disappear on
  phone-width screens), day labels shrink from "Tue 4 Aug" to "Tue 4" to "Tu".
- The page is an installable web app ("Add to Home screen" on Android):
  `manifest.webmanifest` + icons in `icons/` + a minimal network-first service
  worker (`sw.js`). The PNG icons are rendered from `icons/icon.svg` with
  headless Chromium (512/192 rounded, 512 full-bleed maskable, 180 square for
  `apple-touch-icon`).
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
  the default branch.

## Development

Serve the directory with any static file server, e.g.:

```sh
python3 -m http.server
```

then open <http://localhost:8000/>.

Note that the page registers a service worker (needed for Android install).
It fetches network-first, so a normal reload always picks up local edits; use
DevTools → Application → Service workers → Unregister if it gets in the way.

### Tests

```sh
node --test
```

The tests read the functions straight out of `index.html` — there is no copy
to drift. No package.json, no network, nothing to install.

- `test/plus-codes.test.mjs` runs the plus-code encoder and decoder against
  the encoding, decoding and validity vectors vendored into
  `test/open-location-code/`.
- `test/time.test.mjs` covers the local-time helpers: per-instant zone
  offsets (DST inside the window, half-hour zones), the local-midnight
  arithmetic on a 25-hour DST day, and the interval labels.
- `test/forecast.test.mjs` runs the forecast processing (percentiles, the
  mean wind vector, daily totals) over the captured API responses in
  `testdata/`, and pins down what those captures show about the API.

Only this arithmetic is covered, because it is the part that is easy to get
subtly and invisibly wrong. The drawing was checked by driving the page in a
browser with the forecast request stubbed; that suite needs Playwright and a
CI runner to be worth keeping, so it is not committed.
