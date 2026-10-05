import { ENGINE_BANGS, engineSlug, monogram, searchTarget, siteKey, toUrl, uniqueBang } from "./lib.js";

const api = globalThis.browser ?? globalThis.chrome;
const $ = (selector) => document.querySelector(selector);
const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
const loadJson = async (path) => (await fetch(path)).json();

const [icons, defaults] = await Promise.all([loadJson("./icons.json"), loadJson("./defaults.json")]);

const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const searchInput = $("#search-input");
const searchBtn = $("#search-btn");
const engineBtn = $("#engine-btn");
const engineLabel = $("#engine-label");
const engineMenu = $("#engine-menu");
const suggestionsList = $("#suggestions-list");
const settingsPanel = $("#settings-panel");
const settingsBtn = $("#settings-btn");
const toast = $("#toast");
const clockBlock = $("#clock-block");
const clock = $("#clock");
const dateEl = $("#date");
const favoritesSection = $("#favorites-section");
const favoritesList = $("#favorites");
const topSiteInput = $("#add-top-site-input");
const addTopSiteBtn = $("#new-top-site-btn");
const engineLabelInput = $("#engine-label-input");
const engineUrlInput = $("#engine-url-input");
const engineAddButton = $("#engine-add-btn");
const resetButton = $("#reset-btn");

const engines = store.get("searchEngines", defaults.searchEngines);
// storage could be empty (cleared, corrupted): fall back and heal it
if (!engines.length) {
  engines.push(...defaults.searchEngines.map((engine) => ({ ...engine })));
  store.set("searchEngines", engines);
}

/* a version can add settings: keep the value the user has for a key, take the
   label, group and default from defaults.json for everything else, and drop
   keys that no longer exist */
const savedSettings = store.get("settingsOptions", null);
const settings = defaults.settingsOptions.map((option) => {
  const saved = savedSettings?.find((candidate) => candidate.key === option.key);
  return saved ? { ...option, active: saved.active } : { ...option };
});
const settingOn = (key) => settings.some((option) => option.key === key && option.active);
const clockIs12h = () => settingOn("clock12");

const paintClock = () => {
  const now = new Date();
  const text = now.toLocaleTimeString(
    [],
    clockIs12h()
      ? { hour: "numeric", minute: "2-digit", hour12: true }
      : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  );
  if (clock.textContent === text) return;

  const full = now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  clock.textContent = text;
  clock.dateTime = now.toISOString();
  clock.title = full;

  dateEl.textContent = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  dateEl.dateTime = now.toISOString().slice(0, 10);
  dateEl.title = full;
};

const startClock = () => {
  paintClock();
  setInterval(() => {
    if (!clockBlock.classList.contains("hidden")) paintClock();
  }, 1000);
};

let toastTimer;
const hideToast = () => {
  toast.classList.add("hidden");
  toast.textContent = "";
};
const showToast = (message, autoHide = true) => {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (autoHide) toastTimer = setTimeout(hideToast, 5000);
};

