/* Pure helpers: no DOM, no browser APIs, so `node --test test/` can cover them.
   new_tab.js imports the same functions the page runs. */

/* Shipped engine prefixes: "!g linux" searches Google for that query once. */
export const ENGINE_BANGS = {
  startpage: "s",
  google: "g",
  duckduckgo: "ddg",
  brave: "b",
  bing: "bi",
  perplexity: "p",
  mistral: "m",
  gemini: "gem",
  chatgpt: "c",
};

/* an http(s) url, a bare host promoted to https, or null.
   Text with a space or an "@" and no scheme is left alone, so an email address
   gets searched instead of turning into https://<email>. */
export const toUrl = (value) => {
  const explicit = /^https?:\/\//i.test(value);
  const candidates = explicit ? [value] : /[@\s]/.test(value) ? [] : [value, `https://${value}`];

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (/^https?:$/.test(url.protocol) && url.hostname.includes(".")) return url;
    } catch {
      // next candidate
    }
  }
  return null;
};

/* a search url with the query in it: "%s" is substituted, otherwise appended */
export const searchTarget = (engine, term) => {
  const encoded = encodeURIComponent(term);
  return engine.url.includes("%s") ? engine.url.replace("%s", () => encoded) : engine.url + encoded;
};

/* the letter a favourite tile shows when it has no icon */
export const monogram = (url) => {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return (host.match(/[a-z0-9]/i) ?? ["?"])[0].toLowerCase();
};

/* a key for a custom engine label that does not collide with a taken one */
export const engineSlug = (label, takenKeys = []) => {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "engine";
  let key = base;
  for (let n = 2; takenKeys.includes(key); n += 1) key = `${base}-${n}`;
  return key;
};

/* a bang for a custom engine that no existing engine has claimed yet */
export const uniqueBang = (key, takenBangs = []) => {
  const taken = new Set(takenBangs.map((bang) => bang.toLowerCase()));
  let bang = (ENGINE_BANGS[key] ?? key.slice(0, 2)).toLowerCase();
  for (let n = 3; taken.has(bang) && n <= key.length; n += 1) bang = key.slice(0, n).toLowerCase();
  for (let n = 2; taken.has(bang); n += 1) bang = `${key.slice(0, 4)}${n}`.toLowerCase();
  return bang;
};
