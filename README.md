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
- Daily precipitation totals are computed member-wise first (sum each member's
  6-h values over the local day), then percentiles are taken across members.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
  the default branch.

## Development

Serve the directory with any static file server, e.g.:

```sh
python3 -m http.server
```

then open <http://localhost:8000/>.
