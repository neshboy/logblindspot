import type { AttackDataset } from "../attack/types.js";
import type { LogSourceConfig } from "./logSources.js";

export interface TechniqueCoverage {
  techniqueId: string;
  name: string;
  tactics: string[];
  isSubtechnique: boolean;
  parentId: string | null;
  url: string;
  covered: boolean;
  /** Names of configured log sources that claim visibility into this technique. */
  coveringSources: string[];
}

export interface TacticCoverage {
  tacticId: string;
  tacticName: string;
  total: number;
  covered: number;
  coveragePct: number;
  techniques: TechniqueCoverage[];
}

export interface UnknownTechniqueReference {
  sourceName: string;
  techniqueId: string;
}

export interface CoverageReport {
  generatedAt: string;
  dataset: {
    sourceName: string;
    sourceUrl: string;
    fetchedAt: string;
  };
  sourceNames: string[];
  totalTechniques: number;
  totalCovered: number;
  overallCoveragePct: number;
  tactics: TacticCoverage[];
  /**
   * Technique IDs referenced in the user's log-sources.yaml that don't exist in the
   * ATT&CK dataset - almost always a typo (e.g. "T10550" or "T1055.99"). Surfaced so
   * users can trust the coverage numbers rather than silently dropping bad input.
   */
  unknownTechniqueReferences: UnknownTechniqueReference[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Cross-references a user's configured log sources against the real ATT&CK dataset.
 * A technique counts as "covered" the moment at least one configured source claims
 * visibility into it - this is a visibility/telemetry question, not a statement about
 * whether a detection rule actually exists or fires (that's detectionci's job).
 */
export function computeCoverage(
  dataset: AttackDataset,
  config: LogSourceConfig,
): CoverageReport {
  const knownTechniqueIds = new Set(dataset.techniques.map((t) => t.id));
  const coveringSourcesByTechnique = new Map<string, string[]>();
  const unknownTechniqueReferences: UnknownTechniqueReference[] = [];

  for (const source of config.sources) {
    for (const techniqueId of source.techniques) {
      if (!knownTechniqueIds.has(techniqueId)) {
        unknownTechniqueReferences.push({ sourceName: source.name, techniqueId });
        continue;
      }
      const existing = coveringSourcesByTechnique.get(techniqueId);
      if (existing) {
        if (!existing.includes(source.name)) existing.push(source.name);
      } else {
        coveringSourcesByTechnique.set(techniqueId, [source.name]);
      }
    }
  }

  const techniqueCoverageById = new Map<string, TechniqueCoverage>();
  for (const t of dataset.techniques) {
    const coveringSources = coveringSourcesByTechnique.get(t.id) ?? [];
    techniqueCoverageById.set(t.id, {
      techniqueId: t.id,
      name: t.name,
      tactics: t.tactics,
      isSubtechnique: t.isSubtechnique,
      parentId: t.parentId,
      url: t.url,
      covered: coveringSources.length > 0,
      coveringSources,
    });
  }

  const tactics: TacticCoverage[] = dataset.tactics.map((tactic) => {
    const techniques = dataset.techniques
      .filter((t) => t.tactics.includes(tactic.id))
      .map((t) => techniqueCoverageById.get(t.id)!);
    const covered = techniques.filter((t) => t.covered).length;
    return {
      tacticId: tactic.id,
      tacticName: tactic.name,
      total: techniques.length,
      covered,
      coveragePct: techniques.length === 0 ? 0 : round1((covered / techniques.length) * 100),
      techniques,
    };
  });

  const totalTechniques = dataset.techniques.length;
  const totalCovered = [...techniqueCoverageById.values()].filter((t) => t.covered).length;

  return {
    generatedAt: new Date().toISOString(),
    dataset: {
      sourceName: dataset.sourceName,
      sourceUrl: dataset.sourceUrl,
      fetchedAt: dataset.fetchedAt,
    },
    sourceNames: config.sources.map((s) => s.name),
    totalTechniques,
    totalCovered,
    overallCoveragePct: totalTechniques === 0 ? 0 : round1((totalCovered / totalTechniques) * 100),
    tactics,
    unknownTechniqueReferences,
  };
}
