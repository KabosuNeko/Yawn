/* `web-ext build` reads this, so test scaffolding and the local firefox chrome
   theme never end up inside the package (git archive uses .gitattributes).
   The list is belt and braces: web-ext matches the directory entry and its files
   with different patterns. */
export default {
  sourceDir: ".",
  ignoreFiles: ["test", "test/*", "**/test/*", "**/*.test.js", "web-ext-config.mjs", "userChrome.css"],
};
