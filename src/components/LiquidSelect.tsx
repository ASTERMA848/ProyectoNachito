"use client";

import { useEffect, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="flowbite-input liquid-select-trigger"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          width: "100%",
          padding: "10px 16px",
          minHeight: "44px",
          color: selectedOption ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
          borderColor: isOpen ? "rgba(103, 152, 255, 0.8)" : "rgba(255, 255, 255, 0.18)",
          boxShadow: isOpen
            ? "0 0 0 3px rgba(103, 152, 255, 0.25), inset 0 1px 2px rgba(0, 0, 0, 0.2)"
            : "inset 0 1px 2px rgba(0, 0, 0, 0.2)",
          transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginRight: "8px",
            fontSize: "15px",
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
            color: "rgba(255, 255, 255, 0.65)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Menú Desplegable LiquidGlass */}
      {isOpen && (
        <div
          className="liquid-select-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "linear-gradient(160deg, rgba(16, 22, 48, 0.78) 0%, rgba(8, 12, 30, 0.88) 100%)",
            WebkitBackdropFilter: "blur(32px) saturate(160%) brightness(110%)",
            backdropFilter: "blur(32px) saturate(160%) brightness(110%)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            borderRadius: "16px",
            padding: "6px",
            boxShadow:
              "0 20px 48px rgba(0, 0, 0, 0.65), 0 0 35px rgba(103, 152, 255, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.38)",
            maxHeight: "260px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            animation: "selectMenuIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "10px 14px",
                fontSize: "14px",
                color: "rgba(255, 255, 255, 0.45)",
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
                    padding: "10px 14px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    fontSize: "14.5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(103, 152, 255, 0.28) 0%, rgba(70, 110, 220, 0.18) 100%)"
                      : "transparent",
                    color: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.85)",
                    border: isSelected ? "1px solid rgba(103, 152, 255, 0.45)" : "1px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.color = "#ffffff";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "rgba(255, 255, 255, 0.85)";
                    }
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                    <span style={{ fontWeight: isSelected ? 500 : 400 }}>{opt.label}</span>
                    {opt.sublabel && (
                      <span style={{ fontSize: "12.5px", color: "rgba(255, 255, 255, 0.5)" }}>
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      style={{ width: "16px", height: "16px", color: "#6798ff", flexShrink: 0, marginLeft: "8px" }}
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
        </div>
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
