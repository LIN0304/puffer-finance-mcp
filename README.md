# 🔥 Puffer Finance MCP Server

Complete MCP server for Puffer Finance with **DeFi strategies**, **cross-chain bridging**, and **real contract addresses**.

## ✨ Features

### 🌉 **Cross-Chain Bridge Operations**
- **8 Supported Networks**: Ethereum, Base, Arbitrum, Apechain, BNB Chain, Berachain, Soneium, Zircuit
- **Bridge Provider Integration**: EVERCLEAR + CHAINLINK CCIP
- **Real Contract Addresses**: All verified Puffer Finance contracts
- **Token Mapping**: Automatic pufETH ↔ xpufETH conversion
- **Provider-Specific Instructions**: Optimized routes and fees

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

## 🛠️ Available Tools

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

### 3. **`get_defi_strategies`**
Scrape all DeFi opportunities from Puffer Finance
- **30+ Strategies**: Complete ecosystem coverage
- **Live Data**: Real-time APR, TVL, rewards
- **Protocol Detection**: Curve, Unifi, Euler, Uniswap, etc.

### 4. **`deposit_to_strategy`**
Generate protocol-specific deposit instructions
- **Smart Contracts**: Real Puffer Finance addresses
- **Transaction Data**: Ready-to-execute calls
- **Gas Estimates**: Accurate cost predictions
- **Approvals**: Required token approvals

### 5. **`get_strategy_details`**
Detailed strategy analysis
- **Comprehensive Info**: Fees, risks, lockups
- **Contract Addresses**: Verified protocol contracts
- **Requirements**: Minimum deposits, token types

### 6. **`simulate_deposit`**
Calculate projected returns and costs
- **Yield Projections**: Daily/weekly/monthly/yearly
- **Fee Impact**: Real cost calculations
- **Risk Assessment**: Strategy-specific warnings

### 7. **`get_vaults`**
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

// Bridge pufETH from Ethereum to Base (becomes xpufETH)
execute_bridge({
  "fromChain": "Ethereum",
  "toChain": "Base", 
  "token": "pufETH",
  "amount": "1.0"
})

// Bridge via CHAINLINK to Arbitrum
execute_bridge({
  "fromChain": "Ethereum",
  "toChain": "Arbitrum",
  "token": "pufETH", 
  "amount": "0.5"
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

## 🔧 Bridge Providers

### **EVERCLEAR** 
- **Chains**: Base, BNB Chain, Apechain, Zircuit
- **Token**: xpufETH (cross-chain representation)
- **Features**: Lower fees (~$1-8), faster transfers (1-10 min)

### **CHAINLINK CCIP**
- **Chains**: Arbitrum, Soneium, Berachain  
- **Token**: pufETH (native token)
- **Features**: Higher security, reliable transfers (5-15 min)

## 🏗️ Architecture

- **Real Contract Integration**: All addresses verified from Puffer Finance
- **Multi-Provider Support**: EVERCLEAR + CHAINLINK bridge routing
- **Token Intelligence**: Automatic pufETH/xpufETH mapping
- **Error Handling**: Comprehensive validation and safety checks
- **Live Data**: Real-time scraping from app.puffer.fi

## 📄 License

MIT License

---

**🔥 Ready for production use with Claude Desktop for complete Puffer Finance interaction!**

*Supports all DeFi strategies, cross-chain bridging, and real contract execution across 8 networks.*