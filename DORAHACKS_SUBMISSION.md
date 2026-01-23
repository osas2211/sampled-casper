# SAMPLED - Decentralized Music Sample Marketplace on Casper

![Sampled Platform](images/screenshot.png)

---

## Overview

**Sampled** is a decentralized music sample marketplace built on the Casper Network that revolutionizes how music producers trade samples. By combining an innovative NFT-based licensing system with fair revenue splits and enforced creator royalties, Sampled creates a sustainable ecosystem for music creators.

### The Problem

Traditional sample marketplaces suffer from:
- **High platform fees** (30-50% taken from creators)
- **No secondary market royalties** (creators earn nothing when samples are resold)
- **Opaque licensing** (unclear usage rights)
- **Slow payments** (days to weeks for payouts)
- **Centralized control** (platforms can change terms, delist content)

### Our Solution

Sampled addresses these issues with:
- **90/10 revenue split** - Creators keep 90% on primary sales
- **10% perpetual royalties** - Creators earn on every secondary market resale, enforced by smart contracts
- **Tiered licensing NFTs** - Clear usage rights (Personal/Commercial/Broadcast/Exclusive)
- **Instant payments** - Blockchain-native instant settlement
- **Decentralized storage** - IPFS-based file storage via Pinata

---

## Key Features

### 1. NFT-Based License System

Each sample purchase mints a License NFT representing specific usage rights:

| License Type | Price Multiplier | Usage Rights |
|-------------|------------------|--------------|
| **Personal** | 1x | Non-commercial use - demos, learning, personal projects |
| **Commercial** | 2.5x | Commercial releases - keep 100% of your royalties |
| **Broadcast** | 5x | TV, radio, streaming platforms, advertisements |
| **Exclusive** | 20x | Full exclusive rights - sample removed from marketplace |

**Example**: A sample priced at 100 CSPR would cost:
- Personal: 100 CSPR
- Commercial: 250 CSPR
- Broadcast: 500 CSPR
- Exclusive: 2,000 CSPR

### 2. Fair Economics

**Primary Sales:**
```
Creator Receives: 90%
Platform Fee:     10%
```

**Secondary Market Resales:**
```
Seller Receives:       88%
Original Creator:      10% (perpetual royalty)
Platform Fee:           2%
```

### 3. Smart Contract Automation

- **No intermediaries** - All transactions handled by smart contracts
- **Automatic royalty distribution** - Creators automatically receive their cut
- **Enforced restrictions** - Exclusive licenses cannot be transferred
- **Transparent** - All transactions visible on-chain

### 4. Decentralized Infrastructure

- **Casper Network** - Fast, secure, energy-efficient blockchain
- **IPFS Storage** - Decentralized file storage for audio samples
- **Casper Wallet** - Secure wallet integration for transactions

---

## Technical Architecture

### Smart Contracts (Rust/Odra Framework)

**Total: 1,780 lines of production Rust code**

#### SampledMarketplace Contract (671 lines)
Core marketplace functionality:
- `upload_sample()` - List new samples with metadata
- `purchase_sample_license()` - Purchase with license type selection
- `withdraw_earnings()` - Creator earnings withdrawal
- `set_license_pricing()` - Custom pricing multipliers
- `update_price()` / `deactivate_sample()` - Sample management

#### LicenseNft Contract (495 lines)
NFT license management with enforced royalties:
- `mint_license()` - Create License NFT on purchase
- `transfer_license()` - Secondary market with automatic royalty distribution
- `withdraw_royalties()` - Creator royalty withdrawal

#### Supporting Modules
- `license_types.rs` (182 lines) - Type definitions and pricing logic
- `events.rs` (174 lines) - 14 comprehensive on-chain events
- `errors.rs` (67 lines) - 31 descriptive error codes
- `proxy_caller.rs` (73 lines) - Enables payable contract calls

### Frontend (React/TypeScript)

**Total: 76 files, 1,713+ lines in main contract hook**

- **Framework**: React 19, TypeScript 5.9, Vite
- **State Management**: TanStack React Query
- **UI**: Ant Design + Tailwind CSS
- **Blockchain**: casper-js-sdk integration
- **Storage**: Pinata IPFS SDK

### Key Technical Innovations

1. **Proxy Caller Pattern** - Enables payable contract calls in Casper
2. **Event-Driven Architecture** - Reconstruct state from on-chain events
3. **Indexed Mappings** - O(1) lookups for user samples/purchases
4. **Cross-Contract Calls** - Marketplace coordinates with LicenseNft for royalties
5. **CEI Security Pattern** - Checks-Effects-Interactions for secure fund transfers

---

## User Flows

### For Creators (Uploading Samples)

1. Connect Casper Wallet
2. Navigate to Upload page
3. Drag & drop audio file (WAV/MP3, up to 50MB)
4. Add metadata: title, BPM, genre, cover image
5. Set base price in CSPR
6. Submit - file uploads to IPFS, transaction mints on-chain
7. Sample appears in marketplace
8. Earn 90% on every license purchase

### For Buyers (Purchasing Licenses)

1. Browse marketplace
2. Preview samples with audio player
3. Select desired license type (Personal/Commercial/Broadcast/Exclusive)
4. View price breakdown with fees
5. Confirm purchase via Casper Wallet
6. License NFT minted to wallet
7. Download sample file
8. Use according to license terms

### For Secondary Market

1. License holder lists for resale
2. New buyer purchases license
3. Smart contract automatically distributes:
   - 88% to seller
   - 10% to original creator (perpetual royalty)
   - 2% to platform
4. License NFT transfers to new owner

