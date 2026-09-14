// scripts/fetchCall.js
//
// Re-fetch a call's current state + event timeline by id, without firing a
// new call. Useful when a local script stopped watching (e.g. a client-side
// wait timeout) before the call actually reached a terminal state on
// CALL-E's side.
//
//   node --env-file=.env scripts/fetchCall.js <callId>

import { createCalleClient } from "../src/calleClient.js";

const callId = process.argv[2];
if (!callId) {
  console.error("Usage: node --env-file=.env scripts/fetchCall.js <callId>");
  process.exit(1);
}

const client = createCalleClient();

const call = await client.calls.get(callId);
console.log("=== CALL STATE ===");
console.log(JSON.stringify(call, null, 2));

const eventList = await client.calls.listEvents(callId);
console.log("\n=== DEVELOPER EVENTS (timeline) ===");
for (const e of eventList.data ?? []) {
  const details = e.details && Object.keys(e.details).length ? ` ${JSON.stringify(e.details)}` : "";
  console.log(`  [${e.created_at}] (${e.level}) ${e.type} — ${e.message}${details}`);
}
