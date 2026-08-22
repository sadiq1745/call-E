import { listLocationConfigIds, loadLocationConfig } from "../src/config/loadLocationConfig.js";

const ids = listLocationConfigIds();
let failed = 0;

for (const id of ids) {
  try {
    loadLocationConfig(id);
    console.log(`OK   ${id}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${id}\n${err.message}`);
  }
}

console.log(`\n${ids.length - failed}/${ids.length} configs valid.`);
if (failed > 0) process.exit(1);
