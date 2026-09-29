const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/operations/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const searchPart = `                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleEdit(op)}
                      className="flowbite-btn flowbite-btn-text"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                    >
                      ✏️ Editar Ficha
                    </button>
                  </div>`;

const replacePart = `                    onClick={(e) => e.stopPropagation()}
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

const crlfSearch = searchPart.replace(/\n/g, '\r\n');

if (content.includes(searchPart)) {
  content = content.replace(searchPart, replacePart);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Replaced with LF");
} else if (content.includes(crlfSearch)) {
  content = content.replace(crlfSearch, replacePart);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Replaced with CRLF");
} else {
  console.log("Still not found!");
}