---

## Contract Deployment

**Network**: Casper Testnet

| Contract | Hash |
|----------|------|
| SampledMarketplace | `56e651f90a4af0d769df105392223283f90598165eaf79e50f8583adde33795d` |
| Marketplace Package | `f511496dac302e008fbd7d50900d3f147a6f871c23491992269034d8640940df` |
| LicenseNft | `d1c7881e6b27e8d52565e56f6c510292273be87bad063eda38b2c04abf48f641` |
| LicenseNft Package | `5afb2cd859e0d761d03fa8c647516ee8e8a9a93b61128fee0393b0da2333f316` |

### Gas Costs

| Operation | Gas (CSPR) |
|-----------|------------|
| Upload Sample | 10 |
| Purchase License | 30 |
| Withdraw Earnings | 5 |
| Update Price | 3 |
| Deactivate Sample | 3 |

---

## Project Structure

```
sampled-casper/
├── contracts/                    # Smart contracts (Rust/Odra)
│   ├── src/
│   │   ├── sampled_marketplace.rs   # Core marketplace (671 lines)
│   │   ├── license_nft.rs           # License NFT system (495 lines)
│   │   ├── license_types.rs         # Type definitions (182 lines)
│   │   ├── events.rs                # On-chain events (174 lines)
│   │   ├── errors.rs                # Error codes (67 lines)
│   │   └── proxy_caller.rs          # Payable call handler (73 lines)
│   └── wasm/                        # Compiled WASM modules
│
├── src/                          # Frontend (React/TypeScript)
│   ├── components/
│   │   ├── music/                   # Sample playback & purchase
│   │   ├── explore/                 # Marketplace browsing
│   │   ├── upload/                  # Sample upload flow
│   │   └── license/                 # License selection UI
│   ├── pages/                       # Application pages
│   ├── hooks/
│   │   ├── useSampledContract.ts    # Contract interactions (1,713 lines)
│   │   └── usePinata.ts             # IPFS integration
│   ├── providers/
│   │   └── WalletProvider.tsx       # Casper Wallet integration
│   └── @types/                      # TypeScript definitions
│
├── images/                       # Screenshots and assets
└── docs/                         # Documentation
```

---

## Why Casper Network?

1. **Energy Efficient** - Proof-of-Stake consensus
2. **Fast Finality** - Quick transaction confirmation
3. **Low Gas Costs** - Affordable for frequent marketplace transactions
4. **Upgradeable Contracts** - Package hash system allows contract upgrades
5. **Odra Framework** - Type-safe, ergonomic smart contract development
6. **Strong Ecosystem** - Growing DeFi and NFT ecosystem

---

## Competitive Advantage

| Feature | Sampled | Traditional Platforms |
|---------|---------|----------------------|
| Creator Revenue (Primary) | 90% | 50-70% |
| Secondary Market Royalties | 10% (enforced) | 0% or optional |
| Payment Speed | Instant | Days to weeks |
| License Clarity | NFT-based tiers | PDF agreements |
| Platform Control | Decentralized | Centralized |
| Fee Transparency | On-chain | Hidden fees |

---

## Future Roadmap

### Phase 1 (Current)
- [x] Core marketplace smart contracts
- [x] License NFT system with enforced royalties
- [x] Frontend application with wallet integration
- [x] IPFS storage integration
- [x] Testnet deployment

### Phase 2 (Next)
- [ ] Hybrid CEP-78 NFT integration (wallet visibility)
- [ ] Secondary marketplace UI for license resales
- [ ] Creator analytics dashboard
- [ ] Batch upload functionality

### Phase 3 (Future)
- [ ] Mainnet deployment
- [ ] Mobile application
- [ ] Collaboration features
- [ ] Stems and multi-track support
- [ ] AI-powered sample search

---

## Technology Stack

### Blockchain Layer
- **Network**: Casper Network (Testnet)
- **Smart Contracts**: Rust with Odra 2.4 framework
- **Compilation**: WASM modules

### Frontend Layer
- **Framework**: React 19, TypeScript 5.9
- **Build Tool**: Vite
- **State Management**: TanStack React Query 5.90
- **UI Components**: Ant Design 5.26
- **Styling**: Tailwind CSS 4
- **Routing**: React Router DOM 7

### Integration Layer
- **Blockchain SDK**: casper-js-sdk
- **File Storage**: Pinata (IPFS)
- **Wallet**: Casper Wallet browser extension

### Infrastructure
- **Hosting**: Vercel
- **RPC Proxy**: Vercel Serverless Functions
- **IPFS Gateway**: Pinata dedicated gateway

---

## Getting Started

### Prerequisites
- Node.js v22+
- Casper Wallet browser extension
- Testnet CSPR (from faucet)

### Installation

```bash
# Clone repository
git clone https://github.com/[your-repo]/sampled-casper
cd sampled-casper

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Pinata credentials

# Start development server
npm run dev
```

### Building Contracts

```bash
cd contracts
rustup run nightly-2024-12-01 cargo odra build
```



---

## Links

- **Live Demo**: https://sampled-casper.vercel.app/
- **GitHub Repository**: [Repo URL](https://github.com/osas2211/sampled-casper)
- **Casper Explorer**: [testnet.cspr.live](https://testnet.cspr.live)

---

## License

MIT License - See LICENSE file for details in github repo.

---

## Acknowledgments

- Casper Network team for the blockchain infrastructure
- Odra framework developers for the smart contract tooling
- Pinata for IPFS storage services
- DoraHacks for the hackathon opportunity

---

*Sampled - Empowering music creators with fair economics and true ownership.*
