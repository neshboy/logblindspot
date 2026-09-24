#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import { loadAttackDataset, AttackDatasetError } from "../attack/loader.js";
import { loadLogSourceConfig, LogSourceConfigError } from "../coverage/logSources.js";
import { computeCoverage } from "../coverage/calculator.js";
import { renderTerminalReport } from "../render/terminal.js";
import { renderHtmlReport } from "../render/html.js";

const program = new Command();

program
  .name("logblindspot")
  .description(
    "Map your configured log sources / EDR telemetry against the real MITRE ATT&CK matrix " +
      "and see exactly which techniques you have visibility into vs. blind spots.",
  )
  .version("0.1.0");

program
  .command("check")
  .description("Print a terminal heatmap of ATT&CK technique visibility coverage")
  .option("-s, --sources <path>", "path to your log-sources.yaml", "log-sources.yaml")
  .option("--data <path>", "override path to the ATT&CK dataset JSON (advanced)")
  .option("--full", "show every blind-spot technique per tactic instead of a truncated preview")
  .option("--no-color", "disable ANSI colors")
  .action(async (opts) => {
    try {
      const dataset = await loadAttackDataset(opts.data);
      const config = await loadLogSourceConfig(opts.sources);
      const report = computeCoverage(dataset, config);
      console.log(renderTerminalReport(report, { full: Boolean(opts.full), color: opts.color }));
      process.exitCode = 0;
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("report")
  .description("Render a static HTML heatmap of ATT&CK technique visibility coverage")
  .option("-s, --sources <path>", "path to your log-sources.yaml", "log-sources.yaml")
  .option("--data <path>", "override path to the ATT&CK dataset JSON (advanced)")
  .option("-o, --out <path>", "output HTML file path", "report.html")
  .action(async (opts) => {
    try {
      const dataset = await loadAttackDataset(opts.data);
      const config = await loadLogSourceConfig(opts.sources);
      const report = computeCoverage(dataset, config);
      const html = renderHtmlReport(report);
      await writeFile(opts.out, html, "utf8");
      console.log(
        `Wrote HTML coverage report to ${opts.out} ` +
          `(${report.totalCovered}/${report.totalTechniques} techniques covered, ${report.overallCoveragePct}%).`,
      );
      process.exitCode = 0;
    } catch (err) {
      handleError(err);
    }
  });

function handleError(err: unknown): void {
  if (err instanceof AttackDatasetError || err instanceof LogSourceConfigError) {
    console.error(`logblindspot: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  console.error(err);
  process.exitCode = 1;
}

program.parseAsync(process.argv);
