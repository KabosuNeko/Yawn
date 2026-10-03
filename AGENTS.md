# Repository Guidelines

## Project Overview

Yawn is a zero-build, dependency-free Manifest V3 extension that replaces the new tab page: multi-engine search
with `!bang` prefixes, keyboard navigation, optional history-backed suggestions, local favourites, a clock,
light/dark plus Firefox browser-theme colours. Firefox is primary (`yawn@extension.local`, min 140); Chromium
works apart from the theme API.

It has to be an extension: Firefox has no pref for a custom new-tab URL, its settings UI only offers Firefox
Home/Blank/installed extensions, and the `general.config.filename` AutoConfig sandbox (Firefox 157) can set prefs
but no longer run privileged code. `chrome_url_overrides.newtab` is the only lever.

**Invariant: no fingerprinting surface.** No remote requests, no telemetry, no host permissions, no remote fonts
or favicons, no per-install value exposed to web content. Tiles and suggestions use letters unless Firefox
itself hands over a `data:` icon.

## House Rule: ponytail

Lazy senior dev mode: stop at the first rung that holds - does it need to exist / is it already here / stdlib /
platform / one line / then only the minimum that works. Deletion over addition, boring over clever, fewest
files, no new dependencies, no abstractions nobody asked for. Comments only carry facts you cannot derive from
the code; mark a deliberate corner cut with `ponytail: <ceiling, upgrade path>`. Never lazy about validation at
trust boundaries, error handling that prevents data loss, security, accessibility, or anything requested.
Non-trivial logic leaves one runnable check behind.

## Architecture & Data Flow

- `new_tab.html` loads `new_tab.js` as a module; that one file is the whole page. Boot order: `await fetch` of
  `icons.json` + `defaults.json` -> DOM refs -> state from `localStorage` -> handlers -> `init()` last.
- `lib.js` is pure (no DOM, no browser APIs) so `node --test` can cover it.
- State: `localStorage` keys `searchEngines`, `settingsOptions`, `topSites`, merged against `defaults.json` on
  load (saved `active` wins per settings key, missing engines are re-seeded), so new keys need no migration.
  Favourites seed once from `api.topSites.get()`, capped at 8.
- An event mutates module state, persists it, and re-renders the affected container with `replaceChildren`.
- Browser APIs: `const api = globalThis.browser ?? globalThis.chrome`, promise-style. Permissions: `topSites`
  (required), `history` (optional, requested from the drawer; that toggle is synthesised, not stored, and its
  truth is `api.permissions.contains`).
- Search: a leading `!bang` goes through `toUrl()` (navigate) or `searchTarget()` (search); a lone bang switches
  the preferred engine.

## Key Directories

| Path | Purpose |
|---|---|
| `new_tab.html` / `new_tab.css` / `new_tab.js` | the page: markup, styles, all behaviour (~940 lines of JS) |
| `lib.js` | pure helpers, the only unit-tested file: `ENGINE_BANGS`, `toUrl`, `searchTarget`, `monogram`, `siteKey`, `engineSlug`, `uniqueBang` |
| `defaults.json` | shipped engines (9) and settings toggles (13) |
| `icons.json` | SVG inner-markup map: `search, loading, settings, check, pen, plus, trash` |
| `manifest.json` | MV3 manifest: permissions, gecko settings, newtab override |
| `build-site.mjs` | builds the GitHub Pages copy into `docs/` (self-contained `index.html`) |
| `docs/` | generated pages site - committed, never part of the `.xpi` |
| `test/lib.test.js` | `node:test` suite for `lib.js` |
| `images/` | manifest PNGs; `images/src` SVG sources; `images/logos` engine WebP |
| `web-ext-config.mjs` | what the `.xpi` must not contain: `test/`, `docs/`, `build-site.mjs`, `AGENTS.md`, `userChrome.css`, `images/src` |
| `userChrome.css` | personal Firefox chrome theme - gitignored, not part of the extension |

## Browser Support

Both browsers run the same MV3 build; only the theme call branches.

- Chromium (verified live, Chrome 150, unpacked): `chrome://newtab` is overridden; `topSites` and `permissions`
  return promises; `chrome.theme` does not exist, so "use browser theme" does nothing; `chrome.history` stays
  undefined until granted. `browser_specific_settings` is ignored and the extension still loads.
