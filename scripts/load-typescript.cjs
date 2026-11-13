const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");

module.exports = function loadTypeScript(filename) {
  const previous = Module._extensions[".ts"];
  Module._extensions[".ts"] = (loadedModule, sourceFile) => {
    const source = fs.readFileSync(sourceFile, "utf8");
    loadedModule._compile(ts.transpile(source, {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    }), sourceFile);
  };
  try {
    return require(filename);
  } finally {
    if (previous) Module._extensions[".ts"] = previous;
    else delete Module._extensions[".ts"];
  }
};
