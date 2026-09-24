/** Core data model for the real MITRE ATT&CK Enterprise dataset we ship/parse. */

export interface Tactic {
  /** Real ATT&CK tactic short name, e.g. "initial-access". Also the matrix column key. */
  id: string;
  /** Real ATT&CK tactic display name, e.g. "Initial Access". */
  name: string;
}

export interface Technique {
  /** Real ATT&CK technique (or sub-technique) ID, e.g. "T1055" or "T1055.011". */
  id: string;
  /** Real ATT&CK technique name. */
  name: string;
  /** Tactic short-name IDs this technique appears under (a technique can span multiple tactics). */
  tactics: string[];
  isSubtechnique: boolean;
  /** Parent technique ID if this is a sub-technique, else null. */
  parentId: string | null;
  platforms: string[];
  /** Canonical attack.mitre.org URL for this technique. */
  url: string;
}

export interface AttackDataset {
  schemaVersion: number;
  sourceName: string;
  sourceUrl: string;
  /** ISO timestamp of when this snapshot was generated from the source. */
  fetchedAt: string;
  domain: string;
  tacticCount: number;
  techniqueCount: number;
  tactics: Tactic[];
  techniques: Technique[];
}
