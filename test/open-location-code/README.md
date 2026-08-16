# Open Location Code test vectors

Vendored verbatim from
[google/open-location-code](https://github.com/google/open-location-code/tree/main/test_data),
Apache License 2.0. Retrieved 2026-08-16 from
`https://raw.githubusercontent.com/google/open-location-code/main/test_data/`:

| file | sha256 |
| --- | --- |
| `encoding.csv` | `a91e870bdf5311499666ef72424fa81d701aabe447b5e3afb12ca1ed7dcd818b` |
| `decoding.csv` | `af16026687a36e4b8c6c66f46eb4643d044dfb913cbc9fc77632be4904e5a78b` |
| `validityTests.csv` | `ace87391952e74edbaeab630bba75483039bf2c01d396dfdca074a31a8ad527f` |

Copied in rather than fetched at test time so `../plus-codes.test.mjs` runs
with no network and no dependencies — the same terms the page itself is built
under. 52 kB, and the format they describe is frozen, so they should never need
updating; re-download and compare the checksums if you want to be sure.
