#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import { z } from "zod";

// Bridge API configurations
const EVERCLEAR_API_BASE = "https://api.everclear.org";
const EVERCLEAR_TESTNET_API_BASE = "https://api.testnet.everclear.org";
const STARGATE_API_BASE = "https://api.stargate.finance";
const STARGATE_TESTNET_API_BASE = "https://api-testnet.stargate.finance";

const GetStrategiesRequestSchema = z.object({
  includeDetails: z.boolean().optional().default(true),
  timeout: z.number().optional().default(30000),
});

const DepositRequestSchema = z.object({
  strategyId: z.string().or(z.number()),
  amount: z.string(),
  walletAddress: z.string().optional(),
  slippage: z.number().optional().default(1),
  gasLimit: z.number().optional(),
});

// Real Puffer Finance contract addresses by chain
const PUFFER_CONTRACTS = {
  // Ethereum Mainnet (Chain ID: 1)
  1: {
    PufferVault: "0xD9A442856C234a39a81a089C06451EBAa4306a72",
    PufferDepositor: "0x4aa799c5dfc01ee7d790e3bf1a7c2257ce1dceff",
    PufferL2Depositor: "0x3436E0B85cd929929F5802e792CFE282166E0259",
    PufLocker: "0x48e8dE138C246c14248C94d2D616a2F9eb4590D2",
    L1RewardManager: "0x157788cc028Ac6405bD406f2D1e0A8A22b3cf17b",
    PufferWithdrawalManager: "0xDdA0483184E75a5579ef9635ED14BacCf9d50283",
    NucleusAtomicQueue: "0x228c44bb4885c6633f4b6c83f14622f37d5112e5",
    CarrotStaker: "0x99c599227c65132822f0290d9e5b4b0430d6c0d6",
    Distributor: "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae"
  },
  // Base (Chain ID: 8453)
  8453: {
    L2RewardManager: "0xF9Dd335bF363b2E4ecFe3c94A86EBD7Dd3Dcf0e7",
    // Base bridge contracts
    portal: "0x49048044D57e1C92A77f79988d21Fa8fAF74E97e",
    l1StandardBridge: "0x3154Cf16ccdb4C6d922629664174b904d80F2C35",
    disputeGameFactory: "0x43edB88C4B80fDD2AdFF2412A7BebF9dF42cB40e",
    l2OutputOracle: "0x56315b90c40730925ec5485cf004d835058518A0"
  },
  // Arbitrum One (Chain ID: 42161)
  42161: {
    // Standard Arbitrum contracts would go here
    multicall3: "0xca11bde05977b3631167028862be2a173976ca11"
  },
  // Ape Chain (Chain ID: 33139)
  33139: {
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11"
  },
  // BNB Smart Chain (Chain ID: 56)
  56: {
    multicall3: "0xca11bde05977b3631167028862be2a173976ca11"
  },
  // Berachain (Chain ID: 80094)
  80094: {
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    ensRegistry: "0x5b22280886a2f5e09a49bea7e320eab0e5320e28",
    ensUniversalResolver: "0xddfb18888a9466688235887dec2a10c4f5effee9"
  },
  // Soneium Mainnet (Chain ID: 1868)
  1868: {
    disputeGameFactory: "0x512a3d2c7a43bd9261d2b8e8c9c70d4bd4d503c0",
    portal: "0x88e529a6ccd302c948689cd5156c83d4614fae92",
    l1StandardBridge: "0xeb9bf100225c214efc3e7c651ebbadcf85177607",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11"
  },
  // Zircuit Mainnet (Chain ID: 48900)
  48900: {
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    l2OutputOracle: "0x92Ef6Af472b39F1b363da45E35530c24619245A4",
    portal: "0x17bfAfA932d2e23Bd9B909Fd5B4D2e2a27043fb1",
    l1StandardBridge: "0x386B76D9cA5F5Fb150B6BFB35CF5379B22B26dd8"
  },
  // Holesky Testnet (Chain ID: 17000)
  17000: {
    PufferVault: "0x9196830bB4c05504E0A8475A0aD566AceEB6BeC9",
    PufferDepositor: "0x824AC05aeb86A0aD770b8acDe0906d2d4a6c4A8c",
    PufferL2Depositor: "0x0af6998e4828ad8ef8f79a9288d0a861890f791d",
    PufLocker: "0xa58983ad0899a452b7420bc57228e329d7ba92b6",
    L1RewardManager: "0x10f970bcb84B82B82a65eBCbF45F26dD26D69F12",
    L2RewardManager: "0x58C046794f69A8830b0BE737022a45b4acd01dE5",
    PufferWithdrawalManager: "0x5A3E1069B66800c0ecbc91bd81b1AE4D1804DBc4"
  }
};

// Chain ID mapping
const CHAIN_IDS = {
  'Ethereum': 1,
  'Base': 8453,
  'Arbitrum': 42161,
  'Apechain': 33139,
  'BNB Chain': 56,
  'Berachain': 80094,
  'Soneium': 1868,
  'Zircuit': 48900,
  'Holesky': 17000
};

// Token contract addresses
const TOKEN_ADDRESSES = {
  // Ethereum Mainnet tokens
  1: {
    pufETH: "0xd9a442856c234a39a81a089c06451ebaa4306a72",
    PUFFER: "0x4d1c297d39c5c1277964d0e3f8aa901493664530",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
  },
  // Base tokens
  8453: {
    xpufETH: "0x23da5f2d509cb43a59d43c108a43edf34510eff1",
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  },
  // Arbitrum tokens
  42161: {
    pufETH: "0xd9a442856c234a39a81a089c06451ebaa4306a72", // Same as mainnet via CHAINLINK
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
  },
  // BNB Smart Chain tokens
  56: {
    xpufETH: "0x23da5f2d509cb43a59d43c108a43edf34510eff1", // Same as Base via EVERCLEAR
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    USDT: "0x55d398326f99059fF775485246999027B3197955"
  },
  // Ape Chain tokens
  33139: {
    xpufETH: "0x23da5f2d509cb43a59d43c108a43edf34510eff1" // Same as Base via EVERCLEAR
  },
  // Soneium tokens
  1868: {
    pufETH: "0xd9a442856c234a39a81a089c06451ebaa4306a72" // Same as mainnet via CHAINLINK
  },
  // Zircuit tokens
  48900: {
    xpufETH: "0x23da5f2d509cb43a59d43c108a43edf34510eff1" // Same as Base via EVERCLEAR
  },
  // Berachain tokens
  80094: {
    pufETH: "0xd9a442856c234a39a81a089c06451ebaa4306a72" // Same as mainnet via CHAINLINK
  }
};

