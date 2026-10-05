import { test } from "node:test";
import assert from "node:assert/strict";

import { ENGINE_BANGS, engineSlug, monogram, searchTarget, siteKey, toUrl, uniqueBang } from "../lib.js";

test("toUrl takes absolute urls and promotes bare hosts", () => {
  assert.equal(toUrl("https://example.com/path?q=1").href, "https://example.com/path?q=1");
  assert.equal(toUrl("https://Example.COM/Path").href, "https://example.com/Path");
  assert.equal(toUrl("example.com").href, "https://example.com/");
  assert.equal(toUrl("192.168.1.1:8080/x").href, "https://192.168.1.1:8080/x");
});

test("toUrl refuses what should be searched instead", () => {
  assert.equal(toUrl("hello world"), null);
  assert.equal(toUrl("localhost:3000"), null);
  assert.equal(toUrl("file:///etc/hosts"), null);
  assert.equal(toUrl("mailto:someone@example.com"), null);
  assert.equal(toUrl("someone@example.com"), null);
});

test("searchTarget substitutes %s and otherwise appends", () => {
  assert.equal(searchTarget({ url: "https://x.test/?q=%s" }, "a b"), "https://x.test/?q=a%20b");
  assert.equal(searchTarget({ url: "https://x.test/?q=" }, "a b"), "https://x.test/?q=a%20b");
  // a "$" in the query must not be read as a replacement pattern
  assert.equal(searchTarget({ url: "https://x.test/?q=%s" }, "$&"), "https://x.test/?q=%24%26");
});

test("monogram is the first letter of the host, without www", () => {
  assert.equal(monogram("https://www.python.org/"), "p");
  assert.equal(monogram("https://github.com/x"), "g");
  assert.equal(monogram("https://192.168.1.1/"), "1");
});

test("siteKey folds www and trailing slashes but keeps paths apart", () => {
  assert.equal(siteKey("https://www.example.com/"), siteKey("https://example.com"));
  assert.equal(siteKey("http://EXAMPLE.com"), siteKey("https://example.com/"));
  assert.notEqual(siteKey("https://example.com/a"), siteKey("https://example.com/b"));
});

test("engineSlug keeps labels apart", () => {
  assert.equal(engineSlug("My Engine"), "my-engine");
  assert.equal(engineSlug("My Engine", ["my-engine"]), "my-engine-2");
  assert.equal(engineSlug("My Engine", ["my-engine", "my-engine-2"]), "my-engine-3");
  assert.equal(engineSlug("!!! ???"), "engine");
});

test("toUrl keeps a credentialed url that was typed in full", () => {
  assert.equal(toUrl("https://user@example.com/x").href, "https://user@example.com/x");
});

test("uniqueBang never steals a bang in use", () => {
  assert.equal(uniqueBang("lite"), "li");
  assert.equal(uniqueBang("g", ["g"]), "g2");
  // "dd" is free even though the shipped DuckDuckGo engine owns "ddg"
  assert.equal(uniqueBang("ddg", [ENGINE_BANGS.duckduckgo]), "dd");
  assert.equal(uniqueBang("dd", ["dd"]), "dd2");
  assert.equal(uniqueBang("bi", ["bi"]), "bi2");
  assert.equal(uniqueBang("S", ["s"]), "s2");
});
