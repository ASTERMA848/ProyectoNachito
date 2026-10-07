"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface LiquidSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface LiquidSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: LiquidSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function LiquidSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccione una opción...",
  required,
  disabled,
  className,
  style,
}: LiquidSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Recalcular posición al abrir
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`liquid-select-container ${className || ""}`}
      style={{ position: "relative", width: "100%", ...style }}
    >
      {/* Botón Disparador (Trigger) */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className="flowbite-input liquid-select-trigger"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          width: "100%",
          padding: "10px 16px",
          minHeight: "42px",
          color: selectedOption ? "var(--ots-text-primary)" : "var(--ots-text-muted)",
          backgroundColor: "var(--ots-surface-1)",
          borderColor: isOpen ? "var(--ots-primary)" : "var(--ots-border)",
          boxShadow: isOpen
            ? "0 0 0 3px rgba(79, 70, 229, 0.15)"
            : "0 1px 2px rgba(0, 0, 0, 0.03)",
          transition: "all 150ms ease",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginRight: "8px",
            fontSize: "14px",
            fontWeight: selectedOption ? 500 : 400,
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          style={{
            width: "16px",
            height: "16px",
            flexShrink: 0,
            color: "var(--ots-text-muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Menú Desplegable Renderizado en Portal Flotante (Anti-Clipping) */}
      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="liquid-select-menu"
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999,
            background: "var(--ots-surface-1)",
            border: "1px solid var(--ots-border)",
            borderRadius: "var(--ots-radius-md)",
            padding: "6px",
            boxShadow:
              "0 20px 35px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            maxHeight: "260px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            animation: "selectMenuIn 0.15s ease forwards",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "10px 14px",
                fontSize: "14px",
                color: "var(--ots-text-muted)",
                textAlign: "center",
              }}
            >
              No hay opciones disponibles
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: "9px 12px",
                    borderRadius: "var(--ots-radius-sm)",
                    cursor: "pointer",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: isSelected
                      ? "var(--ots-primary-muted)"
                      : "transparent",
                    color: isSelected ? "var(--ots-primary)" : "var(--ots-text-primary)",
                    fontWeight: isSelected ? 600 : 400,
                    transition: "all 120ms ease",
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "var(--ots-surface-2)";
                      e.currentTarget.style.color = "var(--ots-text-primary)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--ots-text-primary)";
                    }
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                    <span>{opt.label}</span>
                    {opt.sublabel && (
                      <span style={{ fontSize: "12px", color: "var(--ots-text-muted)" }}>
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      style={{ width: "16px", height: "16px", color: "var(--ots-primary)", flexShrink: 0, marginLeft: "8px" }}
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              );
            })
          )}
        </div>,
        document.body
      )}

      {/* Input oculto para validación de form HTML5 */}
      {required && (
        <input
          type="text"
          value={value}
          required={required}
          onChange={() => {}}
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
            height: 0,
            width: 0,
            bottom: 0,
          }}
          tabIndex={-1}
        />
      )}
    </div>
  );
}
