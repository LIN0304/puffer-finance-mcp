# 🔥 Puffer Finance MCP Server

Complete MCP server for Puffer Finance with **DeFi strategies**, **cross-chain bridging**, and **real contract addresses**.

## ✨ Features

### 🌉 **Cross-Chain Bridge Operations**
- **8+ Supported Networks**: Ethereum, Base, Arbitrum, Polygon, Optimism, Avalanche, BSC, zkSync Era, Soneium, Berachain
- **Bridge Provider Integration**: Puffer Finance native bridge using EVERCLEAR + CHAINLINK CCIP
- **Live Puffer API**: Direct connection to app.puffer.fi bridge endpoints
- **Live Everclear API**: Real-time quotes, intents, and limits from api.everclear.org
- **Real Contract Addresses**: All verified Puffer Finance contracts
- **Token Mapping**: Automatic pufETH ↔ xpufETH conversion with xERC20 standard
- **$17.5M Bridge Volume**: Proven Puffer-Everclear partnership with 30min settlement

### 📊 **DeFi Strategy Management**  
- **30+ DeFi Strategies**: Complete Puffer Finance ecosystem
- **Real-time Data**: APR, TVL, daily rewards, protocol info
- **Deposit Instructions**: Protocol-specific transaction data
- **Return Simulations**: Accurate yield projections
- **Risk Analysis**: Comprehensive safety assessments

### 🪙 **Token Support**
- **pufETH**: `0xd9a442856c234a39a81a089c06451ebaa4306a72` (Ethereum)
- **xpufETH**: `0x23da5f2d509cb43a59d43c108a43edf34510eff1` (Base/L2s)
- **PUFFER**: `0x4d1c297d39c5c1277964d0e3f8aa901493664530` (Governance)
- **Multi-chain Support**: ETH, USDC, USDT, wstETH across all networks

## 🚀 Installation

```bash
npm install
```

## ⚙️ Usage

### As MCP Server (Recommended)
Add to your Claude desktop config:

```json
{
  "mcpServers": {
    "puffer-finance": {
      "command": "node",
      "args": ["/path/to/puffer-finance-mcp/index.js"]
    }
  }
}
```

### Standalone Testing
```bash
npm start
```

## 🛠️ Available Tools (9 Total)

### 1. **`get_bridge_info`** 🌉
Comprehensive bridge information extraction
- **Bridge Routes**: All 8 supported chains
- **Provider Detection**: EVERCLEAR vs CHAINLINK
- **Contract Addresses**: Real bridge contracts
- **Token Support**: pufETH/xpufETH compatibility

### 2. **`execute_bridge`** ⭐ **ADVANCED**
Execute cross-chain bridge transactions
- **Provider Intelligence**: Automatic EVERCLEAR/CHAINLINK selection
- **Real Contracts**: Verified bridge addresses
- **Token Mapping**: pufETH ↔ xpufETH conversion
- **Fee Optimization**: Provider-specific cost analysis
- **Time Estimates**: Accurate transfer durations

### 2b. **`create_everclear_intent`** 🔥 **PUFFER-EVERCLEAR**
Bridge pufETH/xpufETH via Puffer Finance using their Everclear integration
- **Puffer Native**: Uses Puffer Finance's bridge API with Everclear provider
- **Partnership Proven**: $17.5M bridge volume via official collaboration
- **Fast Settlement**: 30-minute settlement time (improved from 2 hours)
- **xERC20 Standard**: Bridge-agnostic standard for maximum security
- **Trust-minimized**: Everclear's automated optimization for cost-efficiency

### 2c. **`puffer_bridge`** 🔥 **PUFFER FINANCE NATIVE**
Direct Puffer Finance bridge integration using their actual bridge providers
- **Native Integration**: Connects to Puffer's actual bridge API at app.puffer.fi
- **Everclear Partnership**: $17.5M bridged via Puffer-Everclear collaboration
- **Fast Settlement**: 30-minute settlement time (down from 2 hours)
- **xERC20 Standard**: Bridge-agnostic standard for maximum security
- **8+ Networks**: Ethereum, Base, Arbitrum, Polygon, Optimism, Avalanche, BSC, zkSync Era

### 4. **`get_defi_strategies`**
Scrape all DeFi opportunities from Puffer Finance
- **30+ Strategies**: Complete ecosystem coverage
- **Live Data**: Real-time APR, TVL, rewards
- **Protocol Detection**: Curve, Unifi, Euler, Uniswap, etc.