- Firefox: `browser.*` promise APIs, `browser.theme.getCurrent()` colours, and top sites that carry `data:` favicons.
- Chrome only allows `permissions.request` inside a real user gesture, and a headless run cannot show its prompt.

## Install & Verify

```bash
# Chromium: chrome://extensions -> Developer mode -> Load unpacked -> this folder (no signing needed)
chromium --load-extension="$PWD" --disable-extensions-except="$PWD"   # headless equivalent

# Firefox release refuses unsigned add-ons. Either load it temporarily (about:debugging#/runtime/this-firefox ->
# Load Temporary Add-on -> manifest.json, gone after a restart), or use Nightly/Developer Edition/ESR with
# xpinstall.signatures.required=false and this folder copied to <profile>/extensions/yawn@extension.local/,
# or sign for a permanent install: npx web-ext sign --api-key ... --api-secret ... --channel unlisted
```

After any of those, Ctrl+T must show Yawn. Debugging a running install: Firefox prints page `console.log` to stdout
with `user_pref("devtools.console.stdout.content", true)`; MV3 CSP blocks inline scripts, so a probe has to be its own
`.js` file; and `firefox --screenshot <moz-extension-url>` loads the page *without* extension privileges.

## Development Commands

```bash
/usr/bin/node --test test/   # 8 tests; PATH `node` here is Bun's shim and rejects the suite
npx web-ext lint             # must stay at 0 errors
npx web-ext run              # or about:debugging#/runtime/this-firefox -> Load Temporary Add-on
npx web-ext build            # -> web-ext-artifacts/, driven by web-ext-config.mjs

node build-site.mjs          # rebuild docs/index.html (+ docs/images) after editing sources
```

`docs/` is the same page built for GitHub Pages (Settings -> Pages -> Deploy from a branch -> `main` / `docs`).
`build-site.mjs` inlines everything and patches the two `browser.topSites` calls into no-ops, asserting each anchor so
a moved source line fails the build. Rerun it after source changes; `docs/` never enters the `.xpi`.

There is no `package.json`, no CI and no linter config; `build-site.mjs` is the only build step.

## Code Conventions & Common Patterns

- ESM, `const`/`let`, arrow-function consts only (no `class`, no `function` declarations), optional chaining,
  nullish coalescing, top-level `await`. `UPPER_SNAKE_CASE` module constants, `camelCase` otherwise, handlers
  named `initX` / `renderX` / `applyX` / `handleX` / `toggleX` / `closeX`, predicates `hasX` / `isX`.
- No `console.*`; user feedback goes through `showToast(message, autoHide)`; destructive actions use a
  non-auto-hiding confirm toast. Swallow-and-fallback at the boundary (`store.get` parse guard, `.catch(() => [])`).
- DOM contract: ids for singleton structure, kebab-case classes for reusable parts, `data-*` as the JS link
  (`data-icon`, `data-id`, `data-key`, `data-action`). State classes: `hidden`, `adding`, `minimal`,
  `no-separator`, `dragging`, `drop-target`, `loading`, `prevent-ui-interactivity`. Keep the `aria-*` renderers
  set in sync when editing markup.
- Theming is CSS custom properties written on `document.documentElement.style`; `--hairline`/`--surface` are
  derived in CSS and `THEME_ROLE_KEYS` maps Firefox theme roles onto the palette.
- Permissioned calls are guarded (`if (!api.x) return`, `api.permissions?.onAdded?.addListener`) and wrapped in
  `try`/`catch` that reports through a toast.
- Adding an engine is three edits in lockstep: `defaults.json`, `ENGINE_BANGS` in `lib.js`, and
  `images/logos/<key>.webp` (a missing logo shows a monogram, so it is a visible regression).

## Testing & QA

- `node:test` + `node:assert/strict` in `test/lib.test.js` covers the pure helpers. `npx web-ext lint` at
  0 errors is the other half of the gate. There is no coverage threshold and no CI.
- The page has no automated test in the repo: load the extension and exercise the changed path - bang and plain
  search, suggestions with and without the history permission, favourites add/edit/delete/reorder, each setting,
  reset, `?focus`.

## Known Sharp Edges

- `hideTopSites` ships `active: true`, which *hides* the favourites section until the user turns it off.
- `store.get` falls back only for missing/corrupt JSON: an empty array is a valid stored value, and the seeding
  path treats it as "seed from top sites".
- `AGENTS.md` is not in `web-ext-config.mjs` `ignoreFiles`, so `web-ext build` packages it as well.
