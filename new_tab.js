const api = globalThis.browser ?? globalThis.chrome;
const $ = (selector) => document.querySelector(selector);
const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
const loadJson = async (path) => (await fetch(path)).json();

const [icons, defaults] = await Promise.all([loadJson("./icons.json"), loadJson("./defaults.json")]);

/* persisted state, read once at load and written back on change */
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
const favoritesSection = $("#favorites-section");
const favoritesList = $("#favorites");
const topSiteInput = $("#add-top-site-input");
const addTopSiteBtn = $("#new-top-site-btn");

/* ------------------------------------------------------------------- state */

const engines = store.get("searchEngines", defaults.searchEngines);
const settings = store.get("settingsOptions", defaults.settingsOptions);
const userTheme = { light: false, browser: false };

/* ------------------------------------------------------------------- toast */

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

/* ------------------------------------------------------------------- icons */

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

/* ------------------------------------------------------------------- theme */

const LIGHT_COLORS = {
  "--background": "#ffffff",
  "--foreground": "hsl(0, 0%, 10%)",
  "--foreground50": "hsl(0, 0%, 42%)",
  "--foreground75": "hsl(0, 0%, 92%)",
};

const DARK_COLORS = {
  "--background": "#000000",
  "--foreground": "hsl(0, 0%, 80%)",
  "--foreground50": "hsl(0, 0%, 60%)",
  "--foreground75": "hsl(0, 0%, 12%)",
};

const applyTheme = async () => {
  let colors = userTheme.light ? LIGHT_COLORS : DARK_COLORS;

  // ponytail: chrome has no theme api, the browser theme is firefox only
  if (!userTheme.light && userTheme.browser && api.theme) {
    const { colors: browserColors } = await api.theme.getCurrent();
    colors = {
      "--background": browserColors.ntp_background,
      "--foreground": browserColors.ntp_text,
      "--foreground50": browserColors.icons,
      "--foreground75": browserColors.ntp_card_background,
    };
  }

  for (const [name, value] of Object.entries(colors)) {
    document.documentElement.style.setProperty(name, value);
  }
};

/* ---------------------------------------------------------------- settings */

const THEME_FLAGS = { lightmode: "light", useBrowserTheme: "browser" };
const OTHER_THEME_SETTING = { lightmode: "useBrowserTheme", useBrowserTheme: "lightmode" };

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
      toggle("#search-btn", "disabled");
      break;
    case "hideSearchLogo":
      toggle("#searchIcon");
      break;
    case "hideSearchInput":
      toggle("#bar", "minimal");
      break;
    case "lightmode":
    case "useBrowserTheme":
      userTheme[THEME_FLAGS[key]] = isActive;
      applyTheme();
      break;
  }
};

const applyAllSettings = () => settings.forEach((option) => applySetting(option.key, option.active));

// lightmode and useBrowserTheme are mutually exclusive: turning one on turns the other off
const handleSettingChange = (key, isActive) => {
  const option = settings.find((s) => s.key === key);
  if (!option) return;
  option.active = isActive;

  const otherKey = OTHER_THEME_SETTING[key];
  const other = settings.find((s) => s.key === otherKey);
  if (isActive && other) {
    other.active = false;
    userTheme[THEME_FLAGS[otherKey]] = false;
    document.getElementById(otherKey).checked = false;
  }

  store.set("settingsOptions", settings);
  applySetting(key, isActive);
};

/* --------------------------------------------------------- engine picker */

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
  $("#searchIcon").replaceChildren(
    el("img", { src: `./images/logos/${engine.key}.webp`, alt: `${engine.key} logo` }),
  );
  engineLabel.textContent = engine.label;
};

const renderEngines = () => {
  const active = engines.filter((engine) => engine.active);
  const listed = active.length ? active : engines;
  const preferred = engines.find((engine) => engine.preferred) ?? listed[0];

  renderEngineIcon(preferred);

  engineMenu.replaceChildren(
    ...listed.map((engine) => {
      const option = el("li", { textContent: engine.label, tabIndex: -1 });
      option.dataset.key = engine.key;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(engine.key === preferred?.key));
      return option;
    }),
  );
};

const createOption = (option, container) => {
  const label = el("label", { htmlFor: option.key });
  const check = el("div", { className: "check" });
  check.append(svgIcon(icons.check.content, true));
  label.append(check, el("span", { textContent: option.label }));

  const li = document.createElement("li");
  li.append(el("input", { type: "checkbox", id: option.key, checked: option.active }), label);
  container.append(li);
};

const renderSettings = () => {
  const settingsContainer = $("#settings-options");
  const enginesContainer = $("#settings-search-engines");
  settingsContainer.replaceChildren();
  enginesContainer.replaceChildren();
  settings.forEach((option) => createOption(option, settingsContainer));
  engines.forEach((option) => createOption(option, enginesContainer));
};

const closeSettingsPanel = () => {
  settingsPanel.classList.add("hidden");
  settingsBtn.classList.remove("disabled");
};

const toggleSettingsPanel = () => {
  settingsPanel.classList.toggle("hidden");
  settingsBtn.classList.toggle("disabled");
};

/* ------------------------------------------------------------------ search */

// an http(s) url, a bare host promoted to https, or null
const toUrl = (value) => {
  for (const candidate of [value, `https://${value}`]) {
    try {
      const url = new URL(candidate);
      if (/^https?:$/.test(url.protocol) && url.hostname.includes(".")) return url;
    } catch {
      // try the next candidate
    }
  }
  return null;
};

