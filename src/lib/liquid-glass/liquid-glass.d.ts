export declare class LiquidGlassElement extends HTMLElement {
  static readonly interactive: boolean;
  static readonly observedAttributes: string[];
  render(): void;
  styles(): string;
  body(): string;
}

export declare class LiquidGlass extends LiquidGlassElement {}

export declare class LiquidGlassCard extends LiquidGlassElement {
  static readonly interactive: true;
}

export declare class LiquidGlassButton extends LiquidGlassElement {
  static readonly interactive: true;
}

export declare function sanitizeURL(value: unknown): string;
export declare function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number;

declare global {
  interface HTMLElementTagNameMap {
    "liquid-glass": LiquidGlass;
    "liquid-glass-card": LiquidGlassCard;
    "liquid-glass-button": LiquidGlassButton;
  }
}
