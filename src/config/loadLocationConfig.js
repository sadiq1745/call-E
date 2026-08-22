import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { locationConfigSchema } from "./locationConfigSchema.js";

const DEFAULT_CONFIGS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "configs",
  "locations",
);

export function loadLocationConfig(configId, { configsDir = DEFAULT_CONFIGS_DIR } = {}) {
  const filePath = path.join(configsDir, `${configId}.json`);
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  const result = locationConfigSchema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid location config "${configId}" (${filePath}):\n${details}`);
  }
  return result.data;
}

export function listLocationConfigIds({ configsDir = DEFAULT_CONFIGS_DIR } = {}) {
  return readdirSync(configsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length));
}
