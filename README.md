# LogBlindSpot

**Do you even have the data to detect a technique, before you worry about whether a rule fires?**

LogBlindSpot maps the log sources and EDR telemetry you've actually onboarded against the real
MITRE ATT&CK Enterprise matrix, and renders a coverage heatmap that shows exactly which
techniques you have raw **visibility** into versus which are blind spots — so you can prioritize
the next log source to onboard based on real gaps instead of guesswork.

```
LogBlindSpot — ATT&CK Visibility Coverage
Dataset: MITRE ATT&CK Enterprise (STIX bundle) (snapshot fetched 2026-09-24T09:41:28.887Z)
697 techniques across 15 tactics — sources configured: Sysmon, Windows Security Event Log, Zeek, osquery

Overall visibility: 57/697 techniques (8.2%)
  █ = covered by >=1 configured source   ░ = blind spot (zero configured sources)

  Reconnaissance  1/46 (2.2%)
    ░░░░░░░░░░░░░░░░░░░░░░░░░█░░░░░░░░░░░░░░░░░░░░

  Collection  0/41 (0%)
    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  ...
```

## Why this exists (and how it differs from `detectionci`)

This is a companion tool to [`detectionci`](../detectionci) (same author) — but it answers a
*different, earlier* question:

| Tool | Question it answers | Input | Output |
|---|---|---|---|
| **LogBlindSpot** | Do we have the **telemetry** to even detect this technique? | Your configured log sources (`log-sources.yaml`) | A visibility/blind-spot heatmap over the ATT&CK matrix |
| **`detectionci`** | Given that we have the data, does our **Sigma rule** still fire correctly? | Your Sigma detection rules + test logs | Pass/fail regression results per rule |

You can have a perfectly-written Sigma rule for T1055 (Process Injection) that will never fire
in production because nothing in your environment is generating the ProcessAccess/CreateRemoteThread
events it depends on. `detectionci` will happily tell you the rule logic is correct against a
sample log. It has no way of knowing your fleet doesn't actually produce that log. LogBlindSpot is
the check that runs *before* that one: it never looks at rule logic at all, only at whether any of
your configured sources plausibly produce telemetry for a given technique. A technique showing
"covered" here means "you have a fighting chance of writing a rule that fires" — not "you have a
rule," and definitely not "your rule works." Run LogBlindSpot to find gaps in your data pipeline,
then use `detectionci` to keep the rules you build on top of that data honest over time.

## Real data — what's actually in this repo

- **ATT&CK dataset**: the real, public, official MITRE ATT&CK Enterprise STIX 2.1 bundle at
  `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json`.
  This tool **fetched that URL live** (no network fallback was needed) and distilled it into
  [`data/attack-enterprise.json`](data/attack-enterprise.json) — a trimmed, git-friendly snapshot
  containing only the fields LogBlindSpot needs (technique ID, name, tactics, sub-technique
  parent, platforms, canonical URL). The full raw bundle is ~48MB of STIX (malware, groups,
  campaigns, 21k+ relationships, etc.); the shipped snapshot is ~225KB.
  - Snapshot fetched: `2026-09-24T09:41:28.887Z`.
  - Real technique/tactic counts as fetched: **697 techniques** (222 top-level + 475
    sub-techniques) across **15 tactics**.
  - Regenerate it any time with `npm run fetch-attack-data` (see
    [`scripts/fetch-attack-data.ts`](scripts/fetch-attack-data.ts)) — it fetches live and fails
    loudly rather than silently substituting fake data if the source is unreachable.
  - Note on tactic count: as fetched, the live CTI dataset enumerates **15** Enterprise tactics
    rather than the historically-cited 14 — `Defense Evasion` is represented here as two tactics,
    `Stealth` and `Defense Impairment` (e.g. the technique historically numbered `T1562` appears
    in this snapshot renumbered to `T1685`, "Disable or Modify Tools"). LogBlindSpot doesn't hardcode
    tactic names or technique IDs anywhere — it reads whatever the live dataset says, so this file
    (and the CLI) will track future ATT&CK restructuring automatically the next time you regenerate
    the snapshot.
  - The tool works fully offline after that: the CLI reads the committed snapshot, no network
    access is required at run time.

