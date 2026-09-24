import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

export interface LogSource {
  name: string;
  description?: string;
  techniques: string[];
}

export interface LogSourceConfig {
  version: number;
  sources: LogSource[];
}

export class LogSourceConfigError extends Error {}

function assertValidConfig(value: unknown, sourcePath: string): LogSourceConfig {
  if (typeof value !== "object" || value === null) {
    throw new LogSourceConfigError(`${sourcePath}: top-level YAML document must be a mapping.`);
  }
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.sources)) {
    throw new LogSourceConfigError(
      `${sourcePath}: expected a top-level "sources" list. See log-sources.yaml for the expected shape.`,
    );
  }
  const sources: LogSource[] = v.sources.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new LogSourceConfigError(`${sourcePath}: sources[${i}] must be a mapping.`);
    }
    const s = raw as Record<string, unknown>;
    if (typeof s.name !== "string" || s.name.trim() === "") {
      throw new LogSourceConfigError(`${sourcePath}: sources[${i}] is missing a non-empty "name".`);
    }
    if (!Array.isArray(s.techniques)) {
      throw new LogSourceConfigError(
        `${sourcePath}: sources[${i}] ("${s.name}") is missing a "techniques" list.`,
      );
    }
    const techniques = s.techniques.map((t, j) => {
      if (typeof t !== "string" || t.trim() === "") {
        throw new LogSourceConfigError(
          `${sourcePath}: sources[${i}] ("${s.name}") techniques[${j}] must be a non-empty string.`,
        );
      }
      return t.trim().toUpperCase();
    });
    return {
      name: s.name.trim(),
      description: typeof s.description === "string" ? s.description : undefined,
      techniques,
    };
  });
  return {
    version: typeof v.version === "number" ? v.version : 1,
    sources,
  };
}

/** Loads and validates a user's log-sources.yaml mapping file. */
export async function loadLogSourceConfig(sourcePath: string): Promise<LogSourceConfig> {
  let raw: string;
  try {
    raw = await readFile(sourcePath, "utf8");
  } catch (err) {
    throw new LogSourceConfigError(
      `Could not read log sources file at ${sourcePath}: ${(err as Error).message}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new LogSourceConfigError(
      `Could not parse ${sourcePath} as YAML: ${(err as Error).message}`,
    );
  }
  return assertValidConfig(parsed, sourcePath);
}

/** Parses an already-loaded YAML/JS value (used by tests to avoid touching the filesystem). */
export function parseLogSourceConfig(value: unknown, sourcePath = "<inline>"): LogSourceConfig {
  return assertValidConfig(value, sourcePath);
}