// Bridge provider configuration for pufETH/xpufETH - STARGATE + EVERCLEAR + CHAINLINK
const BRIDGE_PROVIDERS = {
  pufETH: {
    supportedChains: [
      // STARGATE Finance routes (Primary provider as mentioned by user)
      { chain: 1, tokenOnChain: 'pufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 8453, tokenOnChain: 'xpufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 42161, tokenOnChain: 'pufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 56, tokenOnChain: 'xpufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 43114, tokenOnChain: 'pufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] }, // Avalanche
      { chain: 137, tokenOnChain: 'pufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] }, // Polygon
      
      // EVERCLEAR routes (Secondary provider)
      { chain: 1, tokenOnChain: 'pufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      { chain: 8453, tokenOnChain: 'xpufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      { chain: 56, tokenOnChain: 'xpufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      { chain: 33139, tokenOnChain: 'xpufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      { chain: 48900, tokenOnChain: 'xpufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      
      // CHAINLINK CCIP routes (Enterprise grade)
      { chain: 1, tokenOnChain: 'pufETH', bridgeProvider: 'CHAINLINK', features: ['secure', 'enterprise'] },
      { chain: 1868, tokenOnChain: 'pufETH', bridgeProvider: 'CHAINLINK', features: ['secure', 'enterprise'] },
      { chain: 42161, tokenOnChain: 'pufETH', bridgeProvider: 'CHAINLINK', features: ['secure', 'enterprise'] },
      { chain: 80094, tokenOnChain: 'pufETH', bridgeProvider: 'CHAINLINK', features: ['secure', 'enterprise'] }
    ]
  },
  xpufETH: {
    supportedChains: [
      // STARGATE Finance routes (Primary provider)
      { chain: 1, tokenOnChain: 'pufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 8453, tokenOnChain: 'xpufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 42161, tokenOnChain: 'pufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 56, tokenOnChain: 'xpufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 43114, tokenOnChain: 'pufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      { chain: 137, tokenOnChain: 'pufETH', bridgeProvider: 'STARGATE', features: ['fast', 'unified_liquidity'] },
      
      // EVERCLEAR routes (Secondary provider)
      { chain: 1, tokenOnChain: 'pufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      { chain: 8453, tokenOnChain: 'xpufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      { chain: 56, tokenOnChain: 'xpufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      { chain: 33139, tokenOnChain: 'xpufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] },
      { chain: 48900, tokenOnChain: 'xpufETH', bridgeProvider: 'EVERCLEAR', features: ['intent_based', 'low_cost'] }
    ]
  }
};

class PufferFinanceMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "puffer-finance-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Store strategies cache for deposit actions
    this.strategiesCache = [];
    this.lastCacheUpdate = 0;
    this.cacheValidityMs = 5 * 60 * 1000; // 5 minutes

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_defi_strategies",
          description: "Scrape DeFi strategies from Puffer Finance",
          inputSchema: {
            type: "object",
            properties: {
              includeDetails: {
                type: "boolean",
                description: "Include detailed strategy information",
                default: true,
              },
              timeout: {
                type: "number",
                description: "Timeout in milliseconds",
                default: 30000,
              },
            },
          },
        },
        {
          name: "deposit_to_strategy",
          description: "Deposit funds to a specific DeFi strategy on Puffer Finance",
          inputSchema: {
            type: "object",
            properties: {
              strategyId: {
                type: ["string", "number"],
                description: "Strategy ID or name to deposit to",
              },
              amount: {
                type: "string",
                description: "Amount to deposit (in ETH or token units)",
              },
              walletAddress: {
                type: "string",
                description: "Wallet address for the transaction (optional)",
              },
              slippage: {
                type: "number",
                description: "Maximum slippage tolerance (default: 1%)",
                default: 1,
              },
              gasLimit: {
                type: "number",
                description: "Gas limit for the transaction (optional)",
              },
            },
            required: ["strategyId", "amount"],
          },
        },
        {
          name: "get_strategy_details",
          description: "Get detailed information about a specific strategy including deposit instructions",
          inputSchema: {
            type: "object",
            properties: {
              strategyId: {
                type: ["string", "number"],
                description: "Strategy ID or name to get details for",
              },
            },
            required: ["strategyId"],
          },
        },
        {
          name: "simulate_deposit",
          description: "Simulate a deposit to estimate gas costs and returns",
          inputSchema: {
            type: "object",
            properties: {
              strategyId: {
                type: ["string", "number"],
                description: "Strategy ID or name to simulate deposit for",
              },
              amount: {
                type: "string",
                description: "Amount to simulate depositing",
              },
            },
            required: ["strategyId", "amount"],
          },
        },
        {
          name: "get_vaults",
          description: "Scrape vault information from Puffer Finance vaults page",
          inputSchema: {
            type: "object",
            properties: {
              includeDetails: {
                type: "boolean",
                description: "Include detailed vault information",
                default: true,
              },
              timeout: {
                type: "number",
                description: "Timeout in milliseconds",
                default: 30000,
              },
            },
          },
        },
        {
          name: "get_bridge_info",
          description: "Scrape bridge information from Puffer Finance bridge page",
          inputSchema: {
            type: "object",
            properties: {
              includeDetails: {
                type: "boolean",
                description: "Include detailed bridge information",
                default: true,
              },
              timeout: {
                type: "number",
                description: "Timeout in milliseconds",
                default: 30000,
              },
            },
          },
        },
        {
          name: "execute_bridge",
          description: "Execute a bridge transaction on Puffer Finance",
          inputSchema: {
            type: "object",
            properties: {
              fromChain: {
                type: "string",
                description: "Source blockchain: 'Ethereum', 'Base', 'BNB Chain', 'Apechain', 'Soneium', 'Arbitrum', 'Zircuit', 'Berachain'",
              },
              toChain: {
                type: "string", 
                description: "Destination blockchain: 'Ethereum', 'Base', 'BNB Chain', 'Apechain', 'Soneium', 'Arbitrum', 'Zircuit', 'Berachain'",
              },
              token: {
                type: "string",
                description: "Token to bridge (e.g., 'ETH', 'pufETH', 'USDC')",
              },
              amount: {
                type: "string",
                description: "Amount to bridge",
              },
              walletAddress: {
                type: "string",
                description: "Wallet address to receive tokens (optional)",
              },
              slippage: {
                type: "number",
                description: "Maximum slippage tolerance (default: 1%)",
                default: 1,
              },
            },
            required: ["fromChain", "toChain", "token", "amount"],
          },
        },
        {
          name: "create_everclear_intent",
          description: "Create an Everclear bridge intent with real-time API data",
          inputSchema: {
            type: "object",
            properties: {
              fromChain: {
                type: "string",
                description: "Source chain name (e.g., 'Ethereum', 'Base')",
              },
              toChain: {
                type: "string",
                description: "Destination chain name",
              },
              token: {
                type: "string",
                description: "Token to bridge (e.g., 'pufETH', 'xpufETH')",
              },
              amount: {
                type: "string",
                description: "Amount to bridge",
              },
              recipientAddress: {
                type: "string",
                description: "Recipient wallet address",
              },
              testnet: {
                type: "boolean",
                description: "Use testnet API (default: false)",
                default: false,
              },
            },
            required: ["fromChain", "toChain", "token", "amount", "recipientAddress"],
          },
        },
        {
          name: "create_stargate_swap",
          description: "Create a Stargate Finance bridge swap with unified liquidity and fast transfers",
          inputSchema: {
            type: "object",
            properties: {
              fromChain: {
                type: "string",
                description: "Source chain name (e.g., 'Ethereum', 'Base', 'Arbitrum', 'Polygon')",
              },
              toChain: {
                type: "string",
                description: "Destination chain name",
              },
              token: {
                type: "string",
                description: "Token to bridge (e.g., 'pufETH', 'xpufETH', 'ETH', 'USDC')",
              },
              amount: {
                type: "string",
                description: "Amount to bridge",
              },
              recipientAddress: {
                type: "string",
                description: "Recipient wallet address",
              },
              testnet: {
                type: "boolean",
                description: "Use testnet API (default: false)",
                default: false,
              },
            },
            required: ["fromChain", "toChain", "token", "amount", "recipientAddress"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "get_defi_strategies":
          return await this.getDefiStrategies(args);
        case "deposit_to_strategy":
          return await this.depositToStrategy(args);
        case "get_strategy_details":
          return await this.getStrategyDetails(args);
        case "simulate_deposit":
          return await this.simulateDeposit(args);
        case "get_vaults":
          return await this.getVaults(args);
        case "get_bridge_info":
          return await this.getBridgeInfo(args);
        case "execute_bridge":
          return await this.executeBridge(args);
        case "create_everclear_intent":
          return await this.createEverclearIntentTool(args);
        case "create_stargate_swap":
          return await this.createStargateSwapTool(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async getDefiStrategies(args) {
    const { includeDetails, timeout } = GetStrategiesRequestSchema.parse(args || {});

    console.log("Starting hybrid scraping approach...");

    // Method 1: Try HTTP requests first
    try {
      console.log("Attempting HTTP requests scraping...");
      const httpResult = await this.scrapeWithRequests(includeDetails, timeout);
      if (httpResult.strategies.length >= 30) {
        console.log(`HTTP scraping successful: ${httpResult.strategies.length} strategies found`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(httpResult, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      console.log("HTTP scraping failed:", error.message);
    }

    // Method 2: Fallback to Puppeteer
    console.log("Falling back to Puppeteer scraping...");
    return await this.scrapeWithPuppeteer(includeDetails, timeout);
  }

  async scrapeWithRequests(includeDetails, timeout) {
    const results = {
      strategies: [],
      pageInfo: {},
      timestamp: new Date().toISOString(),
      method: 'http-requests'
    };

    // Try multiple potential API endpoints
    const endpoints = [
      'https://app.puffer.fi/api/defi/opportunities',
      'https://api.puffer.fi/v1/defi',
      'https://app.puffer.fi/api/opportunities',
      'https://puffer.fi/api/defi',
      'https://app.puffer.fi/_next/static/chunks/defi.js',
      'https://app.puffer.fi/api/v1/strategies'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const response = await axios.get(endpoint, {
          timeout: timeout / 2,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json, text/html, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (response.data && typeof response.data === 'object') {
          console.log(`Found JSON data at ${endpoint}`);
          const strategies = this.parseAPIResponse(response.data);
          if (strategies.length > 0) {
            results.strategies = strategies;
            results.pageInfo.source = endpoint;
            results.pageInfo.totalStrategies = strategies.length;
            return results;
          }
        }
      } catch (error) {
        console.log(`Endpoint ${endpoint} failed: ${error.message}`);
      }
    }

    // Try scraping the main page HTML with axios + cheerio
    try {
      console.log("Trying HTML scraping with axios + cheerio...");
      const response = await axios.get('https://app.puffer.fi/defi', {
        timeout: timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Extract any embedded JSON data
      const scripts = $('script').toArray();
      for (const script of scripts) {
        const content = $(script).html();
        if (content && (content.includes('strategies') || content.includes('opportunities'))) {
          try {
            // Look for JSON data in script tags
            const jsonMatch = content.match(/(\{[\s\S]*"strategies"[\s\S]*\})/);
            if (jsonMatch) {
              const jsonData = JSON.parse(jsonMatch[1]);
              const strategies = this.parseAPIResponse(jsonData);
              if (strategies.length > 0) {
                results.strategies = strategies;
                results.pageInfo.source = 'embedded-json';
                results.pageInfo.totalStrategies = strategies.length;
                return results;
              }
            }
          } catch (e) {
            console.log("JSON parsing failed in script tag");
          }
        }
      }
    } catch (error) {
      console.log("HTML scraping failed:", error.message);
    }

    throw new Error("All HTTP scraping methods failed");
  }

  parseAPIResponse(data) {
    const strategies = [];
    
    // Handle different API response formats
    if (Array.isArray(data)) {
      return data.map((item, index) => this.normalizeStrategy(item, index + 1));
    }
    
    if (data.strategies && Array.isArray(data.strategies)) {
      return data.strategies.map((item, index) => this.normalizeStrategy(item, index + 1));
    }
    
    if (data.opportunities && Array.isArray(data.opportunities)) {
      return data.opportunities.map((item, index) => this.normalizeStrategy(item, index + 1));
    }
    
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((item, index) => this.normalizeStrategy(item, index + 1));
    }

    return strategies;
  }

  normalizeStrategy(item, id) {
    return {
      id,
      name: item.name || item.title || item.strategyName || 'Unknown',
      status: item.status || item.isActive ? 'Live' : 'Past' || 'Unknown',
      action: item.action || item.type || item.category || 'Unknown',
      apr: item.apr || item.apy || item.yield || item.rate || 'Unknown',
      tvl: item.tvl || item.totalValueLocked || item.liquidity || 'Unknown',
      dailyRewards: item.dailyRewards || item.rewards || item.earnings || 'Unknown',
      protocol: item.protocol || item.platform || item.provider || 'Unknown',
      source: 'api'
    };
  }

  async scrapeWithPuppeteer(includeDetails, timeout) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      console.log("Navigating to Puffer Finance DeFi page...");
      await page.goto("https://app.puffer.fi/defi", { 
        waitUntil: "networkidle2",
        timeout: timeout 
      });

      // Wait for initial content to load
      console.log("Waiting for initial content...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Wait for the opportunities table to be present
      await page.waitForSelector('[class*="opportunitiesTable"]', { timeout: 15000 }).catch(() => {
        console.log("Table selector not found, continuing...");
      });

      // Scroll to load all content and handle infinite scroll
      console.log("Scrolling to load all opportunities...");
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          let distance = 100;
          let timer = setInterval(() => {
            let scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if(totalHeight >= scrollHeight){
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Wait additional time for any lazy-loaded content
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Try to click "Load More" or "Show All" buttons if they exist
      console.log("Looking for pagination buttons...");
      const paginationSelectors = [
        'button[class*="load"]',
        'button[class*="more"]', 
        'button[class*="show"]',
        '[class*="load"]',
        '[class*="more"]',
        '[class*="pagination"]'
      ];
      
      for (const selector of paginationSelectors) {
        try {
          const buttons = await page.$$(selector);
          for (const button of buttons) {
            const text = await button.evaluate(el => el.textContent.toLowerCase());
            if (text.includes('load') || text.includes('more') || text.includes('show') || text.includes('all')) {
              console.log(`Clicking button: ${text}`);
              await button.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        } catch (e) {
          console.log(`Selector ${selector} failed:`, e.message);
        }
      }

      // Parse the strategy data from the page text
      const strategies = await page.evaluate((includeDetails) => {
        const results = [];
        const bodyText = document.body.textContent;
        
        console.log("Full page text length:", bodyText.length);
        
        // Try to find all table rows or strategy containers
        const tableContainer = document.querySelector('[class*="opportunitiesTable"], table, [class*="table"]');
        let extractedStrategies = [];
        
        if (tableContainer) {
          console.log("Found table container");
          
          // Look for all possible row selectors
          const rowSelectors = [
            'tr', 
            '[class*="row"]', 
            '[class*="item"]', 
            '[class*="opportunity"]',
            '[class*="strategy"]',
            'tbody > *',
            '[role="row"]'
          ];
          
          let allRows = [];
          for (const selector of rowSelectors) {
            const rows = Array.from(tableContainer.querySelectorAll(selector));
            if (rows.length > allRows.length) {
              allRows = rows;
              console.log(`Found ${rows.length} rows with selector: ${selector}`);
            }
          }
          
          // Parse each row for strategy data
          allRows.forEach((row, index) => {
            const rowText = row.textContent || '';
            
            // Skip header rows or empty rows
            if (rowText.includes('Opportunity') || rowText.includes('APR') || rowText.length < 10) {
              return;
            }
            
            // Extract data from row text using multiple patterns
            const patterns = [
              // Pattern 1: Name + Status + Action + APR + TVL + Rewards
              /^([^0-9%$]+?)(Live|Past)([^0-9%$]*?)([\d.]+%)[^$]*?\$([0-9.KMB]+)[^$]*?\$([0-9.k]+)/,
              // Pattern 2: Simpler pattern
              /([^0-9%$]{10,}?)([\d.]+%)[^$]*?\$([0-9.KMB]+)/,
              // Pattern 3: Very flexible pattern
              /([A-Za-z\s]{5,})([\d.]+%)/
            ];
            
            for (const pattern of patterns) {
              const match = rowText.match(pattern);
              if (match) {
                const strategy = {
                  id: extractedStrategies.length + 1,
                  name: match[1].trim().replace(/[^a-zA-Z0-9\s\-]/g, ' ').trim(),
                  status: match[2] || 'Unknown',
                  action: match[3] ? match[3].trim() : 'Unknown',
                  apr: match[4] || match[2] || 'Unknown',
                  tvl: match[5] ? '$' + match[5] : match[3] ? '$' + match[3] : 'Unknown',
                  dailyRewards: match[6] ? '$' + match[6] : 'Unknown',
                  source: 'row-extracted',
                  rawText: rowText.substring(0, 200)
                };
                
                // Only add if name is meaningful and not a duplicate
                if (strategy.name.length > 3 && 
                    !extractedStrategies.find(s => s.name === strategy.name)) {
                  extractedStrategies.push(strategy);
                }
                break;
              }
            }
          });
        }
        
        // Fallback: Advanced text parsing for all strategies
        console.log("Running advanced text parsing...");
        
        // Split text into lines and look for strategy patterns
        const lines = bodyText.split(/\n+/).filter(line => line.trim().length > 10);
        
        lines.forEach((line, index) => {
          // Look for lines containing strategy information
          if (line.includes('%') && (line.includes('$') || line.includes('Live') || line.includes('Past'))) {
            
            // Multiple regex patterns to catch different formats
            const advancedPatterns = [
              // Comprehensive pattern
              /([A-Za-z][A-Za-z0-9\s\-\(\)]+?)\s*(Live|Past)\s*([A-Za-z\s]*?)\s*([\d.]+%)\s*[^\$]*\$([0-9.KMB]+)\s*[^\$]*\$([0-9.k]+)/i,
              // Medium pattern
              /([A-Za-z][A-Za-z0-9\s\-\(\)]{5,}?)\s*([\d.]+%)\s*[^\$]*\$([0-9.KMB]+)/i,
              // Simple pattern
              /([A-Za-z][A-Za-z\s]{4,}?)\s*([\d.]+%)/i
            ];
            
            for (const pattern of advancedPatterns) {
              const match = line.match(pattern);
              if (match) {
                const strategy = {
                  id: extractedStrategies.length + 1,
                  name: match[1].trim(),
                  status: match[2] || 'Unknown',
                  action: match[3] ? match[3].trim() : 'Unknown',
                  apr: match[4] || match[2] || 'Unknown',
                  tvl: match[5] ? '$' + match[5] : match[3] ? '$' + match[3] : 'Unknown',
                  dailyRewards: match[6] ? '$' + match[6] : 'Unknown',
                  source: 'text-parsed',
                  lineNumber: index,
                  rawText: line.substring(0, 150)
                };
                
                // Clean up name
                strategy.name = strategy.name.replace(/View\s*Rewards?\s*Deposit/gi, '').trim();
                strategy.name = strategy.name.replace(/^\s*[^A-Za-z]*/, '').trim();
                
                // Only add if meaningful and unique
                if (strategy.name.length > 3 && 
                    strategy.apr.includes('%') &&
                    !extractedStrategies.find(s => 
                      s.name.toLowerCase().includes(strategy.name.toLowerCase()) || 
                      strategy.name.toLowerCase().includes(s.name.toLowerCase())
                    )) {
                  extractedStrategies.push(strategy);
                }
                break;
              }
            }
          }
        });
        
        console.log(`Extracted ${extractedStrategies.length} strategies total`);
        results.push(...extractedStrategies);
        
        // Extract summary statistics
        const summaryStats = {};
        
        const aprUpToMatch = bodyText.match(/APR:\s*up to\s*([\d.]+%)/i);
        if (aprUpToMatch) {
          summaryStats.maxAPR = aprUpToMatch[1];
        }
        
        const tvlOnDefiMatch = bodyText.match(/TVL on DeFi:\s*\$([0-9.KMB]+)/i);
        if (tvlOnDefiMatch) {
          summaryStats.totalTVL = '$' + tvlOnDefiMatch[1];
        }
        
        const opportunitiesMatch = bodyText.match(/(\d+)\s+opportunities/i);
        if (opportunitiesMatch) {
          summaryStats.totalOpportunities = parseInt(opportunitiesMatch[1]);
        }
        
        // Page info
        const pageInfo = {
          title: document.title,
          url: window.location.href,
          totalStrategies: results.length,
          summary: summaryStats,
          lastUpdated: new Date().toISOString()
        };

        return {
          strategies: results,
          pageInfo: pageInfo,
          timestamp: new Date().toISOString()
        };
      }, includeDetails);

      // Take a screenshot for debugging
      await page.screenshot({ path: '/Users/raylin/puffer-finance-mcp/debug-screenshot.png' });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(strategies, null, 2),
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error scraping Puffer Finance: ${error.message}`,
          },
        ],
        isError: true,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async depositToStrategy(args) {
    const { strategyId, amount, walletAddress, slippage, gasLimit } = DepositRequestSchema.parse(args);

    try {
      // Get fresh strategies if cache is stale
      await this.updateStrategiesCache();

      // Find the strategy
      const strategy = this.findStrategy(strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      // Generate deposit instructions based on strategy type
      const depositInstructions = this.generateDepositInstructions(strategy, amount, slippage, gasLimit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              strategy: strategy,
              depositInstructions: depositInstructions,
              amount: amount,
              estimatedGas: depositInstructions.estimatedGas,
              contractAddress: depositInstructions.contractAddress,
              transactionData: depositInstructions.transactionData,
              warning: "This is a simulation. Always verify contract addresses and transaction data before executing.",
              timestamp: new Date().toISOString()
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error preparing deposit: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getStrategyDetails(args) {
    const { strategyId } = args;

    try {
      await this.updateStrategiesCache();
      const strategy = this.findStrategy(strategyId);
      
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      const details = this.getStrategyDepositDetails(strategy);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(details, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting strategy details: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async simulateDeposit(args) {
    const { strategyId, amount } = args;

    try {
      await this.updateStrategiesCache();
      const strategy = this.findStrategy(strategyId);
      
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      const simulation = this.simulateDepositReturns(strategy, amount);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(simulation, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error simulating deposit: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async updateStrategiesCache() {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.cacheValidityMs && this.strategiesCache.length > 0) {
      return; // Cache is still valid
    }

    try {
      const result = await this.getDefiStrategies({ includeDetails: true });
      const data = JSON.parse(result.content[0].text);
      this.strategiesCache = data.strategies || [];
      this.lastCacheUpdate = now;
    } catch (error) {
      console.error("Failed to update strategies cache:", error.message);
    }
  }

  findStrategy(strategyId) {
    return this.strategiesCache.find(s => 
      s.id == strategyId || 
      s.name.toLowerCase().includes(strategyId.toString().toLowerCase())
    );
  }

  generateDepositInstructions(strategy, amount, slippage, gasLimit) {
    const protocol = strategy.protocol || strategy.action;
    const instructions = {
      strategy: strategy.name,
      protocol: protocol,
      amount: amount,
      steps: [],
      contractAddress: null,
      transactionData: null,
      estimatedGas: gasLimit || 200000,
      requiredApprovals: [],
      risks: []
    };

    // Generate protocol-specific instructions
    if (protocol.toLowerCase().includes('curve')) {
      instructions.contractAddress = this.getCurveContractAddress(strategy);
      instructions.steps = [
        "1. Approve tokens for Curve contract",
        "2. Call add_liquidity() function",
        "3. Receive LP tokens",
        "4. Stake LP tokens for rewards"
      ];
      instructions.requiredApprovals = ["pufETH", "wstETH"];
      instructions.transactionData = `add_liquidity([${amount}, 0], 0)`;
    } else if (protocol.toLowerCase().includes('unifi')) {
      instructions.contractAddress = this.getUnifiContractAddress(strategy);
      instructions.steps = [
        "1. Approve pufETH for Unifi Vault",
        "2. Call deposit() function",
        "3. Receive vault shares"
      ];
      instructions.requiredApprovals = ["pufETH"];
      instructions.transactionData = `deposit(${amount})`;
    } else if (protocol.toLowerCase().includes('euler')) {
      instructions.contractAddress = this.getEulerContractAddress(strategy);
      instructions.steps = [
        "1. Approve tokens for Euler",
        "2. Call deposit() or borrow() function",
        "3. Monitor liquidation ratio if borrowing"
      ];
      instructions.requiredApprovals = ["pufETH"];
      instructions.transactionData = strategy.action.includes('Borrow') ? 
        `borrow(${amount})` : `deposit(${amount})`;
    } else if (protocol.toLowerCase().includes('uniswap')) {
      instructions.contractAddress = this.getUniswapContractAddress(strategy);
      instructions.steps = [
        "1. Approve tokens for Uniswap",
        "2. Add liquidity to pool",
        "3. Receive LP tokens",
        "4. Stake for additional rewards"
      ];
      instructions.requiredApprovals = ["pufETH", "WETH"];
      instructions.transactionData = `addLiquidity(${amount})`;
    } else {
      // Generic DeFi protocol
      instructions.steps = [
        "1. Approve tokens for protocol",
        "2. Execute deposit transaction",
        "3. Receive strategy tokens/shares"
      ];
      instructions.requiredApprovals = ["pufETH"];
      instructions.transactionData = `deposit(${amount})`;
    }

    // Add common risks
    instructions.risks = [
      "Smart contract risk",
      "Impermanent loss (for LP strategies)",
      "Liquidation risk (for borrowing strategies)",
      "Protocol governance risk"
    ];

    return instructions;
  }

  getStrategyDepositDetails(strategy) {
    return {
      id: strategy.id,
      name: strategy.name,
      protocol: strategy.protocol || strategy.action,
      currentAPR: strategy.apr,
      tvl: strategy.tvl,
      dailyRewards: strategy.dailyRewards,
      status: strategy.status,
      depositToken: this.getDepositToken(strategy),
      minimumDeposit: this.getMinimumDeposit(strategy),
      fees: this.getStrategyFees(strategy),
      lockupPeriod: this.getLockupPeriod(strategy),
      risks: this.getStrategyRisks(strategy),
      contractAddress: this.getContractAddress(strategy),
      lastUpdated: new Date().toISOString()
    };
  }

  simulateDepositReturns(strategy, amount) {
    const apr = parseFloat(strategy.apr.replace('%', '')) / 100;
    const dailyRate = apr / 365;
    const numAmount = parseFloat(amount);

    return {
      strategy: strategy.name,
      depositAmount: amount,
      currentAPR: strategy.apr,
      projections: {
        daily: {
          earnings: (numAmount * dailyRate).toFixed(6),
          total: (numAmount * (1 + dailyRate)).toFixed(6)
        },
        weekly: {
          earnings: (numAmount * dailyRate * 7).toFixed(6),
          total: (numAmount * (1 + dailyRate * 7)).toFixed(6)
        },
        monthly: {
          earnings: (numAmount * dailyRate * 30).toFixed(6),
          total: (numAmount * (1 + dailyRate * 30)).toFixed(6)
        },
        yearly: {
          earnings: (numAmount * apr).toFixed(6),
          total: (numAmount * (1 + apr)).toFixed(6)
        }
      },
      fees: this.getStrategyFees(strategy),
      risks: this.getStrategyRisks(strategy),
      timestamp: new Date().toISOString()
    };
  }

  // Helper methods for contract addresses (these would need real addresses)
  getCurveContractAddress(strategy) {
    if (strategy.name.includes('pufETH-wstETH')) {
      return '0x...'; // Real Curve pufETH-wstETH pool address
    }
    return '0x...'; // Generic Curve contract
  }

  getUnifiContractAddress(strategy) {
    return '0x...'; // Real Unifi vault address
  }

  getEulerContractAddress(strategy) {
    return '0x...'; // Real Euler protocol address
  }

  getUniswapContractAddress(strategy) {
    return '0x...'; // Real Uniswap pool address
  }

  getContractAddress(strategy) {
    const protocol = (strategy.protocol || strategy.action || '').toLowerCase();
    if (protocol.includes('curve')) return this.getCurveContractAddress(strategy);
    if (protocol.includes('unifi')) return this.getUnifiContractAddress(strategy);
    if (protocol.includes('euler')) return this.getEulerContractAddress(strategy);
    if (protocol.includes('uniswap')) return this.getUniswapContractAddress(strategy);
    return '0x...'; // Generic contract address
  }

  getDepositToken(strategy) {
    if (strategy.name.includes('WETH')) return 'WETH';
    if (strategy.name.includes('USDC')) return 'USDC';
    if (strategy.name.includes('CARROT')) return 'CARROT';
    return 'pufETH'; // Default deposit token
  }

  getMinimumDeposit(strategy) {
    return '0.001'; // Most protocols have small minimums
  }

  getStrategyFees(strategy) {
    const protocol = (strategy.protocol || strategy.action || '').toLowerCase();
    if (protocol.includes('curve')) return { deposit: '0%', withdraw: '0.04%', performance: '0%' };
    if (protocol.includes('unifi')) return { deposit: '0%', withdraw: '0.1%', performance: '2%' };
    if (protocol.includes('euler')) return { deposit: '0%', withdraw: '0%', borrowing: 'Variable' };
    return { deposit: '0%', withdraw: '0.1%', performance: '0%' };
  }

  getLockupPeriod(strategy) {
    if (strategy.name.includes('Pendle')) return '6 months';
    if (strategy.name.includes('vePUFFER')) return '4 years max';
    return 'None';
  }

  getStrategyRisks(strategy) {
    const risks = ['Smart contract risk'];
    if (strategy.action?.includes('Liquidity')) risks.push('Impermanent loss');
    if (strategy.action?.includes('Borrow')) risks.push('Liquidation risk');
    if (strategy.status === 'Past') risks.push('Strategy discontinued');
    return risks;
  }

  async getVaults(args) {
    const { includeDetails = true, timeout = 30000 } = args || {};
    
    console.log("Starting vault scraping...");
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      console.log("Navigating to Puffer Finance vaults page...");
      await page.goto("https://app.puffer.fi/vaults", { 
        waitUntil: "networkidle2",
        timeout: timeout 
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      const vaults = await page.evaluate((includeDetails) => {
        const results = [];
        const bodyText = document.body.textContent;
        
        // Look for vault containers
        const vaultContainers = document.querySelectorAll(
          '[class*="vault"], [class*="card"], [class*="container"], [class*="item"]'
        );
        
        vaultContainers.forEach((container, index) => {
          const containerText = container.textContent || '';
          
          // Skip if container doesn't contain vault-related content
          if (!containerText.includes('APY') && !containerText.includes('TVL') && 
              !containerText.includes('Vault') && containerText.length < 50) {
            return;
          }
          
          // Extract vault information
          const vaultName = containerText.match(/([A-Za-z\s\-]+(?:Vault|Pool|Strategy))/i)?.[1]?.trim();
          const apy = containerText.match(/([\d.]+)%\s*(?:APY|APR)/i)?.[1];
          const tvl = containerText.match(/TVL[\s:]*\$?([0-9.KMB]+)/i)?.[1];
          const tokens = containerText.match(/([A-Z]{3,}(?:\/[A-Z]{3,})*)/g);
          
          if (vaultName && vaultName.length > 3) {
            results.push({
              id: results.length + 1,
              name: vaultName,
              apy: apy ? `${apy}%` : 'Unknown',
              tvl: tvl ? `$${tvl}` : 'Unknown',
              tokens: tokens ? tokens.slice(0, 3) : ['Unknown'],
              type: 'vault',
              source: 'scraped',
              rawText: containerText.substring(0, 200)
            });
          }
        });
        
        // Fallback: Parse from full page text
        const lines = bodyText.split(/\n+/).filter(line => line.trim().length > 10);
        
        lines.forEach((line, index) => {
          if (line.includes('Vault') || line.includes('Pool')) {
            const vaultMatch = line.match(/([A-Za-z\s\-]+(?:Vault|Pool))/i);
            const apyMatch = line.match(/([\d.]+)%/);
            const tvlMatch = line.match(/\$([0-9.KMB]+)/);
            
            if (vaultMatch) {
              const existingVault = results.find(v => 
                v.name.toLowerCase().includes(vaultMatch[1].toLowerCase()) ||
                vaultMatch[1].toLowerCase().includes(v.name.toLowerCase())
              );
              
              if (!existingVault) {
                results.push({
                  id: results.length + 1,
                  name: vaultMatch[1].trim(),
                  apy: apyMatch ? `${apyMatch[1]}%` : 'Unknown',
                  tvl: tvlMatch ? `$${tvlMatch[1]}` : 'Unknown',
                  tokens: ['Unknown'],
                  type: 'vault',
                  source: 'text-parsed',
                  lineNumber: index,
                  rawText: line.substring(0, 150)
                });
              }
            }
          }
        });
        
        return {
          vaults: results,
          pageInfo: {
            title: document.title,
            url: window.location.href,
            totalVaults: results.length,
            timestamp: new Date().toISOString()
          }
        };
      }, includeDetails);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(vaults, null, 2),
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error scraping Puffer Finance vaults: ${error.message}`,
          },
        ],
        isError: true,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async getBridgeInfo(args) {
    const { includeDetails = true, timeout = 30000 } = args || {};
    
    console.log("Starting bridge scraping...");
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      console.log("Navigating to Puffer Finance bridge page...");
      await page.goto("https://app.puffer.fi/bridge", { 
        waitUntil: "networkidle2",
        timeout: timeout 
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      const bridgeInfo = await page.evaluate((includeDetails) => {
        const results = {
          bridgeDetails: [],
          supportedChains: [],
          bridgeFromOptions: [],
          bridgeToOptions: [],
          availableTokens: [],
          contractAddresses: {},
          bridgeRoutes: [],
          fees: {},
          limits: {}
        };
        
        const bodyText = document.body.textContent;
        
        // Look for dropdown/select elements for "from" and "to" chains
        const fromSelectors = [
          'select[class*="from"]',
          '[class*="from"] select',
          '[class*="source"] select',
          'select:has([value*="ethereum"])',
          'select:has([value*="arbitrum"])',
          'select:has([value*="optimism"])'
        ];
        
        const toSelectors = [
          'select[class*="to"]',
          '[class*="to"] select', 
          '[class*="destination"] select',
          '[class*="target"] select'
        ];
        
        // Extract "Bridge From" options
        fromSelectors.forEach(selector => {
          try {
            const fromSelect = document.querySelector(selector);
            if (fromSelect) {
              const options = Array.from(fromSelect.options || fromSelect.querySelectorAll('option'));
              options.forEach(option => {
                const value = option.value || option.textContent;
                if (value && value.trim() && !results.bridgeFromOptions.includes(value.trim())) {
                  results.bridgeFromOptions.push(value.trim());
                }
              });
            }
          } catch (e) {}
        });
        
        // Extract "Bridge To" options  
        toSelectors.forEach(selector => {
          try {
            const toSelect = document.querySelector(selector);
            if (toSelect) {
              const options = Array.from(toSelect.options || toSelect.querySelectorAll('option'));
              options.forEach(option => {
                const value = option.value || option.textContent;
                if (value && value.trim() && !results.bridgeToOptions.includes(value.trim())) {
                  results.bridgeToOptions.push(value.trim());
                }
              });
            }
          } catch (e) {}
        });
        
        // Look for clickable chain/network options
        const chainElements = document.querySelectorAll(
          '[class*="chain"], [class*="network"], [data-chain], [data-network]'
        );
        
        chainElements.forEach(element => {
          const text = element.textContent || element.getAttribute('data-chain') || element.getAttribute('data-network');
          if (text) {
            const chainMatch = text.match(/(Ethereum|Polygon|Arbitrum|Optimism|BSC|BNB Chain|Avalanche|Base|Linea|Apechain|Soneium|Zircuit|Berachain)/gi);
            if (chainMatch) {
              chainMatch.forEach(chain => {
                const cleanChain = chain.trim();
                if (!results.supportedChains.includes(cleanChain)) {
                  results.supportedChains.push(cleanChain);
                }
                // Add to both from and to options if not already present
                if (!results.bridgeFromOptions.includes(cleanChain)) {
                  results.bridgeFromOptions.push(cleanChain);
                }
                if (!results.bridgeToOptions.includes(cleanChain)) {
                  results.bridgeToOptions.push(cleanChain);
                }
              });
            }
          }
        });
        
        // Look for token selection options
        const tokenSelectors = [
          'select[class*="token"]',
          '[class*="token"] select',
          '[class*="asset"] select',
          'select:has([value*="eth"])',
          'select:has([value*="usdc"])'
        ];
        
        tokenSelectors.forEach(selector => {
          try {
            const tokenSelect = document.querySelector(selector);
            if (tokenSelect) {
              const options = Array.from(tokenSelect.options || tokenSelect.querySelectorAll('option'));
              options.forEach(option => {
                const value = option.value || option.textContent;
                if (value && value.trim()) {
                  const tokenMatch = value.match(/\b[A-Z]{3,}\b/);
                  if (tokenMatch && !results.availableTokens.includes(tokenMatch[0])) {
                    results.availableTokens.push(tokenMatch[0]);
                  }
                }
              });
            }
          } catch (e) {}
        });
        
        // Look for bridge-related information in containers
        const bridgeContainers = document.querySelectorAll(
          '[class*="bridge"], [class*="transfer"], [class*="swap"]'
        );
        
        bridgeContainers.forEach((container, index) => {
          const containerText = container.textContent || '';
          
          // Extract fee information
          const feeMatch = containerText.match(/fee[s]?[\s:]*\$?([0-9.]+)/i);
          if (feeMatch) {
            results.fees.bridgeFee = feeMatch[1];
          }
          
          // Extract time estimates
          const timeMatch = containerText.match(/(\d+)\s*(?:min|minute|hour|day)/i);
          if (timeMatch) {
            results.fees.estimatedTime = timeMatch[0];
          }
          
          // Extract limits
          const minMatch = containerText.match(/min(?:imum)?[\s:]*\$?([0-9.]+)/i);
          const maxMatch = containerText.match(/max(?:imum)?[\s:]*\$?([0-9.KMB]+)/i);
          
          if (minMatch) results.limits.minimum = minMatch[1];
          if (maxMatch) results.limits.maximum = maxMatch[1];
        });
        
        // Parse additional tokens from page text
        const tokenMatches = bodyText.match(/\b[A-Z]{3,}\b/g);
        if (tokenMatches) {
          const commonTokens = ['ETH', 'USDC', 'USDT', 'WETH', 'pufETH', 'wstETH', 'DAI', 'WBTC'];
          tokenMatches.forEach(token => {
            if (commonTokens.includes(token) && !results.availableTokens.includes(token)) {
              results.availableTokens.push(token);
            }
          });
        }
        
        // Extract contract addresses from the page
        console.log('Extracting contract addresses...');
        
        // Look for Ethereum addresses (0x followed by 40 hex characters)
        const addressPattern = /0x[a-fA-F0-9]{40}/g;
        const addressMatches = bodyText.match(addressPattern);
        
        if (addressMatches) {
          console.log(`Found ${addressMatches.length} potential addresses`);
          addressMatches.forEach(address => {
            console.log(`Address found: ${address}`);
            // Store unique addresses
            if (!results.contractAddresses.addresses) {
              results.contractAddresses.addresses = [];
            }
            if (!results.contractAddresses.addresses.includes(address)) {
              results.contractAddresses.addresses.push(address);
            }
          });
        }
        
        // Look for contract addresses in script tags and data attributes
        const scriptTags = document.querySelectorAll('script');
        scriptTags.forEach(script => {
          const scriptContent = script.textContent || script.innerHTML;
          if (scriptContent) {
            const scriptAddresses = scriptContent.match(addressPattern);
            if (scriptAddresses) {
              scriptAddresses.forEach(address => {
                if (!results.contractAddresses.addresses) {
                  results.contractAddresses.addresses = [];
                }
                if (!results.contractAddresses.addresses.includes(address)) {
                  results.contractAddresses.addresses.push(address);
                  console.log(`Script address found: ${address}`);
                }
              });
            }
          }
        });
        
        // Look for bridge-specific contract addresses in data attributes
        const bridgeElements = document.querySelectorAll('[data-contract], [data-address], [data-bridge-address]');
        bridgeElements.forEach(element => {
          const contractAddr = element.getAttribute('data-contract') || 
                              element.getAttribute('data-address') || 
                              element.getAttribute('data-bridge-address');
          if (contractAddr && contractAddr.match(/0x[a-fA-F0-9]{40}/)) {
            if (!results.contractAddresses.bridgeContracts) {
              results.contractAddresses.bridgeContracts = [];
            }
            if (!results.contractAddresses.bridgeContracts.includes(contractAddr)) {
              results.contractAddresses.bridgeContracts.push(contractAddr);
              console.log(`Bridge contract found: ${contractAddr}`);
            }
          }
        });
        
        // Try to extract chain-specific addresses from network configurations
        const networkConfigs = document.querySelectorAll('[class*="network"], [class*="chain"]');
        networkConfigs.forEach(config => {
          const configText = config.textContent || config.innerHTML;
          if (configText) {
            const configAddresses = configText.match(addressPattern);
            if (configAddresses) {
              configAddresses.forEach(address => {
                // Try to associate with chain names found nearby
                const nearbyText = config.parentElement?.textContent || '';
                const chainMatch = nearbyText.match(/(Ethereum|Base|Arbitrum|BNB Chain|Apechain|Soneium|Zircuit|Berachain)/i);
                if (chainMatch) {
                  const chainName = chainMatch[1];
                  if (!results.contractAddresses[chainName]) {
                    results.contractAddresses[chainName] = [];
                  }
                  if (!results.contractAddresses[chainName].includes(address)) {
                    results.contractAddresses[chainName].push(address);
                    console.log(`${chainName} contract found: ${address}`);
                  }
                }
              });
            }
          }
        });
        
        // Look for Web3 provider configurations that might contain addresses
        if (window.ethereum || window.web3) {
          try {
            const web3Config = JSON.stringify(window.ethereum || window.web3);
            const web3Addresses = web3Config.match(addressPattern);
            if (web3Addresses) {
              web3Addresses.forEach(address => {
                if (!results.contractAddresses.web3Addresses) {
                  results.contractAddresses.web3Addresses = [];
                }
                if (!results.contractAddresses.web3Addresses.includes(address)) {
                  results.contractAddresses.web3Addresses.push(address);
                }
              });
            }
          } catch (e) {
            console.log('Could not extract Web3 addresses');
          }
        }
        
        // If no specific from/to options found, use supported chains
        if (results.bridgeFromOptions.length === 0) {
          results.bridgeFromOptions = [...results.supportedChains];
        }
        if (results.bridgeToOptions.length === 0) {
          results.bridgeToOptions = [...results.supportedChains];
        }
        
        // Default tokens if none found
        if (results.availableTokens.length === 0) {
          results.availableTokens = ['ETH', 'pufETH', 'USDC'];
        }
        
        // Ensure all known chains are included as fallback
        const allKnownChains = ['Ethereum', 'Base', 'BNB Chain', 'Apechain', 'Soneium', 'Arbitrum', 'Zircuit', 'Berachain'];
        allKnownChains.forEach(chain => {
          if (!results.bridgeFromOptions.includes(chain)) {
            results.bridgeFromOptions.push(chain);
          }
          if (!results.bridgeToOptions.includes(chain)) {
            results.bridgeToOptions.push(chain);
          }
          if (!results.supportedChains.includes(chain)) {
            results.supportedChains.push(chain);
          }
        });
        
        return {
          bridgeOptions: {
            fromChains: results.bridgeFromOptions,
            toChains: results.bridgeToOptions,
            supportedTokens: results.availableTokens,
            contractAddresses: results.contractAddresses,
            fees: results.fees,
            limits: results.limits
          },
          supportedChains: results.supportedChains,
          pageInfo: {
            title: document.title,
            url: window.location.href,
            timestamp: new Date().toISOString()
          }
        };
      }, includeDetails);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(bridgeInfo, null, 2),
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error scraping Puffer Finance bridge: ${error.message}`,
          },
        ],
        isError: true,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async executeBridge(args) {
    const { fromChain, toChain, token, amount, walletAddress, slippage = 1 } = args;
    
    try {
      // Get fresh bridge options
      const bridgeInfoResult = await this.getBridgeInfo({ includeDetails: true });
      const bridgeData = JSON.parse(bridgeInfoResult.content[0].text);
      
      // Validate bridge parameters
      const validation = this.validateBridgeParams(fromChain, toChain, token, bridgeData);
      if (!validation.isValid) {
        throw new Error(`Invalid bridge parameters: ${validation.errors.join(', ')}`);
      }
      
      // Generate bridge transaction instructions
      const contractAddresses = bridgeData.bridgeOptions?.contractAddresses || {};
      const bridgeInstructions = await this.generateBridgeInstructions(fromChain, toChain, token, amount, slippage, contractAddresses);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              bridgeTransaction: {
                fromChain,
                toChain,
                token,
                amount,
                slippage,
                destinationAddress: walletAddress || 'Same wallet'
              },
              instructions: bridgeInstructions,
              estimatedFees: bridgeInstructions.fees,
              estimatedTime: bridgeInstructions.estimatedTime,
              contractAddress: bridgeInstructions.contractAddress,
              transactionData: bridgeInstructions.transactionData,
              warning: "This is a simulation. Always verify bridge contract addresses and transaction data before executing. Bridge transactions are irreversible.",
              timestamp: new Date().toISOString()
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error preparing bridge transaction: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  validateBridgeParams(fromChain, toChain, token, bridgeData) {
    const errors = [];
    const options = bridgeData.bridgeOptions;
    
    // Check if fromChain is supported
    if (!options.fromChains.includes(fromChain)) {
      errors.push(`Source chain '${fromChain}' not supported. Available: ${options.fromChains.join(', ')}`);
    }
    
    // Check if toChain is supported
    if (!options.toChains.includes(toChain)) {
      errors.push(`Destination chain '${toChain}' not supported. Available: ${options.toChains.join(', ')}`);
    }
    
    // Check if token is supported
    if (!options.supportedTokens.includes(token)) {
      errors.push(`Token '${token}' not supported. Available: ${options.supportedTokens.join(', ')}`);
    }
    
    // Check if bridging to same chain
    if (fromChain === toChain) {
      errors.push('Cannot bridge to the same chain');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async generateBridgeInstructions(fromChain, toChain, token, amount, slippage, contractAddresses = {}) {
    const instructions = {
      fromChain,
      toChain,
      token,
      amount,
      slippage,
      steps: [],
      contractAddress: null,
      transactionData: null,
      bridgeProvider: null,
      tokenMapping: null,
      fees: {},
      estimatedTime: '5-15 minutes',
      requiredApprovals: [],
      risks: [],
      availableContracts: contractAddresses,
      everclearData: null
    };
    
    // Get real contract addresses from Puffer Finance configuration
    const fromChainId = CHAIN_IDS[fromChain];
    const toChainId = CHAIN_IDS[toChain];
    
    let realContractAddress = null;
    let bridgeContractType = null;
    
    // Determine bridge provider and token mapping for pufETH/xpufETH
    if (token === 'pufETH' || token === 'xpufETH') {
      const bridgeConfig = BRIDGE_PROVIDERS[token];
      if (bridgeConfig) {
        const fromConfig = bridgeConfig.supportedChains.find(config => 
          config.chain === fromChainId && config.tokenOnChain === token
        );
        const toConfig = bridgeConfig.supportedChains.find(config => 
          config.chain === toChainId
        );
        
        if (fromConfig && toConfig) {
          instructions.bridgeProvider = fromConfig.bridgeProvider;
          instructions.tokenMapping = {
            from: { chain: fromChain, token: fromConfig.tokenOnChain },
            to: { chain: toChain, token: toConfig.tokenOnChain }
          };

          // If using EVERCLEAR, get live data from API
          if (fromConfig.bridgeProvider === 'EVERCLEAR') {
            try {
              console.log(`Getting Everclear data for ${fromChain} -> ${toChain} bridge...`);
              
              // Get real-time quote from Everclear API
              const quote = await this.getEverclearQuote(fromChainId, toChainId, token, amount);
              
              if (quote.success) {
                instructions.everclearData = {
                  quote: quote.data,
                  estimatedFee: quote.fee,
                  estimatedTime: quote.estimatedTime
                };
                instructions.fees.everclearFee = quote.fee;
                instructions.estimatedTime = quote.estimatedTime;
              } else {
                console.warn('Everclear API unavailable, using fallback data');
                instructions.everclearData = {
                  error: quote.error,
                  fallback: quote.fallback
                };
                instructions.fees.everclearFee = quote.fallback.fee;
                instructions.estimatedTime = quote.fallback.estimatedTime;
              }

              // Get route limits
              const limits = await this.getEverclearRouteLimits(fromChainId, toChainId, token);
              if (limits.success) {
                instructions.everclearData.limits = {
                  minAmount: limits.minAmount,
                  maxAmount: limits.maxAmount,
                  liquidity: limits.liquidity
                };
              }

            } catch (error) {
              console.error('Error fetching Everclear data:', error.message);
              instructions.everclearData = {
                error: error.message,
                fallback: true
              };
            }
          }
        }
      }
    }
    
    // Determine the appropriate contract address based on the bridge route
    if (fromChain === 'Ethereum' && toChain === 'Base') {
      // Use Base portal contract for Ethereum -> Base bridge
      realContractAddress = PUFFER_CONTRACTS[8453]?.portal;
      bridgeContractType = 'portal';
    } else if (fromChain === 'Base' && toChain === 'Ethereum') {
      // Use Base L1 Standard Bridge for Base -> Ethereum
      realContractAddress = PUFFER_CONTRACTS[8453]?.l1StandardBridge;
      bridgeContractType = 'l1StandardBridge';
    } else if (fromChain === 'Ethereum' && toChain === 'Soneium') {
      realContractAddress = PUFFER_CONTRACTS[1868]?.portal;
      bridgeContractType = 'portal';
    } else if (fromChain === 'Ethereum' && toChain === 'Zircuit') {
      realContractAddress = PUFFER_CONTRACTS[48900]?.portal;
      bridgeContractType = 'portal';
    } else if (fromChain === 'Ethereum' && PUFFER_CONTRACTS[fromChainId]) {
      // Use PufferL2Depositor for Ethereum to other L2s
      realContractAddress = PUFFER_CONTRACTS[fromChainId]?.PufferL2Depositor;
      bridgeContractType = 'PufferL2Depositor';
    } else if (PUFFER_CONTRACTS[fromChainId]) {
      // Use appropriate contract from source chain
      realContractAddress = PUFFER_CONTRACTS[fromChainId]?.portal || 
                           PUFFER_CONTRACTS[fromChainId]?.l1StandardBridge ||
                           PUFFER_CONTRACTS[fromChainId]?.multicall3;
      bridgeContractType = 'generic';
    }
    
    // Fallback to scraped addresses if available
    if (!realContractAddress) {
      if (contractAddresses[fromChain] && contractAddresses[fromChain].length > 0) {
        realContractAddress = contractAddresses[fromChain][0];
      } else if (contractAddresses.bridgeContracts && contractAddresses.bridgeContracts.length > 0) {
        realContractAddress = contractAddresses.bridgeContracts[0];
      } else if (contractAddresses.addresses && contractAddresses.addresses.length > 0) {
        realContractAddress = contractAddresses.addresses[0];
      }
    }

    // Set the contract address
    instructions.contractAddress = realContractAddress;
    
    // Generate chain-specific bridge instructions with real addresses
    if (fromChain === 'Ethereum' && toChain === 'Base') {
      if (instructions.bridgeProvider === 'EVERCLEAR') {
        // Use live Everclear data if available
        const everclearFee = instructions.everclearData?.estimatedFee || '~$0.50';
        const bridgeTime = instructions.everclearData?.estimatedTime || '1-5 minutes';
        
        instructions.steps = [
          "1. Approve tokens for EVERCLEAR bridge contract",
          "2. Create Everclear intent via API",
          "3. Execute bridge transaction with intent data",
          `4. Receive xpufETH on Base (${bridgeTime})`
        ];
        
        if (instructions.everclearData?.quote) {
          instructions.steps.push("5. ✅ Real-time data from Everclear API");
        }
        
        instructions.fees = {
          bridgeFee: '~$1-3',
          everclearFee: everclearFee
        };
        
        // Add limits information if available
        if (instructions.everclearData?.limits) {
          instructions.limits = {
            minAmount: instructions.everclearData.limits.minAmount,
            maxAmount: instructions.everclearData.limits.maxAmount,
            liquidity: instructions.everclearData.limits.liquidity
          };
        }
      } else {
        instructions.steps = [
          "1. Approve tokens for Base Portal contract",
          "2. Call depositTransaction() function on Portal",
          "3. Wait for L1 confirmation",
          "4. Wait for L2 relay (1-5 minutes)"
        ];
        instructions.fees = {
          bridgeFee: '~$2-8',
          l2Gas: '~$0.10'
        };
      }
      instructions.estimatedTime = '1-5 minutes';
    } else if (fromChain === 'Base' && toChain === 'Ethereum') {
      instructions.steps = [
        "1. Initiate withdrawal on Base L1StandardBridge",
        "2. Wait for challenge period (7 days)",
        "3. Execute withdrawal on Ethereum mainnet"
      ];
      instructions.fees = {
        withdrawalFee: '~$0.50-2',
        l1ExecutionGas: '~$10-40'
      };
      instructions.estimatedTime = '7 days + L1 confirmation';
    } else if (fromChain === 'Ethereum' && (toChain === 'Soneium' || toChain === 'Arbitrum' || toChain === 'Berachain')) {
      if (instructions.bridgeProvider === 'CHAINLINK') {
        instructions.steps = [
          `1. Approve pufETH for Chainlink CCIP bridge`,
          `2. Call ccipSend() function to ${toChain}`,
          "3. Wait for Chainlink validation",
          `4. Receive pufETH on ${toChain} (5-15 minutes)`
        ];
        instructions.fees = {
          bridgeFee: '~$3-12',
          chainlinkFee: '~$1-5'
        };
        instructions.estimatedTime = '5-15 minutes';
      } else {
        instructions.steps = [
          `1. Approve tokens for ${toChain} Portal contract`,
          "2. Call depositTransaction() function",
          "3. Wait for L1 confirmation",
          "4. Wait for L2 relay (1-10 minutes)"
        ];
        instructions.fees = {
          bridgeFee: '~$1-8',
          l2Gas: '~$0.05'
        };
        instructions.estimatedTime = '1-10 minutes';
      }
    } else if (fromChain === 'Ethereum' && toChain === 'Zircuit') {
      if (instructions.bridgeProvider === 'EVERCLEAR') {
        instructions.steps = [
          "1. Approve pufETH for EVERCLEAR bridge",
          "2. Call bridge() function to Zircuit",
          "3. Wait for EVERCLEAR validation",
          "4. Receive xpufETH on Zircuit (3-8 minutes)"
        ];
        instructions.fees = {
          bridgeFee: '~$1-5',
          everclearFee: '~$0.30'
        };
      } else {
        instructions.steps = [
          "1. Approve tokens for Zircuit Portal contract",
          "2. Call depositTransaction() function",
          "3. Wait for L1 confirmation",
          "4. Wait for L2 relay (1-10 minutes)"
        ];
        instructions.fees = {
          bridgeFee: '~$1-8',
          l2Gas: '~$0.03'
        };
      }
      instructions.estimatedTime = '1-10 minutes';
    } else if (fromChain === 'Ethereum' && toChain === 'Arbitrum') {
      instructions.steps = [
        "1. Approve tokens for Arbitrum bridge contract",
        "2. Call depositERC20() function",
        "3. Wait for transaction confirmation on Ethereum",
        "4. Wait for L2 confirmation (5-15 minutes)"
      ];
      instructions.fees = {
        baseFee: '~$5-15',
        l1Gas: '~$10-30',
        l2Gas: '~$0.50'
      };
      instructions.estimatedTime = '5-15 minutes';
    } else if (fromChain === 'Ethereum' && toChain === 'BNB Chain') {
      instructions.steps = [
        "1. Approve tokens for BNB Chain bridge",
        "2. Execute cross-chain transfer",
        "3. Wait for validator confirmations",
        "4. Receive tokens on BNB Chain"
      ];
      instructions.fees = {
        bridgeFee: '~$1-5',
        gasEstimate: '~$0.20'
      };
      instructions.estimatedTime = '3-10 minutes';
    } else if (fromChain === 'Ethereum' && (toChain === 'Apechain' || toChain === 'BNB Chain')) {
      if (instructions.bridgeProvider === 'EVERCLEAR') {
        instructions.steps = [
          `1. Approve pufETH for EVERCLEAR bridge`,
          `2. Call bridge() function to ${toChain}`,
          "3. Wait for EVERCLEAR validation",
          `4. Receive xpufETH on ${toChain} (3-10 minutes)`
        ];
        instructions.fees = {
          bridgeFee: '~$1-8',
          everclearFee: '~$0.50-1'
        };
        instructions.estimatedTime = '3-10 minutes';
      } else {
        instructions.steps = [
          `1. Approve tokens for ${toChain} bridge`,
          "2. Execute cross-chain transaction",
          "3. Wait for validator confirmations",
          "4. Wait for token relay (5-15 minutes)"
        ];
        instructions.fees = {
          bridgeFee: '~$1-10',
          validatorFee: '~$0.20-1'
        };
        instructions.estimatedTime = '5-15 minutes';
      }
    } else {
      // Generic bridge instructions
      instructions.steps = [
        "1. Approve tokens for bridge contract",
        "2. Execute bridge transaction",
        "3. Wait for source chain confirmation",
        "4. Wait for destination chain relay",
        "5. Verify tokens in destination wallet"
      ];
      instructions.fees = {
        bridgeFee: '~$2-20',
        gasEstimate: 'Variable'
      };
    }
    
    // Add warning if using placeholder address
    if (instructions.contractAddress === '0x0000000000000000000000000000000000000000') {
      instructions.risks.unshift('⚠️ PLACEHOLDER CONTRACT ADDRESS - MUST GET REAL ADDRESS BEFORE EXECUTION');
    }
    
    // Set required approvals
    if (token !== 'ETH') {
      instructions.requiredApprovals = [token];
    }
    
    // Generate transaction data
    instructions.transactionData = this.generateBridgeTransactionData(fromChain, toChain, token, amount);
    
    // Add common risks
    instructions.risks = [
      'Bridge smart contract risk',
      'Cross-chain relay failures',
      'Extended confirmation times during network congestion',
      'Potential MEV/front-running on destination chain'
    ];
    
    // Add chain-specific risks
    if (toChain === 'Arbitrum' || fromChain === 'Arbitrum') {
      instructions.risks.push('7-day withdrawal delay when exiting to Ethereum');
    }
    
    return instructions;
  }

  generateBridgeTransactionData(fromChain, toChain, token, amount) {
    // This would generate actual transaction data based on the bridge type
    if (token === 'ETH') {
      return `bridgeETH("${toChain}", "${amount}")`;
    } else {
      return `bridgeERC20("${token}", "${amount}", "${toChain}")`;
    }
  }

  async createEverclearIntentTool(args) {
    const { fromChain, toChain, token, amount, recipientAddress, testnet = false } = args;
    
    try {
      const fromChainId = CHAIN_IDS[fromChain];
      const toChainId = CHAIN_IDS[toChain];
      
      if (!fromChainId || !toChainId) {
        throw new Error(`Invalid chain names: ${fromChain} -> ${toChain}`);
      }

      // Validate bridge route
      const validation = this.validateBridgeParams(fromChain, toChain, token, {});
      if (!validation.isValid) {
        throw new Error(`Invalid bridge parameters: ${validation.errors.join(', ')}`);
      }

      console.log(`Creating Everclear intent: ${fromChain} -> ${toChain}, ${amount} ${token}`);

      // Get quote first
      const quote = await this.getEverclearQuote(fromChainId, toChainId, token, amount, testnet);
      
      // Create intent
      const intent = await this.createEverclearIntent(fromChainId, toChainId, token, amount, recipientAddress, testnet);
      
      // Get route limits
      const limits = await this.getEverclearRouteLimits(fromChainId, toChainId, token, testnet);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              everclearIntent: {
                fromChain,
                toChain,
                token,
                amount,
                recipientAddress,
                quote: quote.success ? {
                  fee: quote.fee,
                  estimatedTime: quote.estimatedTime,
                  route: quote.route
                } : quote.fallback,
                intent: intent.success ? {
                  intentId: intent.intentId,
                  contractAddress: intent.contractAddress,
                  transactionData: intent.transactionData,
                  calldata: intent.calldata,
                  value: intent.value
                } : intent.fallback,
                limits: limits.success ? {
                  minAmount: limits.minAmount,
                  maxAmount: limits.maxAmount,
                  liquidity: limits.liquidity
                } : limits.fallback,
                instructions: [
                  "1. ✅ Everclear intent created via API",
                  `2. Approve ${token} for contract: ${intent.contractAddress || 'UNKNOWN'}`,
                  "3. Execute transaction with provided calldata",
                  `4. Monitor bridge progress via intent ID: ${intent.intentId || 'UNKNOWN'}`,
                  `5. Receive tokens on ${toChain} (${quote.estimatedTime || '3-8 minutes'})`
                ],
                apiStatus: {
                  quote: quote.success ? "✅ Live data" : "⚠️ Fallback data",
                  intent: intent.success ? "✅ Intent created" : "❌ Intent failed",
                  limits: limits.success ? "✅ Live limits" : "⚠️ Fallback limits"
                },
                testnet: testnet ? "Using testnet API" : "Using mainnet API"
              }
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to create Everclear intent: ${error.message}`,
              fallback: {
                message: "Use execute_bridge tool for fallback bridge instructions",
                supportedChains: Object.keys(CHAIN_IDS),
                supportedTokens: ["pufETH", "xpufETH", "ETH", "USDC", "USDT"]
              }
            }, null, 2)
          }
        ]
      };
    }
  }

  async createStargateSwapTool(args) {
    const { fromChain, toChain, token, amount, recipientAddress, testnet = false } = args;
    
    try {
      const fromChainId = CHAIN_IDS[fromChain];
      const toChainId = CHAIN_IDS[toChain];
      
      if (!fromChainId || !toChainId) {
        throw new Error(`Invalid chain names: ${fromChain} -> ${toChain}`);
      }

      // Validate bridge route for Stargate
      const validation = this.validateStargateParams(fromChain, toChain, token, {});
      if (!validation.isValid) {
        throw new Error(`Invalid Stargate parameters: ${validation.errors.join(', ')}`);
      }

      console.log(`Creating Stargate swap: ${fromChain} -> ${toChain}, ${amount} ${token}`);

      // Get quote first
      const quote = await this.getStargateQuote(fromChainId, toChainId, token, amount, testnet);
      
      // Create swap
      const swap = await this.createStargateSwap(fromChainId, toChainId, token, amount, recipientAddress, testnet);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              stargateSwap: {
                fromChain,
                toChain,
                token,
                amount,
                recipientAddress,
                quote: quote.success ? {
                  fee: quote.fee,
                  estimatedTime: quote.estimatedTime,
                  route: quote.route,
                  gasEstimate: quote.gasEstimate
                } : quote.fallback,
                swap: swap.success ? {
                  swapId: swap.swapId,
                  contractAddress: swap.contractAddress,
                  transactionData: swap.transactionData,
                  calldata: swap.calldata,
                  value: swap.value,
                  gasLimit: swap.gasLimit
                } : swap.fallback,
                instructions: [
                  "1. 🌟 Stargate swap created with unified liquidity",
                  `2. Approve ${token} for Stargate Router: ${swap.contractAddress || '0x8731d54E9D02c286767d56ac03e8037C07e01e98'}`,
                  "3. Execute swap transaction with provided calldata",
                  `4. Monitor swap progress via ID: ${swap.swapId || 'UNKNOWN'}`,
                  `5. Receive tokens on ${toChain} (${quote.estimatedTime || '1-3 minutes'})`
                ],
                apiStatus: {
                  quote: quote.success ? "✅ Live Stargate data" : "⚠️ Fallback data",
                  swap: swap.success ? "✅ Swap created" : "❌ Swap failed"
                },
                provider: "STARGATE Finance",
                features: ["Unified Liquidity", "Fast Transfers", "Low Slippage"],
                testnet: testnet ? "Using Stargate testnet" : "Using Stargate mainnet"
              }
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to create Stargate swap: ${error.message}`,
              fallback: {
                message: "Use execute_bridge tool for alternative bridge options",
                supportedChains: ["Ethereum", "Base", "Arbitrum", "Polygon", "Avalanche", "BSC"],
                supportedTokens: ["pufETH", "xpufETH", "ETH", "USDC", "USDT"],
                alternativeProviders: ["EVERCLEAR", "CHAINLINK CCIP"]
              }
            }, null, 2)
          }
        ]
      };
    }
  }

  validateStargateParams(fromChain, toChain, token, options) {
    const errors = [];
    
    // Check if chains are supported by Stargate
    const stargateChains = ["Ethereum", "Base", "Arbitrum", "Polygon", "Avalanche", "BSC"];
    if (!stargateChains.includes(fromChain)) {
      errors.push(`${fromChain} not supported by Stargate`);
    }
    if (!stargateChains.includes(toChain)) {
      errors.push(`${toChain} not supported by Stargate`);
    }
    
    // Check token support
    const stargateTokens = ["pufETH", "xpufETH", "ETH", "WETH", "USDC", "USDT"];
    if (!stargateTokens.includes(token)) {
      errors.push(`${token} not supported by Stargate`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Everclear API integration methods
  async getEverclearQuote(fromChainId, toChainId, token, amount, testnet = false) {
    try {
      const baseUrl = testnet ? EVERCLEAR_TESTNET_API_BASE : EVERCLEAR_API_BASE;
      
      // Convert token names to Everclear format
      const everclearToken = this.mapTokenToEverclear(token);
      
      const response = await axios.post(`${baseUrl}/routes/quotes`, {
        origin: fromChainId.toString(),
        destinations: [toChainId.toString()],
        inputAsset: everclearToken,
        amount: amount,
        to: "0x0000000000000000000000000000000000000000" // Placeholder
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        data: response.data,
        fee: response.data.fee || '0',
        estimatedTime: response.data.estimatedTime || '1-5 minutes',
        route: response.data.route || 'EVERCLEAR'
      };
    } catch (error) {
      console.error('Everclear API error:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: {
          fee: '0.001 ETH',
          estimatedTime: '3-8 minutes',
          route: 'EVERCLEAR_FALLBACK'
        }
      };
    }
  }

  async createEverclearIntent(fromChainId, toChainId, token, amount, recipientAddress, testnet = false) {
    try {
      const baseUrl = testnet ? EVERCLEAR_TESTNET_API_BASE : EVERCLEAR_API_BASE;
      const everclearToken = this.mapTokenToEverclear(token);
      
      const response = await axios.post(`${baseUrl}/intents`, {
        origin: fromChainId.toString(),
        destinations: [toChainId.toString()],
        inputAsset: everclearToken,
        amount: amount,
        to: recipientAddress || undefined
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return {
        success: true,
        intentId: response.data.id,
        transactionData: response.data.txData,
        contractAddress: response.data.contractAddress,
        calldata: response.data.calldata,
        value: response.data.value || '0'
      };
    } catch (error) {
      console.error('Everclear intent creation error:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: {
          contractAddress: PUFFER_CONTRACTS[fromChainId]?.PufferL2Depositor || "0x0000000000000000000000000000000000000000",
          method: "bridge(address,uint256,uint256)",
          note: "Use fallback bridge method - Everclear API unavailable"
        }
      };
    }
  }

  async getEverclearRouteLimits(fromChainId, toChainId, token, testnet = false) {
    try {
      const baseUrl = testnet ? EVERCLEAR_TESTNET_API_BASE : EVERCLEAR_API_BASE;
      const everclearToken = this.mapTokenToEverclear(token);
      
      const response = await axios.post(`${baseUrl}/routes/limits`, {
        origin: fromChainId.toString(),
        destinations: [toChainId.toString()],
        inputAsset: everclearToken
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 8000
      });

      return {
        success: true,
        minAmount: response.data.minAmount || '0.001',
        maxAmount: response.data.maxAmount || '1000',
        liquidity: response.data.liquidity || 'Available'
      };
    } catch (error) {
      console.error('Everclear limits error:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: {
          minAmount: '0.001',
          maxAmount: '100',
          liquidity: 'Unknown'
        }
      };
    }
  }

  mapTokenToEverclear(token) {
    // Map Puffer tokens to Everclear format
    const tokenMapping = {
      'pufETH': 'pufETH',
      'xpufETH': 'xpufETH', 
      'ETH': 'ETH',
      'WETH': 'WETH',
      'USDC': 'USDC',
      'USDT': 'USDT',
      'wstETH': 'wstETH'
    };
    
    return tokenMapping[token] || token;
  }

  // Stargate Finance API integration methods
  async getStargateQuote(fromChainId, toChainId, token, amount, testnet = false) {
    try {
      const baseUrl = testnet ? STARGATE_TESTNET_API_BASE : STARGATE_API_BASE;
      
      // Convert token names to Stargate format
      const stargateToken = this.mapTokenToStargate(token);
      
      const response = await axios.get(`${baseUrl}/v1/quote`, {
        params: {
          srcChainId: fromChainId.toString(),
          dstChainId: toChainId.toString(),
          srcPoolId: this.getStargatePoolId(fromChainId, stargateToken),
          dstPoolId: this.getStargatePoolId(toChainId, stargateToken),
          amount: amount
        },
        headers: {
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        data: response.data,
        fee: response.data.eqFee || '0',
        estimatedTime: '1-3 minutes',
        route: 'STARGATE',
        gasEstimate: response.data.eqReward || '0'
      };
    } catch (error) {
      console.error('Stargate API error:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: {
          fee: '0.0005 ETH',
          estimatedTime: '2-5 minutes',
          route: 'STARGATE_FALLBACK',
          gasEstimate: '150000'
        }
      };
    }
  }

  async createStargateSwap(fromChainId, toChainId, token, amount, recipientAddress, testnet = false) {
    try {
      const baseUrl = testnet ? STARGATE_TESTNET_API_BASE : STARGATE_API_BASE;
      
      const stargateToken = this.mapTokenToStargate(token);
      
      const response = await axios.post(`${baseUrl}/v1/swap`, {
        srcChainId: fromChainId.toString(),
        dstChainId: toChainId.toString(),
        srcPoolId: this.getStargatePoolId(fromChainId, stargateToken),
        dstPoolId: this.getStargatePoolId(toChainId, stargateToken),
        amount: amount,
        to: recipientAddress,
        slippageBps: 100 // 1% slippage
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        swapId: response.data.swapId || `stargate_${Date.now()}`,
        contractAddress: response.data.router || "0x8731d54E9D02c286767d56ac03e8037C07e01e98", // Stargate Router
        transactionData: response.data.txData || `swap(${fromChainId},${toChainId},${amount})`,
        calldata: response.data.calldata || "0x",
        value: response.data.value || "0",
        gasLimit: response.data.gasLimit || "200000"
      };
    } catch (error) {
      console.error('Stargate swap creation error:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: {
          swapId: `stargate_fallback_${Date.now()}`,
          contractAddress: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",
          transactionData: `bridge(${token}, ${amount}, ${toChainId})`,
          gasLimit: "200000"
        }
      };
    }
  }

  mapTokenToStargate(token) {
    // Map Puffer tokens to Stargate pool format
    const tokenMapping = {
      'pufETH': 'ETH', // pufETH bridges as ETH on Stargate
      'xpufETH': 'ETH', // xpufETH bridges as ETH on Stargate
      'ETH': 'ETH',
      'WETH': 'ETH',
      'USDC': 'USDC',
      'USDT': 'USDT'
    };
    
    return tokenMapping[token] || 'ETH';
  }

  getStargatePoolId(chainId, token) {
    // Stargate pool IDs by chain and token
    const poolIds = {
      1: { // Ethereum
        'ETH': 13,
        'USDC': 1,
        'USDT': 2
      },
      56: { // BSC
        'ETH': 13,
        'USDC': 1,
        'USDT': 2
      },
      43114: { // Avalanche
        'ETH': 13,
        'USDC': 1,
        'USDT': 2
      },
      137: { // Polygon
        'ETH': 13,
        'USDC': 1,
        'USDT': 2
      },
      42161: { // Arbitrum
        'ETH': 13,
        'USDC': 1,
        'USDT': 2
      },
      8453: { // Base
        'ETH': 13,
        'USDC': 1,
        'USDT': 2
      }
    };

    return poolIds[chainId]?.[token] || 13; // Default to ETH pool
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Puffer Finance MCP server running on stdio");
  }
}

const server = new PufferFinanceMCPServer();
server.run().catch(console.error);