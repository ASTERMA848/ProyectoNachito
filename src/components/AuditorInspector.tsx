"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AuditorInspector({ user }: { user: any }) {
  const pathname = usePathname();
  const [hoveredElement, setHoveredElement] = useState<{
    name: string;
    type: string;
    tagName: string;
    required: boolean;
    maxLength: string | null;
    rect: DOMRect;
  } | null>(null);

  // Solo habilitado para AUDITOR o el usuario admin
  const isAuditor = user?.role === "AUDITOR" || user?.username === "admin";

  useEffect(() => {
    if (!isAuditor || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Filtrar elementos de formulario
      const validTags = ["INPUT", "SELECT", "TEXTAREA"];
      if (validTags.includes(target.tagName)) {
        const inputTarget = target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        
        setHoveredElement({
          name: inputTarget.name || "Sin nombre técnico",
          type: inputTarget.type || "text",
          tagName: target.tagName.toLowerCase(),
          required: inputTarget.required,
          maxLength: target.getAttribute("maxLength"),
          rect: target.getBoundingClientRect(),
        });
      } else {
        setHoveredElement(null);
      }
    };

    const handleScroll = () => {
      setHoveredElement(null);
    };

    document.addEventListener("mouseover", handleMouseOver);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isAuditor]);

  if (!isAuditor || !hoveredElement) return null;

  // Inferir modelo según la URL
  let inferredModel = "Desconocido";
  if (pathname.includes("/operations")) inferredModel = "Operation";
  else if (pathname.includes("/contacts")) inferredModel = "Contact";
  else if (pathname.includes("/accounts")) inferredModel = "Account";
  else if (pathname.includes("/settings")) {
    // Es difícil saber exacto en settings, pero damos pistas
    inferredModel = "Currency / User / Tag / Settings";
  }

  // Posicionar el tooltip un poco por debajo o arriba del elemento
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    top: hoveredElement.rect.bottom + 8 + "px",
    left: Math.max(8, Math.min(hoveredElement.rect.left, window.innerWidth - 288)) + "px",
    backgroundColor: "rgba(17, 24, 39, 0.95)",
    color: "#f9fafb",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "12px",
    zIndex: 9999,
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
    pointerEvents: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    minWidth: "220px",
    maxWidth: "min(280px, calc(100vw - 16px))",
    overflowWrap: "anywhere",
    fontFamily: "monospace",
  };

  // Ajuste rudimentario para que no se salga de la pantalla por abajo
  if (hoveredElement.rect.bottom + 150 > window.innerHeight) {
    tooltipStyle.top = "auto";
    tooltipStyle.bottom = (window.innerHeight - hoveredElement.rect.top + 8) + "px";
  }

  return (
    <div style={tooltipStyle} className="animate-fade-in">
      <div style={{ fontWeight: 800, color: "#34d399", marginBottom: "6px", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em" }}>
        🔍 Inspector de Auditoría
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div><strong style={{ color: "#9ca3af" }}>Modelo sugerido:</strong> {inferredModel}</div>
        <div><strong style={{ color: "#9ca3af" }}>Campo (name):</strong> {hoveredElement.name}</div>
        <div><strong style={{ color: "#9ca3af" }}>Elemento HTML:</strong> &lt;{hoveredElement.tagName}&gt;</div>
        <div><strong style={{ color: "#9ca3af" }}>Tipo de dato:</strong> {hoveredElement.type}</div>
        {hoveredElement.required && <div style={{ color: "#f87171", fontWeight: 700 }}>* Requerido (NOT NULL)</div>}
        {hoveredElement.maxLength && <div><strong style={{ color: "#9ca3af" }}>Largo máximo:</strong> {hoveredElement.maxLength}</div>}
      </div>
    </div>
  );
}
