const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/operations/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const searchRegex = /<div\s+style=\{\{\s*display:\s*"flex",\s*justifyContent:\s*"flex-end",\s*gap:\s*"10px",\s*marginTop:\s*"4px",\s*borderTop:\s*"1px solid var\(--border-color\)",\s*paddingTop:\s*"8px",?\s*\}\}\s+onClick=\{\(e\) => e.stopPropagation\(\)\}\s*>\s*<button\s+onClick=\{\(\) => handleEdit\(op\)\}\s+className="flowbite-btn flowbite-btn-text"\s+style=\{\{\s*padding:\s*"6px 12px",\s*fontSize:\s*"12px"\s*\}\}\s*>\s*✏️ Editar Ficha\s*<\/button>\s*<\/div>/g;

const replaceWith = `<div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "10px",
                      marginTop: "4px",
                      borderTop: "1px solid var(--border-color)",
                      paddingTop: "8px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LiquidMenu
                      align="end"
                      items={[
                        { label: "✏️ Editar Ficha", onSelect: () => handleEdit(op) },
                        { label: "📜 Tracking de Historial", onSelect: () => openHistoryModal(op) }
                      ]}
                      trigger={
                        <button
                          className="flowbite-btn flowbite-btn-text"
                          style={{ padding: "6px 12px", fontSize: "12px", color: "var(--color-ash)" }}
                        >
                          Acciones ▾
                        </button>
                      }
                    />
                  </div>`;

if (!content.match(searchRegex)) {
  console.log("Could not find the mobile block with the regex.");
} else {
  content = content.replace(searchRegex, replaceWith);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Replaced mobile action buttons.");
}
