// Genera las variables CSS de la interfaz nueva a partir de replica/design/tokens.json.
// Uso: npm run ui:tokens
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const tokens = JSON.parse(fs.readFileSync(path.join(root, "replica/design/tokens.json"), "utf8"));
const px = (value) => (typeof value === "number" ? `${value}px` : value);

const base = [`--ui-font-sans: ${tokens.font.sans};`, `--ui-font-mono: ${tokens.font.mono};`];
for (const [name, t] of Object.entries(tokens.type)) {
  base.push(`--ui-fs-${name}: ${t.size}px;`, `--ui-lh-${name}: ${t.line}px;`, `--ui-fw-${name}: ${t.weight};`);
}
for (const [name, weight] of Object.entries(tokens.weight)) base.push(`--ui-fw-${name}: ${weight};`);
for (const step of tokens.space) base.push(`--ui-space-${step}: ${step}px;`);
for (const [name, radius] of Object.entries(tokens.radius)) base.push(`--ui-radius-${name}: ${radius}px;`);
for (const [name, value] of Object.entries(tokens.motion)) base.push(name === "ease" ? `--ui-ease: ${value};` : `--ui-dur-${name}: ${value};`);
for (const [name, value] of Object.entries(tokens.layout)) base.push(`--ui-${name}: ${px(value)};`);

const colors = (theme) => Object.entries(tokens.color[theme]).map(([name, value]) => `--ui-${name}: ${value};`);
// Los valores "-dark" de sombras y efectos reemplazan a los claros dentro de html.dark.
const themed = (group, prefix, dark) => Object.entries(tokens[group])
  .filter(([name]) => name.endsWith("-dark") === dark)
  .map(([name, value]) => `--ui-${prefix}${name.replace(/-dark$/, "")}: ${value};`);

const block = (selector, lines) => `${selector} {\n${lines.map((line) => `  ${line}`).join("\n")}\n}\n`;
const header = "Generado por scripts/build-ui-tokens.cjs desde replica/design/tokens.json. No editar a mano.";
const css = `/* ${header} */\n`
  + block(":root", [...base, ...colors("light"), ...themed("shadow", "shadow-", false), ...themed("effect", "", false)])
  + "\n"
  + block("html.dark", [...colors("dark"), ...themed("shadow", "shadow-", true), ...themed("effect", "", true)]);

for (const out of ["src/styles/ui-tokens.css", "replica/design/tokens.css"]) {
  fs.writeFileSync(path.join(root, out), css);
}

// Los íconos de Lucide reciben el tamaño como número, así que también van a TypeScript.
const ts = `// ${header}\nexport const iconSize = ${JSON.stringify(tokens.icon)} as const;\n`;
fs.writeFileSync(path.join(root, "src/components/ui/tokens.generated.ts"), ts);
console.log("Tokens generados en src/styles/ui-tokens.css, replica/design/tokens.css y src/components/ui/tokens.generated.ts");
