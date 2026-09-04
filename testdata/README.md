# Test data

Captured Open-Meteo ensemble API responses. `test/forecast.test.mjs` runs the
page's processing over them, and they document API behaviour that the page's
time handling relies on. All three were captured on 2026-09-04, minutes apart,
from the 00 UTC run.

## ensemble-maputo-gmt-2026-09-04.json

The request the page makes, with `forecast_days=2` to keep it small:

    https://ensemble-api.open-meteo.com/v1/ensemble?latitude=-25.9692&longitude=32.5732&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&models=google_weathernext2_ensemble&temporal_resolution=native&timeformat=unixtime&timezone=GMT&forecast_days=2

What it shows: 64 series per variable (`temperature_2m` plus
`temperature_2m_member01` … `_member63`, likewise for the others), units
°C / mm / km/h / °, timestamps on the model's native 00/06/12/18 UTC steps,
and the coordinate snapped to its 0.25° grid cell (−26.0, 32.5). At the first
step the members' wind directions run from 306° through north to 14° — the
case the mean-vector direction in `index.html` exists for: the arithmetic mean
of those angles is 312°, the vector mean 347°.

## munich-tz-auto-2026-09-04.json, munich-tz-gmt-2026-09-04.json

The same request for Munich (48.1374, 11.5755) with `hourly=temperature_2m`
and `forecast_days=1`, once with `timezone=auto` and once with `timezone=GMT`.

With GMT the timestamps are the native steps, 00/06/12/18 UTC. With auto they
are 22/04/10/16 UTC — local midnight in CEST, then 6-hour steps — despite
`temporal_resolution=native`. And the values are not interpolated onto that
grid: every member's value labelled 04:00 UTC is exactly its 00:00 UTC value
from the GMT response, 10:00 is 06:00, and so on. Each labelled time carries
the last native value at or before it, which in a UTC+2 zone is four hours
stale. (An earlier capture here, with `auto` alone, was read as the values
being resampled; the side-by-side pair shows they are relabelled.)

This is why `index.html` requests `timezone=GMT`, keeps the native grid, and
converts only the *display* to local time from the location's IANA zone —
and why the chart anchors its axis ticks on the actual data timestamps.

## Wind gusts

Requesting `wind_gusts_10m` for this model does not produce an error: the
response carries `undefined` as the unit and `null` for every value (observed
2026-09-04, not kept). The page doesn't ask for gusts — WeatherNext 2 has no
gust output — but that is the shape an unsupported variable would arrive in,
which is why an empty wind series hides the wind panel instead of failing
the whole forecast.
