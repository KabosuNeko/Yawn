/* `web-ext build` reads this. Two patterns per directory on purpose: web-ext
   matches the directory entry and the files inside it separately. */
export default {
  sourceDir: ".",
  ignoreFiles: ["test", "test/*", "**/test/*", "**/*.test.js", "web-ext-config.mjs", "build-site.mjs", "userChrome.css", "images/src", "AGENTS.md", "docs", "docs/*"],
};
