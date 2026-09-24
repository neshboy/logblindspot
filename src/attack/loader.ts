import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AttackDataset } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Path to the real, committed MITRE ATT&CK Enterprise snapshot shipped with this package. */
export const DEFAULT_DATASET_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "attack-enterprise.json",
);

export class AttackDatasetError extends Error {}

function assertValidDataset(value: unknown, sourcePath: string): AttackDataset {
  if (typeof value !== "object" || value === null) {
    throw new AttackDatasetError(`${sourcePath}: expected a JSON object at the top level.`);
  }
  const d = value as Partial<AttackDataset>;
  if (!Array.isArray(d.tactics) || !Array.isArray(d.techniques)) {
    throw new AttackDatasetError(
      `${sourcePath}: missing "tactics" or "techniques" arrays. Is this a LogBlindSpot ` +
        `attack-enterprise.json snapshot (see scripts/fetch-attack-data.ts)?`,
    );
  }
  for (const t of d.tactics) {
    if (typeof t.id !== "string" || typeof t.name !== "string") {
      throw new AttackDatasetError(`${sourcePath}: encountered a tactic without id/name.`);
    }
  }
  for (const t of d.techniques) {
    if (typeof t.id !== "string" || typeof t.name !== "string" || !Array.isArray(t.tactics)) {
      throw new AttackDatasetError(
        `${sourcePath}: encountered a technique without id/name/tactics (near ${JSON.stringify(t.id)}).`,
      );
    }
  }
  return d as AttackDataset;
}

/**
 * Loads the ATT&CK dataset used to compute coverage. Defaults to the real,
 * committed snapshot at data/attack-enterprise.json (see scripts/fetch-attack-data.ts
 * for provenance: it is derived from the live MITRE ATT&CK STIX bundle).
 */
export async function loadAttackDataset(
  datasetPath: string = DEFAULT_DATASET_PATH,
): Promise<AttackDataset> {
  let raw: string;
  try {
    raw = await readFile(datasetPath, "utf8");
  } catch (err) {
    throw new AttackDatasetError(
      `Could not read ATT&CK dataset at ${datasetPath}: ${(err as Error).message}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new AttackDatasetError(
      `Could not parse ATT&CK dataset at ${datasetPath} as JSON: ${(err as Error).message}`,
    );
  }
  return assertValidDataset(parsed, datasetPath);
}

/** Builds a Map from technique ID -> Technique for O(1) lookups. */
export function indexTechniquesById(dataset: AttackDataset): Map<string, AttackDataset["techniques"][number]> {
  return new Map(dataset.techniques.map((t) => [t.id, t]));
}

/** Builds a Map from tactic ID -> Tactic, preserving the real ATT&CK matrix ordering. */
export function indexTacticsById(dataset: AttackDataset): Map<string, AttackDataset["tactics"][number]> {
  return new Map(dataset.tactics.map((t) => [t.id, t]));
}
