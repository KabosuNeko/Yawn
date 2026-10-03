# Repository Guidelines

## Project Overview

Yawn is a new tab page served as static files: `index.html` plus one stylesheet, one ES module, two JSON data files
and the images they use. There is no extension, no build step, no dependency and no backend. GitHub Pages serves
the repository root, so `main` is both the source and the deployed site.

It is shaped this way because neither Firefox nor Chromium has a setting for a custom new tab URL: without an
extension the page can only be a bookmark, a pinned tab, or the homepage.

**Invariant: no fingerprinting surface.** No requests except its own files, no telemetry, no host permissions, no
remote fonts and no remote favicons - a tile shows a letter instead. Keep it that way.

## House Rule: ponytail

Lazy senior dev mode: stop at the first rung that holds - does it need to exist / is it already here / stdlib /
platform / one line / then only the minimum that works. Deletion over addition, boring over clever, fewest files,
no new dependencies, no abstractions nobody asked for. Comments only carry facts you cannot derive from the code;
mark a deliberate corner cut with `ponytail: <ceiling, upgrade path>`. Never lazy about validation at trust
boundaries, error handling that prevents data loss, security, accessibility, or anything requested. Non-trivial
logic leaves one runnable check behind.

## Architecture & Data Flow

- `index.html` loads `new_tab.css` and `new_tab.js` as a module; `new_tab.js` imports `lib.js`, fetches
  `icons.json` and `defaults.json`, then renders. Boot order is load-bearing: fetch, DOM refs, state, handlers,
  `init()` last.
- `lib.js` is pure (no DOM, no browser APIs) so `node --test` can cover it.
- State is `localStorage` under three keys - `searchEngines`, `settingsOptions`, `topSites` (the favourites) -
  merged against `defaults.json` on load, so a new settings key needs no migration. `topSites` is only a storage
  key name; nothing here talks to a browser API.
- An event mutates module state, persists it, and re-renders the containing element with `replaceChildren`.
- Search: a leading `!bang` token goes through `toUrl()` (navigate) or `searchTarget()` (search); a lone bang
  switches the preferred engine.
- Nothing may call `browser.*` or `chrome.*`: the page is unprivileged, and such a call is the one mistake that
  breaks it everywhere. Same for new `fetch` calls or remote assets.

## Key Directories

| Path | Purpose |
|---|---|
| `index.html` | the page; the only entry point Pages serves |
| `new_tab.js` / `new_tab.css` | all behaviour and all styling |
| `lib.js` | pure helpers, the only unit-tested file |
| `defaults.json` | shipped engines (9) and settings toggles (14) |
| `icons.json` | inline SVG markup for the UI icons |
| `images/` | `logos/` engine marks, `icon32.png` favicon, `logo.png` and `preview.png` for the README |
| `images/src/icon.svg` | the drawing behind `icon32.png` |
| `test/lib.test.js` | `node:test` suite for `lib.js` |

## Development

```bash
python3 -m http.server 8080   # then open http://127.0.0.1:8080/
node --test test/             # 7 tests over lib.js
```

The page must be served: it fetches the two JSON files and imports `lib.js` as a module, and `file://` blocks both.
Pushing to `main` is the deploy - Pages serves the repository root, there is nothing to build or publish by hand.

## Code Conventions & Common Patterns

- ESM, `const`/`let`, arrow-function consts only (no `class`, no `function` declarations), optional chaining,
  nullish coalescing, top-level `await`. `UPPER_SNAKE_CASE` module constants; handlers named `initX` / `renderX` /
  `applyX` / `handleX` / `toggleX` / `closeX`; predicates `hasX` / `isX` / `clockIs12h`.
- No `console.*`; user feedback goes through `showToast(message, autoHide)`, destructive actions through a
  non-auto-hiding confirm. Swallow-and-fallback at the boundary (`store.get` parse guard).
- DOM contract: ids for singleton structure, kebab-case classes for reusable parts, `data-*` as the JS link
  (`data-icon`, `data-id`, `data-key`, `data-action`). State classes: `hidden`, `adding`, `minimal`,
  `no-separator`, `dragging`, `drop-target`, `prevent-ui-interactivity`. Keep the `aria-*` renderers in sync.
- Theming is CSS custom properties written on `document.documentElement.style`; `--hairline` and `--surface` are
  derived in CSS, so a palette only needs `--background`, `--foreground` and `--foreground50`.

## Testing & QA

- `node:test` + `node:assert/strict` in `test/lib.test.js` covers the pure helpers (`toUrl`, `searchTarget`,
  `monogram`, `engineSlug`, `uniqueBang`). There is no coverage threshold and no CI.
- The page itself has no automated test: serve it and exercise the changed path - search and `!bang`, engine
  switching, favourites add/edit/delete/reorder, each setting, reset, `?focus`. Defaults to remember: dark theme,
  favourites capped at 8, and `hideTopSites` ships on, so the favourites section starts hidden.

## Known Sharp Edges

- `hideTopSites` ships `active: true`, which *hides* the favourites section until the user turns it off.
- `store.get` falls back only for missing or corrupt JSON: an empty array is a valid stored value.
- The page cannot run from `file://`; anything that assumes a plain double-click will break.
- The palette can only follow the system's light or dark preference (`prefers-color-scheme`, the `systemTheme`
  setting). The browser's own theme colours are not readable from web content, so there is no equivalent of the
  `browser.theme` API here - do not go looking for one.
- The `--page-*` variables are what the page draws straight on its own canvas: `--page-background` (only `body` uses
  it) and the two lines `--page-hairline` / `--page-focus` (the bar frame and the favourites separator). The
  `transparentBackground` setting blanks all three. `--background` stays opaque on purpose - it also paints the
  drawer, the toast, the engine menu and the check marks.
- A transparent page is only visible through a browser that is set up for it - Firefox needs
  `browser.tabs.allow_transparent_browser = true` plus a compositor. Without that it falls back to the browser's
  default canvas colour, which is why the setting ships off.
- `lightmode` and `systemTheme` contradict each other: `handleSettingChange` clears the other when one is turned on,
  and `lightMode()` reads the settings, so the palette keeps no copy of that state.
