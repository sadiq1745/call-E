// src/callRunner.js
//
// Fires a CALL-E call and persists the full result (task text, recipient,
// status, structuredResult, evidence) to call-logs/ so Phase 2 iteration
// doesn't rely on terminal scrollback. call-logs/ is gitignored — logs
// contain real phone numbers and call transcripts.
//
// Verbose by design: prints the full Call object (including per-attempt
// failureCode/failureMessage/providerCallId), the developer event timeline,
// and any thrown CalleAPIError's code/status/details — none of that
// surfaces from a plain console.log(structuredResult), and it's what
// actually explains a call that never rang.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "call-logs");

// Default createAndWait() timeout is 10 minutes. A real navigation call that
// connects can legitimately run several minutes (a full Red Hills call ran
// ~3.5 min end to end) — 3 min cut off a genuine success mid-conversation.
// 6 min still fails much faster than the SDK default while giving real
// calls room; pass a longer waitOptions.timeoutMs explicitly if needed.
const DEFAULT_WAIT_TIMEOUT_MS = 6 * 60 * 1000;

function describeError(err) {
  if (err && typeof err === "object") {
    return {
      name: err.name,
      message: err.message,
      code: err.code,
      status: err.status,
      details: err.details,
    };
  }
  return { message: String(err) };
}

function printAttempts(call) {
  console.log("\n=== PER-ATTEMPT DETAIL ===");
  for (const r of call.recipients ?? []) {
    console.log(`Recipient ${r.id} (${(r.phones ?? []).join(", ")}) — status: ${r.status}`);
    for (const a of r.attempts ?? []) {
      console.log(
        `  attempt ${a.id}: status=${a.status} started=${a.startedAt ?? "-"} completed=${a.completedAt ?? "-"} ` +
          `providerCallId=${a.providerCallId ?? "-"} failureCode=${a.failureCode ?? "-"} failureMessage=${a.failureMessage ?? "-"}`,
      );
    }
  }
  if (call.failureCode || call.failureMessage) {
    console.log(`Top-level failure: code=${call.failureCode ?? "-"} message=${call.failureMessage ?? "-"}`);
  }
}

async function printEvents(client, callId) {
  try {
    const eventList = await client.calls.listEvents(callId);
    const events = eventList.data ?? [];
    console.log("\n=== DEVELOPER EVENTS (timeline) ===");
    if (events.length === 0) console.log("  (no events returned)");
    for (const e of events) {
      const details = e.details && Object.keys(e.details).length ? ` ${JSON.stringify(e.details)}` : "";
      console.log(`  [${e.created_at}] (${e.level}) ${e.type} — ${e.message}${details}`);
    }
    return events;
  } catch (err) {
    console.warn("Could not fetch call events:", describeError(err));
    return [];
  }
}

export async function runCallAndLog(client, { label, task, recipient, resultSchema, waitOptions }) {
  console.log(`Firing call [${label}] to:`, recipient.phone);
  console.log("--- Task text being sent ---");
  console.log(task);
  console.log("-----------------------------");

  let call = null;
  let callId = null;
  let thrownError = null;

  try {
    call = await client.calls.create({ task, recipient, resultSchema });
    callId = call.id;
    console.log(`\nCall created: ${callId} (status: ${call.status})`);
    call = await client.calls.waitForResult(callId, {
      timeoutMs: DEFAULT_WAIT_TIMEOUT_MS,
      ...waitOptions,
    });
  } catch (err) {
    thrownError = err;
    console.error("\n=== ERROR ===");
    console.error(describeError(err));
    if (callId) {
      try {
        call = await client.calls.get(callId);
      } catch (getErr) {
        console.warn("Could not refetch call state after error:", describeError(getErr));
      }
    }
  }

  if (call) {
    console.log("\n=== CALL RESULT (full) ===");
    console.log(JSON.stringify(call, null, 2));
    printAttempts(call);
  }

  const events = callId ? await printEvents(client, callId) : [];

  mkdirSync(LOG_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(LOG_DIR, `${label}__${timestamp}${thrownError ? "__ERROR" : ""}.json`);
  writeFileSync(
    logPath,
    JSON.stringify(
      {
        label,
        ranAt: new Date().toISOString(),
        task,
        recipient,
        callId,
        call,
        events,
        error: thrownError ? describeError(thrownError) : null,
      },
      null,
      2,
    ),
  );
  console.log(`\nSaved call log to ${logPath}`);

  if (thrownError && !call) throw thrownError;
  return call;
}
