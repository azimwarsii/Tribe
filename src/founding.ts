/**
 * Founding creators: the first creators hand-picked for launch get the top fee share (50%) for a while.
 *
 *   npm run founding -- alice          # 90 days from now
 *   npm run founding -- alice 30       # 30 days
 *   npm run founding -- alice off      # back to the normal tiers
 */
import "dotenv/config";
import { getMeta, setMeta, userByHandle } from "./db.js";

const [handle, arg] = process.argv.slice(2);
const u = handle ? userByHandle(handle.replace(/^@/, "")) : undefined;
if (!u) {
  console.error(handle ? `No user called @${handle}` : "Usage: npm run founding -- <handle> [days|off]");
  process.exit(1);
}
if (arg === "off") setMeta(u.id, { foundingUntil: 0 });
else setMeta(u.id, { foundingUntil: Date.now() + (Number(arg) || 90) * 86400e3 });
const until = getMeta(u.id).foundingUntil ?? 0;
console.log(until > Date.now() ? `@${u.handle} is a founding creator (50% fee share) until ${new Date(until).toDateString()}.` : `@${u.handle} is on the normal creator tiers.`);
