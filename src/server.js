// src/server.js
//
// Phase 3 — bare-bones "request help" trigger + escalation reveal.
// Stands in for a driver tapping a button in the delivery app; this is a
// demo trigger, not production infra (per CLAUDE.md: keep this layer
// minimal, no framework, no build step).
//
// Flow:
//   1. POST /api/calls fires client.calls.create() (non-blocking) and
//      returns a masked escalation number immediately.
//   2. The page polls GET /api/calls/:callId until the call reaches a
//      terminal status. If structuredResult.escalation_number_revealed is
//      true, the real number is included in that response — this is
//      purely a demo-UI reveal, nothing is triggered by it (no webhook, no
//      second call, no SMS; see CLAUDE.md's escalation hard constraint).
//
// The real escalation number is never sent to the client until the call
// itself confirms it was read aloud to the driver.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocationConfig, listLocationConfigIds } from "./config/loadLocationConfig.js";
import { buildCallTask, resultSchema } from "./callTask.js";
import { createCalleClient } from "./calleClient.js";

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled"]);

const client = createCalleClient();

// callId -> { configId, contactName, maskedNumber, realNumber }
const activeCalls = new Map();

function maskPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  const last4 = digits.slice(-4) || "????";
  return `XXX-XXX-${last4}`;
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleListConfigs(req, res) {
  const configs = listLocationConfigIds().map((configId) => {
    const config = loadLocationConfig(configId);
    return { configId: config.config_id, label: config.address.label };
  });
  sendJson(res, 200, { configs });
}

async function handleTriggerCall(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }

  const { configId, phone } = body;
  if (!configId || !phone) {
    return sendJson(res, 400, { error: "configId and phone are required" });
  }

  let config;
  try {
    config = loadLocationConfig(configId);
  } catch (err) {
    return sendJson(res, 404, { error: err.message });
  }

  const call = await client.calls.create({
    task: buildCallTask(config),
    recipient: {
      phone,
      region: config.address.region_code,
      locale: config.language.locale,
    },
    resultSchema,
    metadata: { configId, source: "demo-trigger" },
  });

  activeCalls.set(call.id, {
    configId,
    contactName: config.escalation.contact.contact_name,
    maskedNumber: maskPhone(config.escalation.contact.recipient_phone),
    realNumber: config.escalation.contact.recipient_phone,
  });

  sendJson(res, 200, {
    callId: call.id,
    status: call.status,
    contactName: config.escalation.contact.contact_name,
    maskedNumber: maskPhone(config.escalation.contact.recipient_phone),
  });
}

async function handleCallStatus(req, res, callId) {
  const stored = activeCalls.get(callId);
  if (!stored) {
    return sendJson(res, 404, { error: "Unknown callId (server may have restarted)" });
  }

  const call = await client.calls.get(callId);
  const structuredResult = call.structuredResult || {};
  const revealed = structuredResult.escalation_number_revealed === true;

  sendJson(res, 200, {
    status: call.status,
    isTerminal: TERMINAL_STATUSES.has(call.status),
    taskCompleted: call.taskCompleted,
    completionConfidence: call.completionConfidence,
    escalationOffered: structuredResult.escalation_offered ?? null,
    resolutionSummary: structuredResult.resolution_summary ?? null,
    contactName: stored.contactName,
    revealed,
    number: revealed ? stored.realNumber : stored.maskedNumber,
  });
}

async function serveStatic(req, res) {
  const filePath = req.url === "/" ? "index.html" : req.url.slice(1);
  const fullPath = path.join(PUBLIC_DIR, filePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    const contentType = fullPath.endsWith(".js")
      ? "application/javascript"
      : fullPath.endsWith(".css")
        ? "text/css"
        : "text/html";
    const data = await readFile(fullPath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/configs") {
      return await handleListConfigs(req, res);
    }
    if (req.method === "POST" && req.url === "/api/calls") {
      return await handleTriggerCall(req, res);
    }
    const statusMatch = req.method === "GET" && req.url.match(/^\/api\/calls\/([^/]+)$/);
    if (statusMatch) {
      return await handleCallStatus(req, res, decodeURIComponent(statusMatch[1]));
    }
    if (req.method === "GET") {
      return await serveStatic(req, res);
    }
    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error("Request failed:", {
      name: err.name,
      message: err.message,
      code: err.code,
      status: err.status,
      details: err.details,
    });
    sendJson(res, 500, {
      error: err.message,
      code: err.code ?? null,
      details: err.details ?? null,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Demo trigger running at http://localhost:${PORT}`);
});
