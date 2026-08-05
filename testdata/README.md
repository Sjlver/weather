# Test data

Captured Open-Meteo ensemble API responses. There is no automated test
harness; these document actual API behaviour that the page's time handling
relies on.

## ensemble-munich-tz-auto-2026-08-05.json

Captured 2026-08-05 (with `forecast_days=2` to keep it small) from:

    https://ensemble-api.open-meteo.com/v1/ensemble?latitude=48.1374&longitude=11.5755&hourly=temperature_2m,precipitation&models=google_weathernext2_ensemble&timeformat=unixtime&temporal_resolution=native&timezone=auto&forecast_days=2

Key observation: with `timeformat=unixtime`, `hourly.time` contains true UTC
epoch seconds regardless of the `timezone` parameter — but `timezone=auto`
re-anchors the 6-hourly grid to **local** midnight, not to the model's native
steps. The first timestamps are

    1785880800 = 2026-08-04 22:00 UTC = 2026-08-05 00:00 Europe/Berlin (UTC+2)
    1785902400 = 2026-08-05 04:00 UTC = 2026-08-05 06:00 Europe/Berlin
    …

i.e. 22:00/04:00/10:00/16:00 UTC rather than the native 00/06/12/18 UTC steps
of WeatherNext 2 — despite `temporal_resolution=native`, so these values are
resampled off the native grid. This is why `index.html` requests
`timezone=GMT` (keeping the native grid, with all local-time conversion done
client-side from the location's IANA zone) and why the chart anchors its axis
ticks on the actual data timestamps instead of assuming 6-h multiples of UTC.
