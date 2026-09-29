const api = globalThis.browser ?? globalThis.chrome;
const $ = (selector) => document.querySelector(selector);
const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
const loadJson = async (path) => (await fetch(path)).json();

const [icons, defaults] = await Promise.all([loadJson("./icons.json"), loadJson("./defaults.json")]);

const searchInput = $("#search-input");
const searchBtn = $("#search-btn");
const searchEnginesList = $("#search-engines-list");
const suggestionsList = $("#suggestions-list");
const settingsPanel = $("#settings-panel");
const settingsBtn = $("#settings-btn");
const toast = $("#toast");
const topSitesContainer = $("#top-website-list-container");
const topSitesList = $("#top-website-list");
const topSiteInput = $("#add-top-site-input");
const addTopSiteBtn = $("#new-top-site-btn");
const manageTopSitesBtn = $("#manage-top-websites-btn");

/* ------------------------------------------------------------------- state */

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
  "--foreground50": "hsl(0, 0%, 50%)",
  "--foreground75": "hsl(0, 0%, 85%)",
};

const DARK_COLORS = {
  "--background": "#000000",
  "--foreground": "hsl(0, 0%, 80%)",
  "--foreground50": "hsl(0, 0%, 25%)",
  "--foreground75": "hsl(0, 0%, 5%)",
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
      toggle("#search-engines-list");
      break;
    case "hideTopSites":
      toggle("#top-website-list-container");
      toggle("#add-top-site-input-container");
      break;
    case "hideTopSitesSepar":
      toggle("#top-website-list-container", "no-separator");
      break;
    case "hideSearchButton":
      toggle("#search-btn", "disabled");
      break;
    case "hideSearchLogo":
      toggle("#searchIcon");
      break;
    case "hideSearchInput":
      toggle("#search-input-wrapper", "minimal");
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

/* ------------------------------------------------------------------ render */

const renderEngines = () => {
  searchEnginesList.replaceChildren();

  engines.filter((engine) => engine.active).forEach((engine, index) => {
    if (index) searchEnginesList.append(el("li", { className: "inactive", textContent: "/" }));

    const button = el("button", { textContent: engine.label });
    button.dataset.key = engine.key;

    if (engine.preferred) {
      button.classList.add("active");
      $("#searchIcon").replaceChildren(el("img", { src: `./images/logos/${engine.key}.webp`, alt: `${engine.key} logo` }));
    }

    const li = document.createElement("li");
    li.append(button);
    searchEnginesList.append(li);
  });
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
  searchInput.addEventListener("input", () => renderSuggestions(searchInput.value.trim()));

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
const MAX_TITLE = 15;
const ADD_PROMPT = { value: "", placeholder: "Add new favourite website link", action: "addNewUrl" };

let favorites = store.get(FAVORITES_KEY, []);
let newFavUrl = null; // url waiting for its title, while adding
let editTarget = null; // { id, title, url } being edited
let pendingDeleteId = null;

const newFavId = () => crypto.randomUUID().slice(0, 8);
const shorten = (title) => (title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE)}..` : title);

const favActionButton = (id, action, icon, title) => {
  const button = el("button", { className: "icon-btn top-site-action-button", title, tabIndex: -1 });
  button.dataset.id = id;
  button.dataset.action = action;
  button.dataset.icon = icon;
  button.setAttribute("aria-label", title);
  return button;
};

const favSeparator = () => {
  const li = document.createElement("li");
  li.append(el("span", { textContent: "/" }));
  return li;
};

const renderFavorites = () => {
  const rows = favorites.flatMap((site, index) => {
    const link = el("a", { href: site.url });
    link.append(el("span", { textContent: shorten(site.title) }));

    const actions = el("div", { className: "actions-btns" });
    actions.append(
      favActionButton(site.id, "edit", "pen", "edit link"),
      favActionButton(site.id, "delete", "trash", "delete link"),
    );

    const row = el("li", { className: "link" });
    row.append(link, actions);
    return index ? [favSeparator(), row] : [row];
  });

  topSitesList.replaceChildren(...rows);
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

const initFavorites = async () => {
  manageTopSitesBtn.addEventListener("click", () => {
    topSitesContainer.classList.toggle("edit-mode");
    setInputMode(ADD_PROMPT, { focus: false });
  });

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

  topSiteInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitFavorite();
  });
  addTopSiteBtn.addEventListener("click", submitFavorite);

  topSitesList.addEventListener("click", (event) => {
    const button = event.target.closest(".top-site-action-button");
    if (!button) return;
    if (button.dataset.action === "edit") startEdit(button.dataset.id);
    else requestDelete(button.dataset.id);
  });

  document.addEventListener("keydown", (event) => {
    if (pendingDeleteId === null) return;
    if (event.key === "Enter") confirmDelete();
    else if (event.key === "Escape") {
      hideToast();
      document.body.classList.remove("prevent-ui-interactivity");
      pendingDeleteId = null;
    }
  });
};

/* -------------------------------------------------------------------- init */

const initGlobalListeners = () => {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSettingsPanel();

    if (event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      toggleSettingsPanel();
    }

    if (event.key === "/" && !["search-input", "add-top-site-input"].includes(document.activeElement.id)) {
      event.preventDefault();
      searchInput.focus();
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") navigateSuggestions(event.key);

    if (event.key === "Enter" && event.target === searchInput) performSearch(searchInput.value.trim());
  });

  searchBtn.addEventListener("click", () => performSearch(searchInput.value.trim()));

  settingsBtn.addEventListener("click", toggleSettingsPanel);

  document.addEventListener("click", (event) => {
    const outside = !settingsPanel.contains(event.target) && !settingsBtn.contains(event.target);
    if (outside && !settingsPanel.classList.contains("hidden")) closeSettingsPanel();
  });

  searchEnginesList.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    selectEngine(button.dataset.key);
    searchInput.focus();
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

  // let the cursor wheel scroll the horizontal lists
  [searchEnginesList, topSitesList].forEach((list) =>
    list.addEventListener("wheel", (event) => {
      event.preventDefault();
      list.scrollLeft += event.deltaY;
    }),
  );
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
