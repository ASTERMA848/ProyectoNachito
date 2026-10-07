/**
 * Utilidades centralizadas para formateo de montos y divisas en formato es-AR
 * (Punto para separación de miles, coma para separación de decimales).
 */

/**
 * Formatea un número o string numérico a string para visualización es-AR
 * Ejemplo: 1500000.5 => "1.500.000,50" o "1.500.000"
 */
export function formatMoney(
  value: number | string | null | undefined,
  decimals: number = 2,
  includeDecimalsIfZero: boolean = true
): string {
  if (value === null || value === undefined || value === "") return "0,00";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return "0,00";

  return num.toLocaleString("es-AR", {
    minimumFractionDigits: includeDecimalsIfZero ? decimals : 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formatea con código o símbolo de moneda
 * Ejemplo: formatCurrency(1500000, "ARS") => "$ 1.500.000,00" o "1.500.000,00 ARS"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currencyCode?: string,
  decimals: number = 2
): string {
  const formatted = formatMoney(value, decimals, true);
  if (!currencyCode) return formatted;
  const isArs = currencyCode.toUpperCase() === "ARS";
  return isArs ? `$ ${formatted}` : `${formatted} ${currencyCode}`;
}

/**
 * Limpia y formatea el valor ingresado por el usuario para una máscara de input en tiempo real.
 * Permite escribir enteros con puntos automáticos y hasta `maxDecimals` decimales con coma.
 */
/**
 * Limpia y formatea el valor ingresado por el usuario para una máscara de input en tiempo real.
 * Permite escribir enteros con puntos automáticos y hasta `maxDecimals` decimales con coma.
 */
/**
 * Formatea un valor para máscara en input:
/**
 * Formatea un valor para máscara en input:
 * `value`: puede ser un número JS (1500000.5), un string raw numérico ("1500000.50"),
 * o lo que el usuario está escribiendo en el input ("1.500.000,50").
 */
export function formatInputMask(value: string | number, maxDecimals: number = 2): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).trim();
  if (!str) return "";

  // 1. Si el string tiene coma ",", el usuario ya puso coma decimal
  if (str.includes(",")) {
    const cleanWithoutDots = str.replace(/\./g, "");
    const parts = cleanWithoutDots.split(",");
    const intPart = parts[0];
    // Conservamos la coma incluso si aún no hay dígitos decimales (ej: "5,")
    const decPart = parts.slice(1).join("");
    return formatParts(intPart, decPart, maxDecimals);
  }

  // 2. Si el valor viene como número JS nativo:
  if (typeof value === "number") {
    const parts = str.split(".");
    return formatParts(parts[0], parts[1], maxDecimals);
  }

  // 3. Si el string tiene un punto "." pero NO comas:
  // Podría ser un float de base de datos / JS (ej: "1500.50" o "12.3456")
  // O un string con puntos de miles (ej: "51.515").
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount === 1) {
    const [partA, partB] = str.split(".");
    // Si la parte B tiene entre 1 y maxDecimals dígitos y NO es 3 dígitos (o maxDecimals !== 3),
    // o si el número original venía de un cálculo JS (ej "10.5", "100.25")
    if (partB.length <= maxDecimals && (partB.length !== 3 || maxDecimals === 3)) {
      // Lo consideramos float de JS
      return formatParts(partA, partB, maxDecimals);
    }
  }

  // En cualquier otro caso de string con puntos, son separadores de miles
  const cleanInt = str.replace(/\./g, "");
  return formatParts(cleanInt, undefined, maxDecimals);
}

function formatParts(intPart: string = "", decPart: string | undefined, maxDecimals: number): string {
  const cleanInt = intPart.replace(/\D/g, "");
  
  let formattedInt = "";
  if (cleanInt) {
    formattedInt = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  if (decPart === undefined) {
    return formattedInt;
  }

  if (!formattedInt) {
    formattedInt = "0";
  }

  const cleanDec = decPart.replace(/\D/g, "").slice(0, maxDecimals);
  return `${formattedInt},${cleanDec}`;
}



/**
 * Convierte el valor con máscara de input ("1.500.000,50") al string numérico estándar ("1500000.50")
 * adecuado para guardar en base de datos o usar en cálculos matemáticos.
 */
export function parseMaskedInput(maskedValue: string): string {
  if (!maskedValue) return "";
  const clean = maskedValue.replace(/\./g, "").replace(",", ".");
  // Si termina en punto (usuario recién puso la coma), quitar o mantener según convenga
  const num = parseFloat(clean);
  if (isNaN(num)) return "";
  return clean;
}
