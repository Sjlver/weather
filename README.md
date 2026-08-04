# WeatherNext ensemble

A small personal weather page showing the [Google DeepMind WeatherNext 2
ensemble](https://open-meteo.com/en/docs/ensemble-api) forecast via
[Open-Meteo](https://open-meteo.com/): temperature and 6-hourly precipitation
with uncertainty bands (median and 10–90 % interval across the 64 ensemble
members), plus per-day precipitation totals.

Live at <https://dev.purpureus.net/weather>.

## Design notes

- A single static `index.html`, no build step and no dependencies. The only
  network requests the page makes are to Open-Meteo (forecast + geocoding).
- Fonts are self-hosted ([Inter](https://rsms.me/inter/), SIL OFL 1.1, see
  `fonts/OFL.txt`).
- All times are shown in the forecast location's local time. The IANA time
  zone comes from the geocoding result (or the browser for "use my location"),
  and per-timestamp offsets are computed with `Intl.DateTimeFormat` — the
  API's single `utc_offset_seconds` is not trusted, since it can be missing
  and is wrong across a DST change inside the forecast window.
- Daily precipitation totals are computed member-wise first (sum each member's
  6-h values over the local day), then percentiles are taken across members.
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