- **Log source starter mapping** ([`log-sources.yaml`](log-sources.yaml)): a real,
  reasonably-researched starting point for four commonly-deployed sources — **Sysmon**,
  **Windows Security Event Log**, **Zeek**, and **osquery** — mapping each to real ATT&CK
  technique IDs based on their publicly documented capabilities (Sysmon event types, Windows
  Advanced Audit Policy subcategories, Zeek's standard protocol logs, osquery's standard tables).
  Every technique ID in that file was checked against the fetched dataset before being committed
  (`npm test` also asserts every ID in it is real and well-formed). **This is a starting point,
  not authoritative vendor documentation** — see [Limitations](#limitations).

## Install / quick start

Requires Node.js 18+.

```bash
git clone <this repo>
cd logblindspot
npm install
npm run build

# Terminal heatmap using the shipped example log-sources.yaml
node dist/cli/index.js check --sources log-sources.yaml

# Static HTML heatmap
node dist/cli/index.js report --sources log-sources.yaml -o report.html
```

Or, without building first:

```bash
npm run check     # tsx src/cli/index.ts check  --sources log-sources.yaml
npm run report    # tsx src/cli/index.ts report --sources log-sources.yaml -o report.html
```

Once linked/installed as a package (`npm link`, or `npm install -g .`), both commands are also
available as:

```bash
logblindspot check --sources log-sources.yaml
logblindspot report --sources log-sources.yaml -o report.html
```

### CLI reference

```
logblindspot check --sources <path>   [--full] [--no-color] [--data <path>]
logblindspot report --sources <path>  -o <path> [--data <path>]
```

- `--sources <path>` — path to your `log-sources.yaml` (default: `log-sources.yaml`).
- `--full` (`check` only) — print every blind-spot technique per tactic instead of a truncated
  preview (the HTML report always lists the full set, under a collapsible section per tactic).
- `--no-color` (`check` only) — disable ANSI colors (also respected: the `NO_COLOR` env var, and
  auto-disabled when stdout isn't a TTY).
- `-o, --out <path>` (`report` only) — output HTML file path (default: `report.html`).
- `--data <path>` — advanced: point at a different ATT&CK dataset JSON in the same shape as
  `data/attack-enterprise.json`, e.g. one you regenerated or hand-curated yourself.

### Customizing your coverage

Edit `log-sources.yaml` (or copy it and pass `--sources your-file.yaml`). Each entry is:

```yaml
sources:
  - name: CrowdStrike Falcon
    description: EDR agent - process, network, file, and registry telemetry.
    techniques:
      - T1055
      - T1055.012 # sub-techniques are tracked independently of their parent
      - T1003.001
```

Re-run `logblindspot check` after every edit — coverage is recomputed from scratch each run, and
any technique ID that doesn't match the loaded ATT&CK dataset is flagged as an unrecognized
reference (a very common typo-catcher) rather than silently ignored.

## How coverage is computed

For every technique in the ATT&CK dataset, LogBlindSpot checks whether **any** configured source
lists that exact technique ID. A technique counts as covered the moment one source claims
visibility into it — this is deliberately generous and deliberately *not* a statement about
detection quality: it's a floor ("could we plausibly see this at all"), not a ceiling. A
sub-technique (`T1055.012`) is tracked independently of its parent technique (`T1055`) — listing
the parent does not automatically cover its sub-techniques, since sub-techniques often need
materially different telemetry. Per-tactic percentages count a technique once per tactic it
belongs to (matching how the real ATT&CK matrix places a technique in multiple tactic columns);
the overall percentage counts each technique exactly once regardless of how many tactics it spans.

## Limitations

- **The starter `log-sources.yaml` mapping is a reasonable-effort starting point, not
  authoritative vendor documentation.** It was built from public, general knowledge of each
  source's default capabilities, not from running each product against a live ATT&CK evaluation
  or reading every vendor's current technique-mapping whitepaper line by line. Your actual
  coverage depends heavily on *your* configuration: which Sysmon config you deployed, which
  Windows Advanced Audit Policy subcategories are enabled, which Zeek scripts/packages are
  loaded, which osquery tables/packs you actually schedule. **Verify every mapping against your
  own environment and vendor docs before treating the numbers as ground truth.**
- "Covered" means *raw telemetry could plausibly support a detection* — it says nothing about
  whether a detection rule exists, is enabled, or actually fires. That's `detectionci`'s job.
  A technique can show "covered" here and still have zero real detections behind it.
  Rule quality, is out of scope by design.
- Coverage is binary per technique (covered / blind spot), not weighted by data quality, retention
  window, or log volume/sampling. A source that logs a technique's events for 3 days before
  rotating counts the same as one that retains a year.
  Retention/quality-weighted coverage is a natural follow-up, not implemented here.
  ATT&CK Mobile, ICS, and PRE-ATT&CK-only content are also out of scope — Enterprise only.
- The HTML report is static, hand-written markup/CSS with no JavaScript (matching this project's
  "generate real markup from computed data" approach) — there's no live filtering/search in the
  browser; the terminal `check` command's `--full` flag and the HTML's full blind-spot tables
  under each tactic are the workaround.
- This is a fresh MVP: no config file merging/includes, no per-platform (Windows/Linux/macOS)
  filtering of the matrix, and no CI integration yet (unlike `detectionci`, which is built for
  CI). Contributions welcome.

## Development

```bash
npm install
npm test              # vitest run — dataset loading, coverage calculation, HTML well-formedness
npm run build          # tsc -> dist/
npm run fetch-attack-data   # re-fetch the live MITRE ATT&CK bundle and regenerate data/attack-enterprise.json
```

## License

MIT — see [LICENSE](LICENSE).
