<div align="center">
  <img src="images/logo.png" alt="Yawn" width="140" />
  <h1>Yawn</h1>
  <p><b>A minimal new tab page: engines, bangs, favourites, a clock. No network, no tracking.</b></p>
  <p>
    <a href="manifest.json"><img src="https://img.shields.io/badge/manifest-v3-d4a259?style=flat-square" alt="Manifest V3" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-a3be8c?style=flat-square" alt="License" /></a>
  </p>
</div>

---

`yawn` replaces the new tab page in Firefox and Chromium. It is one page of plain ES modules: no bundler, no
framework, no dependencies and no build step.

<img src="images/preview.png" alt="Yawn" />

## Install

**Chromium** - `chrome://extensions`, enable *Developer mode*, *Load unpacked*, pick this folder.

**Firefox** - release builds refuse unsigned add-ons, so either load it for the session
(`about:debugging#/runtime/this-firefox` -> *Load Temporary Add-on* -> `manifest.json`), or sign it once and
install the `.xpi`:

```sh
npx web-ext sign --api-key ... --api-secret ... --channel unlisted
```

**Without an extension** - the same page is published at <https://nainne.living-the.life/Yawn/>. Bookmark it or
set it as the homepage. New tabs stay the browser's own page: Firefox has no setting for a custom new tab URL.

## Use

- Type and press `Enter` to search with the preferred engine.
- `!g linux` searches through that engine once; `!g` on its own switches to it.
- `/` focuses the search box, `alt+s` opens settings, arrows walk the suggestions, `esc` backs out.
- Favourites are local tiles: add, edit, delete, drag to reorder (or `ctrl` + arrows), 8 seeded from top sites.
- The drawer has 13 settings, light/dark, and optional history suggestions behind a permission request.

## Privacy

There is no fingerprinting surface: no host permissions, no remote requests, no telemetry, no remote fonts and no
remote favicons - a tile shows a letter unless Firefox itself hands over a `data:` icon. Settings and favourites live
in the browser's own `localStorage` and nowhere else.

## Development

```sh
node --test test/        # unit tests for lib.js
npx web-ext lint         # must stay at 0 errors
npx web-ext build        # -> web-ext-artifacts/
node build-site.mjs      # rebuild docs/, the GitHub Pages copy of the page
```

`lib.js` holds the pure helpers, `new_tab.js` is the page, `defaults.json` ships the engines and settings,
`icons.json` the inline SVG icons. `images/logos/` are the engine marks.

## License

MIT - see [LICENSE](LICENSE).