const performSearch = (query) => {
  if (!query) return;
  const url = toUrl(query);
  if (url) {
    location.href = url.href;
    return;
  }
  const engine = engines.find((e) => e.preferred) ?? engines[0];
  if (engine) location.href = engine.url + encodeURIComponent(query);
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
  store.set("searchEngines", engines);
  renderEngines();
};

/* ------------------------------------------------------------- suggestions */

const getSuggestions = async (query) => {
  if (!api.topSites || !api.history) return [];
  const [topSites, historyItems] = await Promise.all([
    api.topSites.get(),
    api.history.search({ text: query, maxResults: 100 }),
  ]);

  const needle = query.toLowerCase();
  const matches = (site) =>
    site.title && (site.title.toLowerCase().includes(needle) || site.url.toLowerCase().includes(needle));

  const seen = new Set();
  return [...topSites.filter(matches), ...historyItems]
    .filter((site) => site.url && !seen.has(site.url) && seen.add(site.url))
    .slice(0, 6);
};

const buildSuggestionItem = (entry) => {
  const link = el("a", { className: "suggestion-link", href: entry.url });
  link.append(
    el("img", {
      src: `https://www.google.com/s2/favicons?sz=32&domain_url=${new URL(entry.url).origin}`,
      alt: "",
      width: 16,
      height: 16,
    }),
    el("span", { textContent: entry.title || entry.url }),
    el("span", { textContent: "\u2192" }),
    svgIcon(icons.loading.content, true),
  );

  const row = el("li", { className: "search-result-item" });
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

/* -------------------------------------------------------------- favourites */

const FAVORITES_KEY = "topSites";
const MAX_FAVORITES = 8;
const ADD_PROMPT = { value: "", placeholder: "Add new favourite website link", action: "addNewUrl" };

let favorites = store.get(FAVORITES_KEY, []);
let newFavUrl = null; // url waiting for its title, while adding
let editTarget = null; // { id, title, url } being edited
let pendingDeleteId = null;

const newFavId = () => crypto.randomUUID().slice(0, 8);

// the tile letter comes from the site itself: no favicon request is made
const monogram = (url) => {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return (host.match(/[a-z0-9]/i) ?? ["?"])[0].toLowerCase();
};

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
      textContent: monogram(site.url),
    });
    link.setAttribute("aria-label", site.title);

    const actions = el("div", { className: "tile-actions" });
    actions.append(
      favActionButton(site.id, "edit", "pen", `edit ${site.title}`),
      favActionButton(site.id, "delete", "trash", `delete ${site.title}`),
    );

    const tile = el("li", { className: "tile" });
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
    // second step of add: the title arrived, save the site
    case "addNewTitle":
      favorites.push({ id: newFavId(), title: value, url: newFavUrl });
      newFavUrl = null;
      store.set(FAVORITES_KEY, favorites);
      renderFavorites();
      setInputMode(ADD_PROMPT, { message: "Link is added successfully" });
      break;

    // second step of edit: the new title arrived, save it
    case "editTitle":
      editTarget = { ...editTarget, title: value };
      favorites = favorites.map((site) => (site.id === editTarget.id ? editTarget : site));
      editTarget = null;
      store.set(FAVORITES_KEY, favorites);
      renderFavorites();
      setInputMode(ADD_PROMPT, { message: "Link is updated successfully" });
      break;

    // first step: a url arrived, ask for its title
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

const initFavorites = async () => {
  if (!favorites.length) {
    const browserSites = await api.topSites.get().catch(() => []);
    favorites = browserSites.slice(0, MAX_FAVORITES).map((site) => ({
      id: newFavId(),
      title: site.title || site.url,
      url: site.url,
    }));
    store.set(FAVORITES_KEY, favorites);
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
};

/* -------------------------------------------------------------------- init */

const initGlobalListeners = () => {
  document.addEventListener("keydown", (event) => {
    const inEngineMenu = engineMenu.contains(document.activeElement);

    if (event.key === "Escape") {
      if (!engineMenu.hidden) return closeEngineMenu();
      if (pendingDeleteId !== null) return cancelDelete();
      if (isAdding()) return closeAddForm();
      closeSettingsPanel();
      return;
    }

    if (event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      toggleSettingsPanel();
      return;
    }

    if (event.key === "/" && !["search-input", "add-top-site-input"].includes(document.activeElement.id)) {
      event.preventDefault();
      searchInput.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!inEngineMenu) navigateSuggestions(event.key);
      return;
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
  });

  [
    ["#settings-options", handleSettingChange],
    ["#settings-search-engines", handleEngineSettingChange],
  ].forEach(([selector, handler]) =>
    $(selector).addEventListener("change", (event) => {
      if (event.target.tagName === "INPUT") handler(event.target.id, event.target.checked);
    }),
  );

  suggestionsList.addEventListener("click", (event) => {
    event.target.closest(".suggestion-link")?.classList.add("loading");
  });

  // let the cursor wheel scroll the favourite tiles
  favoritesList.addEventListener("wheel", (event) => {
    event.preventDefault();
    favoritesList.scrollLeft += event.deltaY;
  });
};

const init = async () => {
  renderEngines();
  renderSettings();

  // ponytail: one reload with ?focus, so the browser does not keep the caret in the omnibox
  const wantsFocus = settings.some((option) => option.key === "focusOnLoad" && option.active);
  if (wantsFocus && location.search !== "?focus") {
    location.search = "?focus";
    return;
  }

  applyAllSettings();
  initGlobalListeners();
  initSuggestions();
  await initFavorites();
  renderIcons();
};

init();
