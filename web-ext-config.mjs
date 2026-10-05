/* `web-ext build` and `web-ext sign` read this. Two patterns per directory on
   purpose: web-ext matches the directory entry and the files inside it separately. */
export default {
  sourceDir: ".",
  ignoreFiles: [
    "test",
    "test/*",
    "**/test/*",
    "**/*.test.js",
    "web-ext-config.mjs",
    "AGENTS.md",
    "README.md",
    "userChrome.css",
    "images/src",
    "images/logo.png",
    "images/preview.png",
    "*.har",
  ],
};