### 5. **`deposit_to_strategy`**
Generate protocol-specific deposit instructions
- **Smart Contracts**: Real Puffer Finance addresses
- **Transaction Data**: Ready-to-execute calls
- **Gas Estimates**: Accurate cost predictions
- **Approvals**: Required token approvals

### 6. **`get_strategy_details`**
Detailed strategy analysis
- **Comprehensive Info**: Fees, risks, lockups
- **Contract Addresses**: Verified protocol contracts
- **Requirements**: Minimum deposits, token types

### 7. **`simulate_deposit`**
Calculate projected returns and costs
- **Yield Projections**: Daily/weekly/monthly/yearly
- **Fee Impact**: Real cost calculations
- **Risk Assessment**: Strategy-specific warnings

### 8. **`get_vaults`**
Vault information from Puffer Finance
- **Vault Metrics**: APY, TVL, token support
- **Real-time Data**: Live vault performance

## 🌐 Supported Networks

| Chain | ID | Bridge Provider | Token |
|-------|----|--------------|----|
| **Ethereum** | 1 | EVERCLEAR/CHAINLINK | pufETH |
| **Base** | 8453 | EVERCLEAR | xpufETH |
| **Arbitrum** | 42161 | CHAINLINK | pufETH |
| **Apechain** | 33139 | EVERCLEAR | xpufETH |
| **BNB Chain** | 56 | EVERCLEAR | xpufETH |
| **Berachain** | 80094 | CHAINLINK | pufETH |
| **Soneium** | 1868 | CHAINLINK | pufETH |
| **Zircuit** | 48900 | EVERCLEAR | xpufETH |

## 📋 Example Usage

### Bridge Operations
```javascript
// Get all bridge options
get_bridge_info()

// Bridge via Puffer Finance native bridge
puffer_bridge({
  "fromChain": "Ethereum",
  "toChain": "Base",
  "token": "pufETH",
  "amount": "1.0",
  "recipientAddress": "0x742d35cc6cd34b0532c4c0e4b8f0c7c7e1234567",
  "provider": "EVERCLEAR"
})

// Bridge via Puffer-Everclear integration
create_everclear_intent({
  "fromChain": "Ethereum",
  "toChain": "Base",
  "token": "pufETH",
  "amount": "1.0",
  "recipientAddress": "0x742d35cc6cd34b0532c4c0e4b8f0c7c7e1234567"
})

// Bridge via Chainlink CCIP for enterprise
puffer_bridge({
  "fromChain": "Ethereum",
  "toChain": "Soneium",
  "token": "pufETH",
  "amount": "0.5",
  "recipientAddress": "0x742d35cc6cd34b0532c4c0e4b8f0c7c7e1234567",
  "provider": "CHAINLINK_CCIP"
})
```

### DeFi Strategy Operations
```javascript
// Get all strategies
get_defi_strategies()

// Deposit to specific strategy
deposit_to_strategy({
  "strategyId": "curve-pufeth-wsteth",
  "amount": "1.0"
})

// Simulate returns
simulate_deposit({
  "strategyId": "pendle-finance",
  "amount": "0.5"
})
```

## 🔧 Puffer Finance Bridge Providers

### **EVERCLEAR** ⭐ **PRIMARY PROVIDER**
- **Chains**: Ethereum, Base, Arbitrum, Polygon, Optimism, Avalanche, BSC, zkSync Era
- **Token**: pufETH ↔ xpufETH (xERC20 standard)
- **Features**: Puffer native integration, 30min settlement, $17.5M volume
- **Partnership**: Official Puffer-Everclear collaboration

### **CHAINLINK CCIP** 🔒 **ENTERPRISE GRADE**
- **Chains**: Ethereum, Soneium, Berachain  
- **Token**: pufETH (native token)
- **Features**: Enterprise security, verifiable cross-chain, 5-15 min transfers
- **Use Cases**: High-value transfers, enterprise applications

## 🏗️ Architecture

- **Real Contract Integration**: All addresses verified from Puffer Finance
- **Native Bridge Support**: Direct integration with Puffer's bridge providers
- **Token Intelligence**: Automatic pufETH/xpufETH mapping with xERC20 standard
- **Error Handling**: Comprehensive validation and safety checks
- **Live Data**: Real-time scraping from app.puffer.fi
- **API Integration**: Direct connection to Puffer Finance and Everclear APIs
- **Partnership Proven**: $17.5M in bridge volume via Puffer-Everclear collaboration

## 📄 License

MIT License

---

**🔥 Ready for production use with Claude Desktop for complete Puffer Finance interaction!**

*Supports all DeFi strategies, cross-chain bridging, and real contract execution across 8 networks.*