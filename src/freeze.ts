/**
 * Emergency switch: stop every copy for every user at once. Leaders' own trades, stops and targets keep working;
 * only copying (auto, approved requests, swipes) stops. Takes effect on the next copy, no restart needed.
 *
 *   npm run freeze -- on "Flash outage"   # pause all copying, with the reason users see
 *   npm run freeze -- off                 # resume
 *   npm run freeze                        # show the current state
 */
import "dotenv/config";
import { copyFreeze, setCopyFreeze } from "./db.js";

const [cmd, ...why] = process.argv.slice(2);
if (cmd === "on") setCopyFreeze(why.join(" ").trim() || "emergency pause");
else if (cmd === "off") setCopyFreeze(undefined);
else if (cmd) {
  console.error('Usage: npm run freeze -- on "reason" | off');
  process.exit(1);
}
const f = copyFreeze();
console.log(f ? `Copying is PAUSED for everyone: ${f}` : "Copying is running.");
