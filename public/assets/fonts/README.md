# Font assets

Original Google Fonts WOFF2 subsets, vendored by `scripts/vendor_fonts.py`.
Families: Noto Sans SC, Saira Condensed, ZCOOL QingKe HuangYou.

The original shards are unmodified. `sources.json` records the upstream URLs
used to vendor them. A smaller generated WOFF2 prioritizes display headings,
with the original shards covering other glyphs. See the per-family `*-OFL.txt`
licenses. Noto Sans SC uses its variable weight axis. The startup runtime freezes
the visible characters before revealing the page. Later routes can load the
remaining characters with a separate font face, without changing the first screen.
Files are served on demand; the Service Worker does not prefetch the full font library.
