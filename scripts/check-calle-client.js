import { createCalleClient } from "../src/calleClient.js";

try {
  createCalleClient();
  console.log("CALL-E client configured: CALLE_API_KEY and CALLE_BASE_URL are both set.");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
