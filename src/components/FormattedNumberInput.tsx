"use client";

import React, { ChangeEvent, useState, useEffect } from "react";
import { formatInputMask, parseMaskedInput } from "@/lib/format-currency";

interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string | number;
  onChangeValue: (rawValue: string) => void;
  maxDecimals?: number;
}

/**
 * Input numérico con máscara en vivo (formato es-AR: puntos de miles y coma decimal).
 * Permite escribir comas y decimales sin perder el cursor ni borrar la coma al tipear.
 * Emite el valor decimal estándar (ej: "1500000.50" o "5.") a onChangeValue.
 */
export default function FormattedNumberInput({
  value,
  onChangeValue,
  maxDecimals = 2,
  className = "flowbite-input",
  placeholder = "0,00",
  ...props
}: FormattedNumberInputProps) {
  // Manejo de texto local para permitir fluidez total al tipear comas y decimales
  const [localText, setLocalText] = useState<string>(() => {
    return formatInputMask(value ?? "", maxDecimals);
  });

  // Sincronizar desde la prop 'value' externa si cambia fuera del tecleo del usuario
  useEffect(() => {
    const currentRaw = parseMaskedInput(localText);
    const propStr = value === null || value === undefined ? "" : String(value);

    // Si difieren textualmente (por ejemplo al resetear el formulario, o cálculo desde otra casilla)
    if (propStr !== currentRaw) {
      const p1 = parseFloat(propStr);
      const p2 = parseFloat(currentRaw);
      
      // Si son numéricamente iguales (ej: "5" y "5.", o "5.5" y "5.50"), no interferimos con el tipeo.
      // Si ambos son vacíos/NaN, tampoco interferimos.
      const isBothNaN = isNaN(p1) && isNaN(p2);
      const isNumEqual = !isNaN(p1) && !isNaN(p2) && p1 === p2;
      
      if (!isBothNaN && !isNumEqual) {
        setLocalText(formatInputMask(propStr, maxDecimals));
      }
    }
  }, [value, maxDecimals, localText]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let inputVal = e.target.value;
    const nativeEvent = e.nativeEvent as any;
    const typedChar = nativeEvent?.data;

    // Permitir punto como coma decimal SÓLO si el usuario explícitamente tipeó un punto
    // Esto evita que un punto de miles existente se convierta accidentalmente en coma
    if (typedChar === "." && inputVal.includes(".") && !inputVal.includes(",")) {
      // Reemplazamos el último punto tipeado por una coma, o todos.
      // Ya que el usuario tipeó un punto, lo más seguro es cambiar todos los puntos a coma
      // si es que asume que el punto es el decimal.
      // Pero ojo, si ya había puntos de miles (ej "6.575"), e insertó un punto "6.575."
      // inputVal tendría 2 puntos.
      const dotCount = (inputVal.match(/\./g) || []).length;
      if (dotCount === 1) {
        inputVal = inputVal.replace(".", ",");
      } else if (inputVal.endsWith(".")) {
        inputVal = inputVal.slice(0, -1) + ",";
      }
    }
    // AHORA: Si es un tipeo del usuario normal (no un pegado de texto), 
    // todos los puntos que queden en el string son separadores de miles de la máscara anterior.
    // Los borramos para que formatInputMask no confunda "65.7561" con un float JS de 4 decimales.
    if (nativeEvent?.inputType !== "insertFromPaste") {
      inputVal = inputVal.replace(/\./g, "");
    }

    // Formatear máscara respetando comas y decimales
    const masked = formatInputMask(inputVal, maxDecimals);
    setLocalText(masked);

    const raw = parseMaskedInput(masked);
    onChangeValue(raw);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localText}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      {...props}
    />
  );
}

