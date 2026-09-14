// scripts/testHotline.js
//
// CALL-E connectivity smoke test — NOT a conversation-quality test.
//
// Context: India-region outbound calls have been unreliable (3 of 4 recent
// calls didn't ring, credits still burned). CALL-E's Discord support pointed
// hackathon participants at an official US testing hotline that's guaranteed
// to connect, to isolate "is it my request" from "is it their India routing."
//
// Whoever/whatever answers this number is not a driver near the Red Hills
// landmarks — it can't meaningfully play along with the task's landmark
// disambiguation. This only confirms: the call connects, completes, and
// resultSchema comes back. Use the real config-driven test scripts for
// actual conversation iteration once India calling is confirmed working.
//
//   node --env-file=.env scripts/testHotline.js

import { readFile } from "fs/promises";
import { buildCallTask, resultSchema } from "../src/callTask.js";
import { createCalleClient } from "../src/calleClient.js";
import { runCallAndLog } from "../src/callRunner.js";

const HOTLINE_PHONE = "+12763229632"; // CALL-E official US testing hotline (English)

const config = JSON.parse(
  await readFile("./configs/locations/my-red-hills-flat.json", "utf8")
);

const client = createCalleClient();

await runCallAndLog(client, {
  label: `hotline-${config.config_id}`,
  task: buildCallTask(config),
  recipient: {
    phone: HOTLINE_PHONE,
    region: "US",
    locale: "en-US",
  },
  resultSchema,
});
