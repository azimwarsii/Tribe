/** Mint waiting cards and record upgrades now, without waiting for the app's next pass. npm run cards:sync */
import "dotenv/config";
import { cardChainOn, syncCards } from "./card-chain.js";

if (!cardChainOn()) throw new Error("Card minting is off: it needs BASKET_CARDS_ADDRESS and DEPLOYER_PRIVATE_KEY, and DEMO must not be true.");
await syncCards();
