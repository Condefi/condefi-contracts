# FractionalRealty Smart Contract System

A comprehensive blockchain-based system for tokenizing real estate assets with cross-chain crowdfunding capabilities, built-in compliance, and regulatory controls. The system enables property owners to mint NFTs representing their real estate and create fractional ownership tokens, while allowing cross-chain fundraising and governance.

## Architecture Overview

### Core Components
1. **Property Tokenization Layer**
   - Soulbound NFTs representing real estate properties
   - Fractional ownership through ERC20 tokens
   - KYB (Know Your Business) integration for property ownership verification

2. **Cross-Chain Treasury System**
   - Deployed on multiple chains for maximum accessibility:
     - Base Sepolia: `0xB8b62443CDba678e6c00204Ba5a292052Cc50C54`
     - Mantle Testnet: `0xF4c03194BB7231ce0151134764EedF93F6d896B8`
     - Scroll Sepolia: `0xF4c03194BB7231ce0151134764EedF93F6d896B8`

3. **Universal Identity & Compliance**
   - Cross-chain soulbound KYC verification
   - Sanctions screening with country-specific controls
   - Title deed verification system

## Key Features

### Property Tokenization
- **Real Estate NFTs**: 
  - Mint non-transferable (soulbound) NFTs
  - Built-in KYB verification
  - Automated cap table management

### Cross-Chain Crowdfunding
- **Multi-Chain Treasury Factory**:
  - Create fundraising campaigns on any supported chain
  - Whitelisted token support
  - Deadline-based funding periods
  - Minimum contribution thresholds

### Governance & Control
- **Flexible Ownership Structures**:
  - Multisig wallet support
  - Governor contract compatibility
  - Customizable timelock periods
- **KYB Association Control**:
  - Property ownership registry
  - Shareholder management
  - Timelock-protected operations

## Technical Implementation

### Smart Contracts

```text
Core Contracts
├── FractionalRealty.sol       # Property tokenization
├── TreasuryFactory.sol        # Cross-chain treasury deployment
├── Treasury.sol               # Fundraising & asset management
└── Compliance
    ├── MockKintoID.sol        # KYC verification
    └── MockAttester.sol       # Title deed verification
```

### Cross-Chain Infrastructure
- **Supported Networks**:
  - Base Sepolia (Chain ID: 84532)
  - Mantle Testnet (Chain ID: 5003)
  - Scroll Sepolia (Chain ID: 534351)

### Security Features
- **Timelocks**: 
  - Global minimum timelock (7 days default)
  - Custom timelock per property
  - Treasury operation delays

- **Compliance Integration**:
  - Universal KYC verification
  - Cross-chain identity verification
  - Automated sanctions screening

## Treasury Management

### Crowdfunding Process
1. **Creation**:
   ```solidity
   function createTreasury(
     address safe,
     uint256 minimumAmount,
     uint256 deadline,
     address[] tokens,
     address depositToken,
     uint256 initialDeposit
   )
   ```

2. **Deposit Management**:
   - Whitelisted token support
   - Minimum contribution enforcement
   - Deadline-based closing

3. **Change Management**:
   ```solidity
   function requestChange(uint8 changeType, bytes calldata data)
   function executeChange(bytes32 lockId)
   ```

## Development

### Prerequisites
- Node.js
- Hardhat
- Ethers.js

### Deployment
```bash
# Deploy on supported networks
npx hardhat deploy --network base-sepolia
npx hardhat deploy --network mantle-testnet
npx hardhat deploy --network scroll-sepolia
```

### Testing
```bash
npx hardhat test
```

## Contract Deployments

### Main Contracts
- FractionalRealty: [`0x1CF529F95b5150771Dc9270fD8aaaA3D3d2b5e6C`](https://explorer.kinto.xyz/address/0x1CF529F95b5150771Dc9270fD8aaaA3D3d2b5e6C?tab=contract)
- MockAttester: [`0x3A79C75c6466a56BDAa0f986B27F868E6b967d29`](https://explorer.kinto.xyz/address/0x3A79C75c6466a56BDAa0f986B27F868E6b967d29?tab=contract)

### Treasury Factory Deployments
- Base Sepolia: [`0xB8b62443CDba678e6c00204Ba5a292052Cc50C54`](https://base-sepolia.blockscout.com/address/0xB8b62443CDba678e6c00204Ba5a292052Cc50C54)
- Mantle Testnet: [`0xF4c03194BB7231ce0151134764EedF93F6d896B8`](https://explorer.mantle.xyz/address/0xF4c03194BB7231ce0151134764EedF93F6d896B8)
- Scroll Sepolia: [`0xF4c03194BB7231ce0151134764EedF93F6d896B8`](https://sepolia.scrollscan.com/address/0xF4c03194BB7231ce0151134764EedF93F6d896B8)

## Future Enhancements
- Implementation of cross-chain universal KYC
- Integration with DAO governance frameworks
- Enhanced KYB ownership association controls