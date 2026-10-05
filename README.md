<div align="center">
  <img src="images/logo.png" alt="Yawn" width="140" />
  <h1>Yawn</h1>
  <p><b>A minimal new tab page: engines, bangs, favourites, a clock. No network, no tracking.</b></p>
  <p>
    <a href="https://nainne.living-the.life/Yawn/"><img src="https://img.shields.io/badge/open-the%20page-d4a259?style=flat-square" alt="Open Yawn" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-a3be8c?style=flat-square" alt="License" /></a>
  </p>
</div>

---

`yawn` is a new tab page served as plain HTTP: one `index.html`, one stylesheet and one ES module. No bundler, no
framework, no backend, no build step.

<img src="images/preview.png" alt="Yawn" />

## Install

**As a page** - it is published at <https://nainne.living-the.life/Yawn/>. Open it and bookmark it, set it as your
homepage, or pin the tab.

**As a Firefox extension** - clone this repo and load it, which makes Yawn the new tab page itself:

```sh
# for the session: about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> manifest.json
npx web-ext sign --api-key ... --api-secret ... --channel unlisted   # signed .xpi, permanent
```

On Nightly, Developer Edition or ESR it also installs unsigned: set `xpinstall.signatures.required = false` and copy
the folder to `<profile>/extensions/yawn@extension.local/`. Chromium has no signed install here, so it uses the page.

## Use

Open <https://nainne.living-the.life/Yawn/> and bookmark it, set it as your homepage, or pin the tab. Neither
Firefox nor Chromium has a setting for a custom new tab URL, so `Ctrl+T` stays the browser's own page.

- Type and press `Enter` to search with the preferred engine.
- `!g linux` searches through that engine once; `!g` on its own switches to it.
- `/` focuses the search box, `alt+s` opens settings, `esc` backs out.
- Favourites are tiles: add, edit, delete, drag to reorder (or `ctrl` + arrows).
- 14 settings in the drawer as a page; with the extension there are 16, the extra two being the Firefox theme colours
  and the optional history permission.
- With the extension, top sites also seed the favourites, and typing suggests sites from your top sites and - only if
  you grant the permission - your history.

## Without the extension

Neither Firefox nor Chromium can be told to load a URL in a new tab without an extension, so `Ctrl+T` stays the
browser's own page unless you install the Firefox one above. The closest without it:

- **Homepage**: Firefox -> Settings -> Home -> *Homepage and new windows* -> Custom URLs. Chromium -> Settings ->
  On startup -> *Open a specific page*.
- **Blank new tabs** instead of Firefox Home: `about:config` -> `browser.newtabpage.enabled = false`.
- **One key away**: pin the Yawn tab and keep *Open previous windows and tabs* on; `Ctrl+1` jumps to it.
- **Ctrl+T via the compositor** (any Wayland desktop that can bind keys): bind one to
  `firefox --new-tab https://nainne.living-the.life/Yawn/`, which hands the URL to the running Firefox.

## Run it yourself

```sh
git clone https://github.com/KabosuNeko/Yawn.git
cd Yawn
python3 -m http.server 8080     # open http://127.0.0.1:8080/
node --test test/               # unit tests for lib.js
```

The page has to be served: it fetches `icons.json` and `defaults.json` and imports `lib.js` as a module, both of
which `file://` blocks.

## Privacy

No requests beyond its own files, no telemetry, no remote fonts and no remote favicons - a tile shows a letter
instead. Settings and favourites live in the browser's `localStorage` and nowhere else.

## License

MIT - see [LICENSE](LICENSE).
