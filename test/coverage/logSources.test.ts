import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadLogSourceConfig,
  parseLogSourceConfig,
  LogSourceConfigError,
} from "../../src/coverage/logSources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "log-sources.fixture.yaml");
const REAL_STARTER_PATH = path.join(__dirname, "..", "..", "log-sources.yaml");

describe("loadLogSourceConfig", () => {
  it("parses the fixture log-sources.yaml into typed sources", async () => {
    const config = await loadLogSourceConfig(FIXTURE_PATH);
    expect(config.sources.map((s) => s.name)).toEqual(["FixtureSourceA", "FixtureSourceB"]);
    expect(config.sources[0].techniques).toEqual(["T1078", "T1059.001"]);
  });

  it("upper-cases and trims technique IDs", () => {
    const config = parseLogSourceConfig({
      sources: [{ name: "Weird spacing", techniques: [" t1078 ", "t1059.001"] }],
    });
    expect(config.sources[0].techniques).toEqual(["T1078", "T1059.001"]);
  });

  it("parses the real shipped starter log-sources.yaml (Sysmon/Windows/Zeek/osquery)", async () => {
    const config = await loadLogSourceConfig(REAL_STARTER_PATH);
    const names = config.sources.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining(["Sysmon", "Windows Security Event Log", "Zeek", "osquery"]),
    );
    for (const source of config.sources) {
      expect(source.techniques.length).toBeGreaterThan(0);
      for (const id of source.techniques) {
        expect(id).toMatch(/^T\d{4}(\.\d{3})?$/);
      }
    }
  });

  it("rejects a config missing the top-level sources list", () => {
    expect(() => parseLogSourceConfig({ version: 1 })).toThrow(LogSourceConfigError);
  });

  it("rejects a source missing a name", () => {
    expect(() => parseLogSourceConfig({ sources: [{ techniques: ["T1078"] }] })).toThrow(
      LogSourceConfigError,
    );
  });

  it("rejects a source missing a techniques list", () => {
    expect(() => parseLogSourceConfig({ sources: [{ name: "X" }] })).toThrow(LogSourceConfigError);
  });

  it("throws for a missing file", async () => {
    await expect(loadLogSourceConfig(path.join(__dirname, "nope.yaml"))).rejects.toThrow(
      LogSourceConfigError,
    );
  });
});
