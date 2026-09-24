import { hexToRgb } from "./palette.js";

export interface AnsiOptions {
  /** Force-enable or force-disable color, overriding auto-detection. Used by tests/CLI flags. */
  color?: boolean;
}

/** Auto-detects whether ANSI color output is appropriate for the current stream. */
export function shouldUseColor(stream: NodeJS.WriteStream | undefined, opts: AnsiOptions = {}): boolean {
  if (opts.color !== undefined) return opts.color;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return process.env.FORCE_COLOR !== "0";
  return Boolean(stream?.isTTY);
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

export function fgTrueColor(hex: string, text: string, enabled: boolean): string {
  if (!enabled) return text;
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

export function bold(text: string, enabled: boolean): string {
  return enabled ? `${BOLD}${text}${RESET}` : text;
}

export function dim(text: string, enabled: boolean): string {
  return enabled ? `${DIM}${text}${RESET}` : text;
}
