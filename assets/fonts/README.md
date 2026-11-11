# Font assets

Original Google Fonts WOFF2 subsets, vendored by `scripts/vendor_fonts.py`.
Families: Noto Sans SC, Saira Condensed, ZCOOL QingKe HuangYou.

The font binaries are unmodified. `sources.json` maps each source URL to its
content-hashed local filename. See the per-family `*-OFL.txt` licenses.
Unicode ranges, weights and swap behavior are preserved in `assets/css/fonts.css`.
Files are served on demand; the Service Worker does not prefetch the full font library.
