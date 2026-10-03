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

## Use

Open <https://nainne.living-the.life/Yawn/> and bookmark it, set it as your homepage, or pin the tab. Neither
Firefox nor Chromium has a setting for a custom new tab URL, so `Ctrl+T` stays the browser's own page.

- Type and press `Enter` to search with the preferred engine.
- `!g linux` searches through that engine once; `!g` on its own switches to it.
- `/` focuses the search box, `alt+s` opens settings, `esc` backs out.
- Favourites are tiles: add, edit, delete, drag to reorder (or `ctrl` + arrows).
- 14 settings in the drawer: layout, clock, light, dark or the system theme, and a transparent background for a
  see-through browser theme.

## Put it in front of you

Neither Firefox nor Chromium can be told to load a URL in a new tab - that is extension territory - so `Ctrl+T` stays
the browser's own page. The closest without one:

- **Homepage**: Firefox -> Settings -> Home -> *Homepage and new windows* -> Custom URLs. Chromium -> Settings ->
  On startup -> *Open a specific page*.
- **Blank new tabs** instead of Firefox Home: `about:config` -> `browser.newtabpage.enabled = false`.
- **One key away**: pin the Yawn tab and keep *Open previous windows and tabs* on; `Ctrl+1` jumps to it.

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
