/**
 * Fetches the real, public MITRE ATT&CK Enterprise STIX bundle and distills it
 * into the compact snapshot shipped at data/attack-enterprise.json.
 *
 * The raw bundle is ~48MB of STIX 2.1 (attack-patterns, tactics, malware,
 * groups, relationships, references, ...). LogBlindSpot only needs technique
 * IDs/names/tactic-groupings, so this script pulls exactly that out of the
 * real dataset and writes a small, readable, git-friendly JSON file.
 *
 * Usage:
 *   npm run fetch-attack-data
 *
 * If network access to the source URL is unavailable, this script fails
 * loudly rather than silently falling back to fabricated data. The committed
 * data/attack-enterprise.json is checked into the repo so the tool works
 * without network access at run time either way.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "data", "attack-enterprise.json");

interface StixExternalRef {
  source_name: string;
  external_id?: string;
  url?: string;
}

interface StixKillChainPhase {
  kill_chain_name: string;
  phase_name: string;
}

interface StixObject {
  type: string;
  id: string;
  name?: string;
  external_references?: StixExternalRef[];
  kill_chain_phases?: StixKillChainPhase[];
  x_mitre_shortname?: string;
  x_mitre_is_subtechnique?: boolean;
  x_mitre_deprecated?: boolean;
  x_mitre_platforms?: string[];
  x_mitre_domains?: string[];
  revoked?: boolean;
  tactic_refs?: string[];
}

interface StixBundle {
  type: "bundle";
  id: string;
  objects: StixObject[];
}

function mitreExternalId(obj: StixObject): string | undefined {
  return obj.external_references?.find((r) => r.source_name === "mitre-attack")
    ?.external_id;
}

function mitreUrl(obj: StixObject): string | undefined {
  return obj.external_references?.find((r) => r.source_name === "mitre-attack")
    ?.url;
}

async function main() {
  console.log(`Fetching real MITRE ATT&CK data from:\n  ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(
      `Fetch failed with HTTP ${res.status}. Not falling back to fake data - ` +
        `re-run when network access to raw.githubusercontent.com is available, ` +
        `or hand-edit data/attack-enterprise.json using another real official source.`,
    );
  }
  const bundle = (await res.json()) as StixBundle;
  if (bundle.type !== "bundle" || !Array.isArray(bundle.objects)) {
    throw new Error("Unexpected response shape - this doesn't look like a STIX bundle.");
  }

  const tacticsById = new Map<string, StixObject>();
  for (const obj of bundle.objects) {
    if (obj.type === "x-mitre-tactic") tacticsById.set(obj.id, obj);
  }

  const matrix = bundle.objects.find((o) => o.type === "x-mitre-matrix");
  if (!matrix || !matrix.tactic_refs) {
    throw new Error("Could not find x-mitre-matrix with tactic_refs in the bundle.");
  }

  const tactics = matrix.tactic_refs.map((ref) => {
    const t = tacticsById.get(ref);
    if (!t || !t.x_mitre_shortname || !t.name) {
      throw new Error(`Tactic reference ${ref} did not resolve to a usable tactic object.`);
    }
    return { id: t.x_mitre_shortname, name: t.name };
  });
  const knownTacticIds = new Set(tactics.map((t) => t.id));

  const techniques = bundle.objects
    .filter(
      (o) =>
        o.type === "attack-pattern" &&
        !o.x_mitre_deprecated &&
        !o.revoked &&
        (o.x_mitre_domains ?? []).includes("enterprise-attack"),
    )
    .map((o) => {
      const id = mitreExternalId(o);
      if (!id) return undefined;
      const tacticIds = (o.kill_chain_phases ?? [])
        .filter((p) => p.kill_chain_name === "mitre-attack")
        .map((p) => p.phase_name)
        .filter((id) => knownTacticIds.has(id));
      const isSubtechnique = Boolean(o.x_mitre_is_subtechnique);
      return {
        id,
        name: o.name ?? id,
        tactics: tacticIds,
        isSubtechnique,
        parentId: isSubtechnique ? id.split(".")[0] : null,
        platforms: o.x_mitre_platforms ?? [],
        url: mitreUrl(o) ?? `https://attack.mitre.org/techniques/${id.replace(".", "/")}`,
      };
    })
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

  const snapshot = {
    schemaVersion: 1,
    sourceName: "MITRE ATT&CK Enterprise (STIX bundle)",
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    domain: "enterprise-attack",
    tacticCount: tactics.length,
    techniqueCount: techniques.length,
    tactics,
    techniques,
  };

  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(
    `Wrote ${techniques.length} techniques across ${tactics.length} tactics to ${OUT_PATH}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
