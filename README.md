# Last-500-Metres Navigation Agent

A [CALL-E](https://heycall-e.com/)-powered voice agent that gives delivery
drivers live, landmark-based navigation for the final stretch to an address,
when GPS pins and postal text fail. Built for the
[CALL-E: Your Code Is Calling](https://call-e.devpost.com/) hackathon.

Not an address-reader. It's a guided phone conversation: the agent asks
which direction the driver is approaching from, gives turn-by-turn landmark
instructions for that direction, confirms the building by its distinguishing
features, and — only if the driver is still stuck after being guided —
offers a human contact number and ends the call. Nothing happens after the
call; escalation resolves entirely within it.

The submission for the hackathon's Agent Skills track (the reusable,
portable piece of this project) lives at
[`CALLE-AI/awesome-phone-call-agents#586`](https://github.com/CALLE-AI/awesome-phone-call-agents/pull/586),
and its packaged form is also included here at
[`skill-package/landmark-navigation-assist/`](skill-package/landmark-navigation-assist/).
This repository is the full reference implementation behind it: a working
trigger UI, two real-world location configs, and the tooling used to build
and test them.

## How it works

1. A location config describes one physical building — landmarks, approach
   directions from each side, entrance details, and an optional escalation
   contact. See [`configs/locations/`](configs/locations/) for two real,
   deliberately different examples (a residential flat with multiple
   approaches, and a commercial storefront on a traffic circle).
2. [`src/callTask.js`](src/callTask.js) turns a config into a CALL-E `task`
   instruction — the actual conversation the agent has with the driver —
   plus a `resultSchema` for structured output
   (`escalation_offered`, `escalation_number_revealed`, `resolution_summary`).
3. [`src/server.js`](src/server.js) is a bare-bones "request help" trigger
   page: pick a location, enter a driver's number, and it fires the call
   non-blocking via the CALL-E SDK. It shows the escalation contact's
   number masked (`XXX-XXX-1666`) immediately, and only reveals the real
   number once the call result actually confirms it was read aloud to the
   driver — the reveal is cosmetic for the demo, not something that
   triggers any action.

## Quickstart

```bash
npm install
cp .env.example .env   # then fill in CALLE_API_KEY / CALLE_BASE_URL
npm run validate:configs
npm run demo            # starts the trigger UI on http://localhost:3000
```

You'll need a [CALL-E](https://dashboard.heycall-e.com/) account and API
key. `CALLE_BASE_URL` is `https://api.heycall-e.com`.

## Project structure

```
configs/locations/       Location configs (JSON, schema-validated)
src/config/               JSON Schema + Zod validator/loader for configs
src/callTask.js           Config → CALL-E task text + resultSchema
src/calleClient.js        Thin wrapper around the CALL-E SDK client
src/callRunner.js         Fire-and-log helper: full call result + event
                           timeline saved to call-logs/ (gitignored)
src/server.js             Trigger UI: POST /api/calls, GET /api/calls/:id
public/                   The trigger page itself
scripts/                  Test/utility scripts (see below)
skill-package/            Staged copy of the Agent Skills PR submission
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run validate:configs` | Validates every file in `configs/locations/` against the schema |
| `npm run check:calle-client` | Sanity-checks the CALL-E client/env setup |
| `npm run demo` | Starts the trigger UI |
| `node --env-file=.env scripts/testRedHillsCall.js <phone> [locale]` | Fires a real call using the Red Hills config |
| `node --env-file=.env scripts/testShezanCall.js <phone>` | Fires a real call using the Shezan config |
| `node --env-file=.env scripts/testHotline.js` | Connectivity smoke test against CALL-E's official US testing hotline |
| `node --env-file=.env scripts/fetchCall.js <callId>` | Re-fetches a call's state/events by id, no new call placed |

All of the above spend real CALL-E call credits except `fetchCall.js`.

## Known limitations (stated honestly, not glossed over)

- **CALL-E's SDK/API is Phase 1 beta.** Undocumented behavior should be
  treated as untrustworthy until observed in a real call.
- **India-destination calls are intermittently unreliable** — some attempts
  fail instantly with `failureCode: "500"` before ever ringing, independent
  of locale (`hi-IN` vs `en-IN`). This is a known, reported issue, not a bug
  in this repo's integration — `src/callRunner.js` exists specifically to
  surface CALL-E's own per-attempt diagnostics and event timeline instead
  of trusting a possibly-misleading AI-generated summary on a failed call.
- **No live call transfer.** Escalation reveals a callback number; it does
  not warm-transfer the call.
- This is a demo-scoped project: no production deployment, no
  config-authoring UI, no batch/scheduled calling.

## License

Unlicensed — no LICENSE file yet. Ask before reusing beyond the hackathon's
own Agent Skills submission (which is separately licensed MIT, see
`skill-package/landmark-navigation-assist/package.json`).
