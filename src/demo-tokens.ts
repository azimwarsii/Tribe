/**
 * The tokens the offline demo can trade. Each has its own price and its own sensitivity to market moves (beta), so a
 * basket's return depends on what is in it. Real Base addresses, so the same baskets resolve on a live Flash session.
 */
export interface DemoToken { address: string; symbol: string; name: string; price: number; beta: number; liquidity: number; change24h: number }

export const DEMO_TOKENS: DemoToken[] = [
  { address: "0x4200000000000000000000000000000000000006", symbol: "ETH", name: "Ether", price: 2500, beta: 1, liquidity: 90_000_000, change24h: 1.2 },
  { address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", symbol: "cbBTC", name: "Coinbase Wrapped BTC", price: 68_000, beta: 0.7, liquidity: 60_000_000, change24h: 0.8 },
  { address: "0x9c5c365e764829876243d0b289733b9d2b729685", symbol: "deSPXA", name: "S&P 500 fund token (Janus Henderson Anemoy)", price: 740, beta: 0.35, liquidity: 530_000, change24h: 0.3 },
  { address: "0xb20000000000000000000078ee7ce2fe4908108c", symbol: "NVDAc", name: "NVIDIA (Coinbase tokenized stock)", price: 189, beta: 1, liquidity: 525_000, change24h: -1.4 },
  { address: "0xb200000000000000000000c2e324d24d7eecd1fb", symbol: "AAPLc", name: "Apple (Coinbase tokenized stock)", price: 340, beta: 0.6, liquidity: 340_000, change24h: -0.9 },
  { address: "0xb200000000000000000000ab99cfa739e253872b", symbol: "MSFTc", name: "Microsoft (Coinbase tokenized stock)", price: 532, beta: 0.6, liquidity: 168_000, change24h: 0.4 },
  { address: "0xb2000000000000000000002d0ba3164cc74f58b7", symbol: "GOOGLc", name: "Alphabet (Coinbase tokenized stock)", price: 282, beta: 0.7, liquidity: 584_000, change24h: 0.6 },
  { address: "0xb200000000000000000000d9192b6b456483c2e8", symbol: "AMZNc", name: "Amazon (Coinbase tokenized stock)", price: 261, beta: 0.7, liquidity: 1_060_000, change24h: -1.1 },
  { address: "0xb2000000000000000000008bc8786b856e61707c", symbol: "METAc", name: "Meta (Coinbase tokenized stock)", price: 605, beta: 0.8, liquidity: 367_000, change24h: 0.9 },
  { address: "0xb2000000000000000000004884b426556b92883d", symbol: "MSTRc", name: "Strategy (Coinbase tokenized stock)", price: 131, beta: 1.6, liquidity: 610_000, change24h: -2.2 },
  { address: "0xb2000000000000000000007b9fcbd005511acbd5", symbol: "SPCXc", name: "SpaceX (Coinbase tokenized stock)", price: 130, beta: 1, liquidity: 224_000, change24h: 0.2 },
  { address: "0xb200000000000000000000397293cb8cda9a10c5", symbol: "SNDKc", name: "SanDisk (Coinbase tokenized stock)", price: 888, beta: 1.3, liquidity: 400_000, change24h: 1.7 },
  { address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO", name: "Aerodrome", price: 1.1, beta: 1.5, liquidity: 25_000_000, change24h: 3.4 },
  { address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", symbol: "VIRTUAL", name: "Virtuals Protocol", price: 1.8, beta: 1.8, liquidity: 12_000_000, change24h: -2.1 },
  { address: "0x1111111111166b7fe7bd91427724b487980afc69", symbol: "ZORA", name: "Zora", price: 0.02, beta: 2, liquidity: 4_000_000, change24h: 5.6 },
  { address: "0x532f27101965dd16442e59d40670faf5ebb142e4", symbol: "BRETT", name: "Brett", price: 0.06, beta: 2.2, liquidity: 6_000_000, change24h: -4.3 },
  { address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", symbol: "DEGEN", name: "Degen", price: 0.004, beta: 2.4, liquidity: 3_000_000, change24h: 7.9 },
  { address: "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4", symbol: "TOSHI", name: "Toshi", price: 0.0006, beta: 2.6, liquidity: 2_000_000, change24h: -1.5 },
];

export const demoToken = (address: string) => DEMO_TOKENS.find((t) => t.address === address.toLowerCase());
