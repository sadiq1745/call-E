// scripts/testShezanCall.js
//
// Run this LOCALLY with Claude Code, not in a sandboxed environment —
// it needs a real network connection and your real CALLE_API_KEY.
//
// This project has no dotenv package — env vars are NOT auto-loaded.
// You must run this with --env-file, matching the check-calle-client
// npm script's convention:
//
//   node --env-file=.env scripts/testShezanCall.js <phone-number-E164>
//   Example: node --env-file=.env scripts/testShezanCall.js +919876543210
//
// Running plain `node scripts/testShezanCall.js ...` without --env-file
// will fail with a missing CALLE_API_KEY error.

import { readFile } from "fs/promises";
import { buildCallTask, resultSchema } from "../src/callTask.js";
import { createCalleClient } from "../src/calleClient.js";
import { runCallAndLog } from "../src/callRunner.js";

const driverPhone = process.argv[2];
if (!driverPhone) {
  console.error("Usage: node --env-file=.env scripts/testShezanCall.js <phone-number-E164>");
  process.exit(1);
}

const config = JSON.parse(
  await readFile("./configs/locations/shezan-cakes-and-snacks-mallepally.json", "utf8")
);

const client = createCalleClient();

await runCallAndLog(client, {
  label: config.config_id,
  task: buildCallTask(config),
  recipient: {
    phone: driverPhone,
    region: config.address.region_code,
    locale: config.language.locale,
  },
  resultSchema,
});