# Repository Guidelines

## Project Overview

Yawn is a Firefox extension that replaces the new tab page: `manifest.json` maps `chrome_url_overrides.newtab` to
`index.html`, which is the whole page - one stylesheet and one ES module, no bundler, no framework, no build step.
It also declares `chrome_settings_overrides.homepage`, because the startup tab loads the *homepage* (`about:home` by
default, `browser.startup.page = 1`) and not `about:newtab`, and `about:home` is a different page from the one the
newtab override replaces.

It has to be an extension because Firefox has no setting for a custom new tab URL: `browser.newtab.url` was removed
in Firefox 41, the default prefs hold no such URL, and the `general.config.filename` AutoConfig sandbox can only set
prefs. `chrome_url_overrides` is the only lever.

**Invariant: no fingerprinting surface.** No requests except its own files, no telemetry, no host permissions, no
remote fonts and no remote favicons - a tile shows the `data:` favicon Firefox already has, or a letter. Keep it
that way.

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
- `api` is `globalThis.browser ?? globalThis.chrome`; the page only ever runs as an extension page, so the APIs it
  declares are there. The one real runtime guard is the optional `history` permission: `api.history` stays undefined
  until the user grants it, so every reader checks it (`if (!api.history || !api.permissions) return false`).
- Every browser call is promise-style and swallows its failures at the boundary (`api.topSites.get().catch(() => [])`),
  and every feature that reads browser data is a feature the manifest already asked permission for.

## Key Directories

| Path | Purpose |
|---|---|
| `index.html` | the page; the extension's new tab |
| `new_tab.js` / `new_tab.css` | all behaviour and all styling |
| `lib.js` | pure helpers, the only unit-tested file |
| `defaults.json` | shipped engines (9) and settings toggles (14, plus the history row the drawer synthesises) |
| `icons.json` | inline SVG markup for the UI icons |
| `manifest.json` | the Firefox extension: newtab and homepage overrides, `topSites`, optional `history` |
| `web-ext-config.mjs` | what the `.xpi` must not contain (test, docs, image sources, README assets) |
| `images/` | `logos/` engine marks, the four `icon*.png` sizes, `logo.png` and `preview.png` for the README |
| `images/src/icon.svg` | the drawing behind `icon32.png` |
| `test/lib.test.js` | `node:test` suite for `lib.js` |

## Development

```bash
npx web-ext run              # loads the add-on into a Firefox and reloads it on changes
node --test test/            # 8 tests over lib.js
npx web-ext lint             # must stay at 0 errors
npx web-ext sign --api-key ... --api-secret ... --channel unlisted   # signed .xpi for release Firefox
```

The page only runs as an extension page, so develop it with `web-ext run` or with `manifest.json` loaded through
`about:debugging#/runtime/this-firefox`. Unsigned installs also work on Nightly, Developer Edition and ESR:
`xpinstall.signatures.required = false` plus the folder in `<profile>/extensions/yawn@extension.local/`.

## Code Conventions & Common Patterns

- ESM, `const`/`let`, arrow-function consts only (no `class`, no `function` declarations), optional chaining,
  nullish coalescing, top-level `await`. `UPPER_SNAKE_CASE` module constants; handlers named `initX` / `renderX` /
  `applyX` / `handleX` / `toggleX` / `closeX`; predicates `hasX` / `isX` / `clockIs12h`.
- No `console.*`; user feedback goes through `showToast(message, autoHide)`, destructive actions through a
  non-auto-hiding confirm. Swallow-and-fallback at the boundary (`store.get` parse guard).
- DOM contract: ids for singleton structure, kebab-case classes for reusable parts, `data-*` as the JS link
  (`data-icon`, `data-id`, `data-key`, `data-action`). `#suggestions-list` is absolutely positioned, so it belongs
  inside `#bar` (its containing block) - as a sibling of the bar it lands on top of it. State classes: `hidden`,
  `adding`, `minimal`, `no-separator`, `dragging`, `drop-target`, `prevent-ui-interactivity`. Keep the `aria-*`
  renderers in sync.
- Theming is CSS custom properties written on `document.documentElement.style`; `--hairline` and `--surface` are
  derived in CSS, so a palette only needs `--background`, `--foreground` and `--foreground50`.

## Testing & QA

- `node:test` + `node:assert/strict` in `test/lib.test.js` covers the pure helpers (`toUrl`, `searchTarget`,
  `monogram`, `engineSlug`, `uniqueBang`). There is no coverage threshold and no CI.
- The page itself has no automated test: load the add-on (`web-ext run` or `about:debugging`) and exercise the changed
  path - search and `!bang`, engine switching, suggestions with and without the history permission, favourites
  add/edit/delete/reorder, each setting, reset, `?focus`. Defaults to remember: dark theme, favourites capped at 8,
  and `hideTopSites` ships on, so the favourites section starts hidden.

## Known Sharp Edges

- `hideTopSites` ships `active: true`, which *hides* the favourites section until the user turns it off.
- `store.get` falls back only for missing or corrupt JSON: an empty array is a valid stored value.
- The page cannot run from `file://`; anything that assumes a plain double-click will break.
- Light or dark comes from `prefers-color-scheme`, the only palette signal web content gets; the browser's own theme
  colours are not readable from a plain page - `api.theme.getCurrent()` is the extension API that reads them, which is
  what `useBrowserTheme` calls. It is one setting on purpose: it follows the system preference *and* overlays whatever
  colours the theme provides, so a theme that styles only the toolbar leaves the built-in palette in place.
- The `--page-*` variables are what the page draws straight on its own canvas: `--page-background` (only `body` uses
  it) and the two lines `--page-hairline` / `--page-focus` (the bar frame and the favourites separator). The
  `transparentBackground` setting blanks all three. `--background` stays opaque on purpose - it also paints the
  drawer, the toast, the engine menu and the check marks.
- A transparent page is only visible through a browser that is set up for it - Firefox needs
  `browser.tabs.allow_transparent_browser = true` plus a compositor. Without that it falls back to the browser's
  default canvas colour, which is why the setting ships off.
- `lightmode` and `useBrowserTheme` contradict each other: `handleSettingChange` clears the other when one is turned
  on, and `lightMode()` reads the settings, so the palette keeps no copy of that state.