const svgIcon = (content, sized = false) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  if (sized) {
    svg.setAttribute("width", "20px");
    svg.setAttribute("height", "20px");
  }
  const parsed = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`,
    "image/svg+xml",
  );
  svg.append(...parsed.documentElement.childNodes);
  return svg;
};

const renderIcons = () =>
  document.querySelectorAll(".icon-btn").forEach((btn) => {
    const content = icons[btn.dataset.icon]?.content;
    if (content) btn.replaceChildren(svgIcon(content));
  });

const LIGHT_COLORS = {
  "--background": "#ffffff",
  "--foreground": "hsl(0, 0%, 10%)",
  "--foreground50": "hsl(0, 0%, 42%)",
};

const DARK_COLORS = {
  "--background": "#000000",
  "--foreground": "hsl(0, 0%, 80%)",
  "--foreground50": "hsl(0, 0%, 60%)",
};

/* A plain page cannot read the browser's theme colours, only whether the system asks for light or dark.
   Following the browser theme therefore starts from the system preference and then lets the theme's own
   colours override what it does provide. */
const systemPrefersLight = () => matchMedia("(prefers-color-scheme: light)").matches;
const lightMode = () => (settingOn("useBrowserTheme") ? systemPrefersLight() : settingOn("lightmode"));

/* A theme may only style the toolbar: every role walks a chain of keys and
   anything it does not provide keeps the built in palette value. Hairlines and
   the hover surface are derived in CSS, so themes never need to supply them. */
const THEME_ROLE_KEYS = {
  "--background": ["ntp_background", "toolbar", "frame"],
  "--foreground": ["ntp_text", "toolbar_text", "tab_text"],
  "--foreground50": ["icons"],
};

const pickThemeColors = (themeColors) =>
  Object.fromEntries(
    Object.entries(THEME_ROLE_KEYS).flatMap(([name, keys]) => {
      const value = keys.map((key) => themeColors?.[key]).find(Boolean);
      return value ? [[name, value]] : [];
    }),
  );

const applyTheme = async () => {
  let colors = lightMode() ? LIGHT_COLORS : DARK_COLORS;

  if (settingOn("useBrowserTheme")) {
    const theme = await api.theme.getCurrent();
    colors = { ...colors, ...pickThemeColors(theme?.colors) };
  }

  const hidden = settingOn("transparentBackground");
  const page = {
    "--page-background": hidden ? "transparent" : colors["--background"],
    "--page-hairline": hidden ? "transparent" : "var(--hairline)",
    "--page-focus": hidden ? "transparent" : "var(--foreground)",
  };

  for (const [name, value] of Object.entries({ ...colors, ...page })) {
    document.documentElement.style.setProperty(name, value);
  }
};

let resetArmed = false;

const resetEverything = () => {
  if (!resetArmed) {
    resetArmed = true;
    showToast('Press "Reset to defaults" again to confirm', false);
    setTimeout(() => {
      resetArmed = false;
    }, 5000);
    return;
  }
  localStorage.removeItem("settingsOptions");
  localStorage.removeItem("searchEngines");
  localStorage.removeItem(FAVORITES_KEY);
  location.reload();
};

const applySetting = (key, isActive) => {
  const toggle = (selector, className = "hidden") => $(selector).classList.toggle(className, isActive);

  switch (key) {
    case "focusOnLoad":
      if (isActive) searchInput.focus();
      break;
    case "showPlaceholder":
      searchInput.placeholder = isActive ? "" : "/ to start typing, alt+s for settings";
      break;
    case "hideSettingsButton":
      settingsBtn.classList.toggle("hidden", isActive);
      settingsBtn.tabIndex = isActive ? -1 : 0;
      break;
    case "hideEngines":
      toggle("#engine-btn");
      break;
    case "hideTopSites":
      toggle("#favorites-section");
      break;
    case "hideTopSitesSepar":
      toggle("#favorites-section", "no-separator");
      break;
    case "hideSearchButton":
      toggle("#search-btn");
      break;
    case "hideSearchLogo":
      toggle("#searchIcon");
      break;
    case "hideSearchInput":
      toggle("#bar", "minimal");
      break;
    case "showClock":
      clockBlock.classList.toggle("hidden", !isActive);
      break;
    case "clock12":
      paintClock();
      break;
    case "lightmode":
    case "useBrowserTheme":
    case "transparentBackground":
      applyTheme();
      break;
  }
};

const applyAllSettings = () => settings.forEach((option) => applySetting(option.key, option.active));

const THEME_SETTINGS = ["lightmode", "useBrowserTheme"];

const handleSettingChange = (key, isActive) => {
  const option = settings.find((s) => s.key === key);
  if (!option) return;
  option.active = isActive;

  // the two theme choices contradict each other, so turning one on turns the other off
  if (isActive && THEME_SETTINGS.includes(key)) {
    for (const otherKey of THEME_SETTINGS) {
      const other = otherKey === key ? null : settings.find((s) => s.key === otherKey);
      if (!other) continue;
      other.active = false;
      const input = document.getElementById(otherKey);
      if (input) input.checked = false;
    }
  }

  store.set("settingsOptions", settings);
  applySetting(key, isActive);
};

const HISTORY_PERMISSION = "history";
const HISTORY_OPTION = {
  key: "historyPermission",
  label: "Suggestions from browsing history",
  group: "History",
};

const syncHistoryOption = async () => {
  const input = document.getElementById(HISTORY_OPTION.key);
  if (input) input.checked = await hasHistoryPermission();
};

const toggleHistoryPermission = async (input, wanted) => {
  try {
    const changed = wanted
      ? await api.permissions.request({ permissions: [HISTORY_PERMISSION] })
      : await api.permissions.remove({ permissions: [HISTORY_PERMISSION] });
    input.checked = wanted && changed;
    showToast(
      wanted
        ? changed
          ? "Suggestions will use your browsing history"
          : "Permission denied"
        : "Suggestions will use top sites only",
    );
  } catch {
    input.checked = false;
    showToast("Could not change the history permission");
  }
  if (input.checked) renderSuggestions(searchInput.value.trim());
};

/* "!g linux" searches Google for that one query, "!g" alone switches the engine.
   The prefixes live in lib.js; a custom engine gets a free one when it is added. */
const bangOf = (engine) => engine.bang ?? ENGINE_BANGS[engine.key] ?? engine.key.slice(0, 2);

const addCustomEngine = () => {
  const label = engineLabelInput.value.trim();
  const url = toUrl(engineUrlInput.value.trim());

  if (!label || !url) return showToast("Enter a name and a search url");

  const key = engineSlug(label, engines.map((engine) => engine.key));
  engines.push({
    key,
    label,
    url: url.href,
    bang: uniqueBang(key, engines.map((engine) => bangOf(engine))),
    active: true,
    preferred: false,
    custom: true,
  });
  store.set("searchEngines", engines);
  engineLabelInput.value = "";
  engineUrlInput.value = "";
  renderEngines();
  renderSettings();
  showToast(`Search engine "${label}" added`);
};

const removeCustomEngine = (key) => {
  const engine = engines.find((candidate) => candidate.key === key && candidate.custom);
  if (!engine) return;
  if (engines.length === 1) return showToast("Keep at least one search engine");

  engines.splice(engines.indexOf(engine), 1);
  if (!engines.some((candidate) => candidate.preferred)) engines[0].preferred = true;
  store.set("searchEngines", engines);
  renderEngines();
  renderSettings();
  showToast(`Search engine "${engine.label}" removed`);
};

const closeEngineMenu = () => {
  engineMenu.hidden = true;
  engineBtn.setAttribute("aria-expanded", "false");
};

const openEngineMenu = () => {
  engineMenu.hidden = false;
  engineBtn.setAttribute("aria-expanded", "true");
  const selected = engineMenu.querySelector('[aria-selected="true"]') ?? engineMenu.firstElementChild;
  selected?.focus();
};

const renderEngineIcon = (engine) => {
  if (!engine) return;
  const icon = engine.custom
    ? el("span", { className: "engine-mark", textContent: engine.label.slice(0, 1).toLowerCase() })
    : el("img", { src: `./images/logos/${engine.key}.webp`, alt: `${engine.key} logo` });
  $("#searchIcon").replaceChildren(icon);
  engineLabel.textContent = engine.label;
};

const renderEngines = () => {
  const active = engines.filter((engine) => engine.active);
  const listed = active.length ? active : engines;
  const preferred = listed.find((engine) => engine.preferred) ?? listed[0];

  renderEngineIcon(preferred);

  engineMenu.replaceChildren(
    ...listed.map((engine) => {
      const option = el("li", { tabIndex: -1 });
      option.dataset.key = engine.key;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(engine.key === preferred?.key));
      option.append(
        el("span", { textContent: engine.label }),
        el("span", { className: "bang", textContent: `!${bangOf(engine)}` }),
      );
      return option;
    }),
  );
};

const createOption = (option, container, onRemove = null) => {
  const label = el("label", { htmlFor: option.key });
  const check = el("div", { className: "check" });
  check.append(svgIcon(icons.check.content, true));
  label.append(check, el("span", { textContent: option.label }));

  const li = document.createElement("li");
  li.append(el("input", { type: "checkbox", id: option.key, checked: option.active }), label);

  if (onRemove) {
    const remove = el("button", { className: "icon-btn row-remove", title: `Remove ${option.label}` });
    remove.dataset.icon = "trash";
    remove.setAttribute("aria-label", `Remove ${option.label}`);
    remove.addEventListener("click", () => onRemove(option.key));
    li.append(remove);
  }

  container.append(li);
};

const renderSettings = () => {
  const settingsContainer = $("#settings-options");
  const enginesContainer = $("#settings-search-engines");
  const scrollTop = settingsPanel.scrollTop;
  settingsContainer.replaceChildren();
  enginesContainer.replaceChildren();

  let group = null;
  for (const option of [...settings, HISTORY_OPTION]) {
    if (option.group && option.group !== group) {
      group = option.group;
      settingsContainer.append(el("li", { className: "group", textContent: group }));
    }
    createOption(option, settingsContainer);
  }

  enginesContainer.append(el("li", { className: "group", textContent: "Search engines" }));
  engines.forEach((option) => createOption(option, enginesContainer, option.custom ? removeCustomEngine : null));

  settingsPanel.scrollTop = scrollTop;
  syncHistoryOption();
  renderIcons();
};

const closeSettingsPanel = () => {
  settingsPanel.classList.add("hidden");
};

const toggleSettingsPanel = () => {
  settingsPanel.classList.toggle("hidden");
};

const performSearch = (query) => {
  if (!query) return;

  const [head, ...tail] = query.split(/\s+/);
  const bang = head.startsWith("!") ? head.slice(1).toLowerCase() : null;
  const wanted = bang ? engines.find((engine) => bangOf(engine) === bang) : null;

  if (wanted && !tail.length) {
    selectEngine(wanted.key);
    searchInput.value = "";
    suggestionsList.replaceChildren();
    showToast(`Search engine: ${wanted.label}`);
    return;
  }

  const term = wanted ? tail.join(" ") : query;
  const url = toUrl(term);
  if (url) {
    location.href = url.href;
    return;
  }

  const engine =
    wanted ??
    engines.find((candidate) => candidate.preferred && candidate.active) ??
    engines.find((candidate) => candidate.active) ??
    engines[0];
  if (engine) location.href = searchTarget(engine, term);
};

const selectEngine = (key) => {
  engines.forEach((engine) => {
    engine.preferred = engine.key === key;
    if (engine.key === key) engine.active = true;
  });
  store.set("searchEngines", engines);
  renderEngines();
  closeEngineMenu();
  searchInput.focus();
};

const handleEngineSettingChange = (key, isActive) => {
  const engine = engines.find((e) => e.key === key);
  if (!engine) return;
  engine.active = isActive;
  if (isActive) engines.forEach((e) => (e.preferred = e.key === key));
  // the engine you search with has to stay one that is switched on
  if (!isActive && engine.preferred) {
    engine.preferred = false;
    const next = engines.find((candidate) => candidate.active);
    if (next) next.preferred = true;
  }
  store.set("searchEngines", engines);
  renderEngines();
};

/* history is an optional permission, granted from the settings drawer, so every
   reader of it has to cope with it being absent */
const hasHistoryPermission = async () => {
  if (!api.history || !api.permissions) return false;
  try {
    return await api.permissions.contains({ permissions: [HISTORY_PERMISSION] });
  } catch {
    return false;
  }
};

const getSuggestions = async (query) => {
  const [topSites, historyItems] = await Promise.all([
    api.topSites.get(),
    (await hasHistoryPermission()) ? api.history.search({ text: query, maxResults: 100 }) : [],
  ]);

  const needle = query.toLowerCase();
  const matches = (site) =>
    site.title && (site.title.toLowerCase().includes(needle) || site.url.toLowerCase().includes(needle));

  // the same site can arrive as both a top site and a history entry, sometimes
  // with a www prefix or a trailing slash, so dedupe on the normalised url
  const seen = new Set();
  return [...topSites.filter(matches), ...historyItems]
    .filter((site) => {
      if (!site.url) return false;
      const key = siteKey(site.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
};

const buildSuggestionItem = (entry) => {
  const link = el("a", { className: "suggestion-link", href: entry.url });
  // firefox hands top sites a data url with the real icon; anything else, and
  // anything remote on other browsers, falls back to the site's letter
  const mark = entry.favicon?.startsWith("data:")
    ? el("img", { className: "suggestion-mark", src: entry.favicon, alt: "" })
    : el("span", { className: "suggestion-mark", textContent: monogram(entry.url) });
  link.append(
    mark,
    el("span", { textContent: entry.title || entry.url }),
    el("span", { textContent: "\u2192" }),
    svgIcon(icons.loading.content, true),
  );

  const row = document.createElement("li");
  row.append(link);
  return row;
};

const renderSuggestions = async (query) => {
  if (!query) return suggestionsList.replaceChildren();

  // null means the browser refused the history/topSites call
  const items = await getSuggestions(query).catch(() => null);
  if (query !== searchInput.value.trim()) return; // a newer keystroke already rendered

  if (!items) {
    const link = el("a", { className: "suggestion-link" });
    link.append(el("span", { textContent: "We have issue getting the suggestion from your browser" }));
    const row = document.createElement("li");
    row.append(link);
    return suggestionsList.replaceChildren(row);
  }

  suggestionsList.replaceChildren(...items.map(buildSuggestionItem));
};

const initSuggestions = () =>
  searchInput.addEventListener("input", () => {
    closeEngineMenu();
    renderSuggestions(searchInput.value.trim());
  });

const navigateSuggestions = (key) => {
  const items = [...suggestionsList.querySelectorAll("a")];
  const index = items.indexOf(document.activeElement) + (key === "ArrowDown" ? 1 : -1);
  if (items[index]) items[index].focus();
  else focusInputAtEnd();
};

const focusInputAtEnd = () => {
  searchInput.focus();
  requestAnimationFrame(() =>
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length),
  );
};

const FAVORITES_KEY = "topSites";
const MAX_FAVORITES = 8;
const ADD_PROMPT = { value: "", placeholder: "Add new favourite website link", action: "addNewUrl" };

let favorites = store.get(FAVORITES_KEY, []);
let newFavUrl = null;
let editTarget = null;
let pendingDeleteId = null;

const newFavId = () => crypto.randomUUID().slice(0, 8);

const favActionButton = (id, action, icon, title) => {
  const button = el("button", { className: "icon-btn top-site-action-button", title, tabIndex: -1 });
  button.dataset.id = id;
  button.dataset.action = action;
  button.dataset.icon = icon;
  button.setAttribute("aria-label", title);
  return button;
};

const renderFavorites = () => {
  const tiles = favorites.map((site) => {
    const link = el("a", {
      className: "tile-link",
      href: site.url,
      title: site.title,
      draggable: false,
    });
    // the browser hands favicons over as data: urls, never a url we would have to fetch
    if (site.favicon?.startsWith("data:")) link.append(el("img", { src: site.favicon, alt: "" }));
    else link.textContent = monogram(site.url);
    link.setAttribute("aria-label", site.title);

    const actions = el("div", { className: "tile-actions" });
    actions.append(
      favActionButton(site.id, "edit", "pen", `edit ${site.title}`),
      favActionButton(site.id, "delete", "trash", `delete ${site.title}`),
    );

    const tile = el("li", { className: "tile", draggable: true });
    tile.dataset.id = site.id;
    tile.append(link, actions);
    return tile;
  });

  const addButton = el("button", { className: "icon-btn add-tile", title: "Add favourite website" });
  addButton.dataset.icon = "plus";
  addButton.setAttribute("aria-label", "Add favourite website");
  const addTile = el("li", { className: "tile" });
  addTile.append(addButton);

  favoritesList.replaceChildren(...tiles, addTile);
  renderIcons();
};

const setInputMode = ({ value, placeholder, action }, { message = null, focus = true } = {}) => {
  topSiteInput.value = value;
  topSiteInput.placeholder = placeholder;
  topSiteInput.dataset.action = action;
  if (focus) topSiteInput.focus();
  if (message) showToast(message);
};

const submitFavorite = () => {
  const value = topSiteInput.value.trim();
  if (!value) return;

  switch (topSiteInput.dataset.action) {
    case "addNewTitle":
      favorites.push({ id: newFavId(), title: value, url: newFavUrl });
      newFavUrl = null;
      store.set(FAVORITES_KEY, favorites);
      renderFavorites();
      setInputMode(ADD_PROMPT, { message: "Link is added successfully" });
      break;

    case "editTitle":
      editTarget = { ...editTarget, title: value };
      favorites = favorites.map((site) => (site.id === editTarget.id ? editTarget : site));
      editTarget = null;
      store.set(FAVORITES_KEY, favorites);
      renderFavorites();
      setInputMode(ADD_PROMPT, { message: "Link is updated successfully" });
      break;

    default: {
      const url = toUrl(value);
      if (!url) return showToast("Please Enter Valid URL. it must start with https://");
      if (topSiteInput.dataset.action === "editUrl") {
        editTarget = { ...editTarget, url: url.href };
        setInputMode(
          { value: editTarget.title, placeholder: "Edit title", action: "editTitle" },
          { message: "Link is updated, now edit the title of the link" },
        );
      } else {
        newFavUrl = url.href;
        setInputMode(
          { value: "", placeholder: "Add title for your URL", action: "addNewTitle" },
          { message: "Link is saved, now add title of the link" },
        );
      }
    }
  }
};

const startEdit = (id) => {
  editTarget = { ...favorites.find((site) => site.id === id) };
  favoritesSection.classList.add("adding");
  setInputMode({ value: editTarget.url, placeholder: "Edit Url", action: "editUrl" });
};

const requestDelete = (id) => {
  pendingDeleteId = id;
  document.body.classList.add("prevent-ui-interactivity");
  showToast('Are you sure you want to remove this website ? Press "Enter" to confirm, "Esc" to cancel', false);
};

const confirmDelete = () => {
  favorites = favorites.filter((site) => site.id !== pendingDeleteId);
  store.set(FAVORITES_KEY, favorites);
  renderFavorites();
  document.body.classList.remove("prevent-ui-interactivity");
  pendingDeleteId = null;
  showToast("Favourite website removed successfully");
};

const isAdding = () => favoritesSection.classList.contains("adding");

const openAddForm = () => {
  favoritesSection.classList.add("adding");
  setInputMode(ADD_PROMPT);
};

const closeAddForm = () => {
  favoritesSection.classList.remove("adding");
  newFavUrl = null;
  editTarget = null;
  setInputMode(ADD_PROMPT, { focus: false });
};

const cancelDelete = () => {
  hideToast();
  document.body.classList.remove("prevent-ui-interactivity");
  pendingDeleteId = null;
};

let draggedId = null;

const persistFavoriteOrder = (id) => {
  store.set(FAVORITES_KEY, favorites);
  renderFavorites();
  favoritesList.querySelector(`[data-id="${id}"] .tile-link`)?.focus();
};

const reorderFavorite = (id, to) => {
  const from = favorites.findIndex((site) => site.id === id);
  if (from < 0 || to < 0 || to >= favorites.length || from === to) return;
  favorites.splice(to, 0, ...favorites.splice(from, 1));
  persistFavoriteOrder(id);
};

const moveFavorite = (id, targetId) => reorderFavorite(id, favorites.findIndex((site) => site.id === targetId));

const moveFavoriteBy = (id, step) =>
  reorderFavorite(id, favorites.findIndex((site) => site.id === id) + step);

const initFavoriteOrdering = () => {
  favoritesList.addEventListener("dragstart", (event) => {
    const tile = event.target.closest(".tile[data-id]");
    if (!tile) return;
    draggedId = tile.dataset.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedId); // firefox needs data to start a drag
    tile.classList.add("dragging");
  });

  favoritesList.addEventListener("dragend", () => {
    draggedId = null;
    favoritesList
      .querySelectorAll(".dragging, .drop-target")
      .forEach((tile) => tile.classList.remove("dragging", "drop-target"));
  });

  favoritesList.addEventListener("dragover", (event) => {
    const tile = event.target.closest(".tile[data-id]");
    if (!tile || !draggedId || tile.dataset.id === draggedId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    favoritesList.querySelectorAll(".drop-target").forEach((other) => other.classList.remove("drop-target"));
    tile.classList.add("drop-target");
  });

  favoritesList.addEventListener("drop", (event) => {
    const tile = event.target.closest(".tile[data-id]");
    if (!tile || !draggedId) return;
    event.preventDefault();
    const id = draggedId;
    draggedId = null;
    moveFavorite(id, tile.dataset.id);
  });
};

// the browser hands favicons over as data: urls, so a tile never needs a request
const localFavicon = (value) => (value?.startsWith("data:") ? value : null);

const initFavorites = async () => {
  if (!favorites.length) {
    const browserSites = await api.topSites.get().catch(() => []);
    favorites = browserSites.slice(0, MAX_FAVORITES).map((site) => ({
      id: newFavId(),
      title: site.title || site.url,
      url: site.url,
      ...(localFavicon(site.favicon) ? { favicon: site.favicon } : {}),
    }));
    store.set(FAVORITES_KEY, favorites);
  } else if (favorites.some((site) => !site.favicon)) {
    // favourites saved before tiles carried icons: take the ones the browser still has, leave the rest
    const browserSites = await api.topSites.get().catch(() => []);
    const known = new Map(browserSites.map((site) => [site.url, localFavicon(site.favicon)]));
    let gained = false;
    favorites = favorites.map((site) => {
      const favicon = site.favicon ? null : known.get(site.url);
      if (!favicon) return site;
      gained = true;
      return { ...site, favicon };
    });
    if (gained) store.set(FAVORITES_KEY, favorites);
  }
  renderFavorites();

  favoritesList.addEventListener("click", (event) => {
    if (event.target.closest(".add-tile")) return openAddForm();

    const button = event.target.closest(".top-site-action-button");
    if (!button) return;
    if (button.dataset.action === "edit") startEdit(button.dataset.id);
    else requestDelete(button.dataset.id);
  });

  topSiteInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitFavorite();
  });
  addTopSiteBtn.addEventListener("click", submitFavorite);

  initFavoriteOrdering();
};

const initGlobalListeners = () => {
  document.addEventListener("keydown", (event) => {
    const inEngineMenu = engineMenu.contains(document.activeElement);

    if (event.key === "Escape") {
      if (!engineMenu.hidden) return closeEngineMenu();
      if (pendingDeleteId !== null) return cancelDelete();
      if (isAdding()) return closeAddForm();
      if (searchInput.value) {
        searchInput.value = "";
        suggestionsList.replaceChildren();
        return;
      }
      closeSettingsPanel();
      return;
    }

    if (event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      toggleSettingsPanel();
      return;
    }

    const typing = document.activeElement?.matches?.(
      'input:not([type="checkbox"]), textarea, [contenteditable]',
    );
    const typingOutsideSearch = typing && document.activeElement !== searchInput;

    if (event.key === "/" && !typing) {
      event.preventDefault();
      searchInput.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!inEngineMenu && !typingOutsideSearch) navigateSuggestions(event.key);
      return;
    }

    if (event.ctrlKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      const tile = document.activeElement?.closest?.(".tile[data-id]");
      if (tile) {
        event.preventDefault();
        moveFavoriteBy(tile.dataset.id, event.key === "ArrowRight" ? 1 : -1);
        return;
      }
    }

    if (event.key === "Enter") {
      if (inEngineMenu) {
        const option = document.activeElement.closest("li[data-key]");
        if (option) selectEngine(option.dataset.key);
        return;
      }
      if (pendingDeleteId !== null) return confirmDelete();
      if (event.target === searchInput) performSearch(searchInput.value.trim());
    }
  });

  searchBtn.addEventListener("click", () => performSearch(searchInput.value.trim()));

  settingsBtn.addEventListener("click", toggleSettingsPanel);

  engineBtn.addEventListener("click", () => {
    if (engineMenu.hidden) openEngineMenu();
    else closeEngineMenu();
  });

  engineMenu.addEventListener("click", (event) => {
    const option = event.target.closest("li[data-key]");
    if (option) selectEngine(option.dataset.key);
  });

  engineMenu.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = [...engineMenu.children];
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = options[options.indexOf(document.activeElement) + step] ?? options[step === 1 ? 0 : -1];
    next?.focus();
  });

  document.addEventListener("click", (event) => {
    const inMenu = engineBtn.contains(event.target) || engineMenu.contains(event.target);
    if (!engineMenu.hidden && !inMenu) closeEngineMenu();

    const outside = !settingsPanel.contains(event.target) && !settingsBtn.contains(event.target);
    if (outside && !settingsPanel.classList.contains("hidden")) closeSettingsPanel();

    if (!event.target.closest("a, button, input, textarea, #settings-panel")) searchInput.focus();
  });

  $("#settings-options").addEventListener("change", (event) => {
    if (event.target.tagName !== "INPUT") return;
    if (event.target.id === HISTORY_OPTION.key) return void toggleHistoryPermission(event.target, event.target.checked);
    handleSettingChange(event.target.id, event.target.checked);
  });

  $("#settings-search-engines").addEventListener("change", (event) => {
    if (event.target.tagName === "INPUT") handleEngineSettingChange(event.target.id, event.target.checked);
  });

  // the browser's own add-ons manager can grant or revoke the optional permission
  api.permissions.onAdded.addListener(syncHistoryOption);
  api.permissions.onRemoved.addListener(syncHistoryOption);

  engineAddButton.addEventListener("click", addCustomEngine);
  [engineLabelInput, engineUrlInput].forEach((input) =>
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") addCustomEngine();
    }),
  );

  resetButton.addEventListener("click", resetEverything);

  suggestionsList.addEventListener("click", (event) => {
    event.target.closest(".suggestion-link")?.classList.add("loading");
  });

  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (settingOn("useBrowserTheme")) applyTheme();
  });

  favoritesList.addEventListener("wheel", (event) => {
    event.preventDefault();
    favoritesList.scrollLeft += event.deltaY;
  });
};

const init = async () => {
  renderEngines();
  renderSettings();
  applyAllSettings();
  startClock();
  initGlobalListeners();
  initSuggestions();
  await initFavorites();

  // A new tab may hand focus to the address bar right after it loads. A plain
  // focus wins most of the time; when the page ends up without focus, one round
  // trip with ?focus takes the caret back, and that load skips this check.
  const wantsFocus = settingOn("focusOnLoad");
  if (wantsFocus && location.search !== "?focus") {
    setTimeout(() => {
      if (!document.hasFocus()) location.search = "?focus";
    }, 250);
  }
};

init();
