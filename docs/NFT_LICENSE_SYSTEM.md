# NFT License System

The Sampled marketplace implements an NFT-based license system where each sample purchase mints a License NFT representing specific usage rights. Licenses are transferable with automatic royalty payments to original creators.

## Overview

Instead of simple purchases, users now select a license type that determines their usage rights and price. Each license is minted as an NFT that can be resold on secondary markets with enforced creator royalties.

## License Types

| Type | Multiplier | Description |
|------|------------|-------------|
| **Personal** | 1x | Non-commercial use only. Demos, personal projects, learning. |
| **Commercial** | 2.5x | Commercial releases. Keep 100% of your royalties from sales. |
| **Broadcast** | 5x | TV, radio, streaming platforms, and advertisements. |
| **Exclusive** | 20x | Full exclusive rights. Sample removed from marketplace. |

### Example Pricing

For a sample with base price of 100 CSPR:

- Personal: 100 CSPR
- Commercial: 250 CSPR
- Broadcast: 500 CSPR
- Exclusive: 2,000 CSPR

## Fee Structure

### Primary Sales
- Creator receives: 90%
- Platform fee: 10%

### Resales (Secondary Market)
- Seller receives: 88%
- Original creator royalty: 10%
- Platform fee: 2%

## Smart Contract Architecture

### LicenseNft Contract (`contracts/src/license_nft.rs`)

The core NFT contract managing license ownership and transfers.

**Key Entry Points:**

```rust
// Mint a new license (called by marketplace)
fn mint_license(sample_id: u64, license_type: LicenseType, buyer: Address,
                creator: Address, price: U512) -> u64

// Transfer with royalty enforcement
fn transfer_license(license_id: u64, to: Address, sale_price: U512)

// Withdraw accumulated royalties
fn withdraw_royalties()
```

**View Functions:**

```rust
fn get_license(license_id: u64) -> Option<LicenseMetadata>
fn get_licenses_by_owner(owner: Address) -> Vec<u64>
fn get_licenses_by_sample(sample_id: u64) -> Vec<u64>
fn has_exclusive_license(sample_id: u64) -> bool
fn get_royalty_balance(creator: Address) -> U512
```

### SampledMarketplace Integration (`contracts/src/sampled_marketplace.rs`)

**New Entry Points:**

```rust
// Purchase a license for a sample
fn purchase_sample_license(sample_id: u64, license_type: u8)

// Set custom pricing multipliers (seller only)
fn set_license_pricing(sample_id: u64, personal: u64, commercial: u64,
                       broadcast: u64, exclusive: u64)

// Link the LicenseNft contract (admin only)
fn set_license_nft_contract(license_contract: Address)
```

**View Functions:**

```rust
fn get_license_price(sample_id: u64, license_type: u8) -> U512
fn get_all_license_prices(sample_id: u64) -> AllLicensePrices
fn is_exclusively_licensed(sample_id: u64) -> bool
```

### Type Definitions (`contracts/src/license_types.rs`)

```rust
#[odra::odra_type]
pub enum LicenseType {
    Personal = 0,
    Commercial = 1,
    Broadcast = 2,
    Exclusive = 3,
}

#[odra::odra_type]
pub struct LicenseMetadata {
    pub license_id: u64,
    pub sample_id: u64,
    pub license_type: LicenseType,
    pub original_creator: Address,
    pub current_owner: Address,
    pub purchase_price: U512,
    pub purchase_timestamp: u64,
    pub is_active: bool,
    pub transfer_count: u64,
}

#[odra::odra_type]
pub struct LicensePricing {
    pub personal_multiplier: u64,    // 100 = 1x
    pub commercial_multiplier: u64,  // 250 = 2.5x
    pub broadcast_multiplier: u64,   // 500 = 5x
    pub exclusive_multiplier: u64,   // 2000 = 20x
}
```

### Events (`contracts/src/events.rs`)

```rust
LicenseMinted { license_id, sample_id, license_type, buyer, creator, price }
LicenseTransferred { license_id, from, to, sale_price, royalty_paid }
RoyaltyPaid { license_id, creator, amount }
ExclusiveLicenseActivated { sample_id, license_id, holder }
LicensePricingUpdated { sample_id, personal, commercial, broadcast, exclusive }
```

### Error Codes (`contracts/src/errors.rs`)

| Code | Name | Description |
|------|------|-------------|
| 20 | LicenseNotFound | License ID doesn't exist |
| 21 | NotLicenseOwner | Caller doesn't own the license |
| 22 | InvalidLicenseType | License type value out of range |
| 23 | SampleExclusivelyLicensed | Sample already has exclusive license |
| 24 | AlreadyHasLicenseType | User already owns this license type |
| 25 | InsufficientRoyaltyPayment | Transfer payment too low for royalty |
| 26 | CannotTransferExclusiveLicense | Exclusive licenses are non-transferable |
| 27 | NoRoyaltiesToWithdraw | No royalty balance to withdraw |
| 28 | InvalidPricingMultiplier | Multiplier value invalid |
| 29 | LicenseNftNotSet | LicenseNft contract not configured |
| 30 | LicenseNotActive | License has been deactivated |
| 31 | UnauthorizedMinter | Only marketplace can mint licenses |

## Frontend Integration

### TypeScript Types (`src/@types/license.ts`)

```typescript
export enum LicenseType {
  Personal = 0,
  Commercial = 1,
  Broadcast = 2,
  Exclusive = 3,
}

export interface ILicenseMetadata {
  license_id: string
  sample_id: string
  license_type: LicenseType
  original_creator: string
  current_owner: string
  purchase_price: string
  purchase_timestamp: string
  is_active: boolean
  transfer_count: string
}
```

### React Hooks (`src/hooks/useSampledContract.ts`)

```typescript
// Purchase a license
const { mutate: purchaseLicense } = usePurchaseSampleLicense()
purchaseLicense({ sample_id: 1, license_type: LicenseType.Commercial })

// Calculate prices
const prices = getAllLicensePrices(sample.price)
// Returns: { personal, commercial, broadcast, exclusive }

const price = calculateLicensePrice(sample.price, LicenseType.Commercial)
```

### Components

**LicenseSelector** (`src/components/license/LicenseSelector.tsx`)

Radio card selection for license types with pricing display.

```tsx
<LicenseSelector
  prices={licensePrices}
  selectedLicense={selectedLicense}
  onSelect={setSelectedLicense}
  isExclusivelyLicensed={isExclusivelyLicensed}
  disabled={isPurchasing}
/>
```

**LicenseSelectorModal** (`src/components/license/LicenseSelectorModal.tsx`)

Modal wrapper for license selection and purchase confirmation.

```tsx
<LicenseSelectorModal
  open={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onPurchase={handlePurchase}
  prices={licensePrices}
  selectedLicense={selectedLicense}
  onSelectLicense={setSelectedLicense}
  selectedPrice={selectedPrice}
  isExclusivelyLicensed={isExclusivelyLicensed}
  isPurchasing={isPurchasing}
  sampleTitle={sample?.title}
/>
```

**PurchaseSampleTab** (`src/components/music/PurchaseSampleTab.tsx`)

Shows a preview of all license prices with a "Buy License" button that opens the modal for license selection and purchase confirmation.

## Deployment

### 1. Build Contracts

```bash
cd contracts
rustup run nightly-2024-12-01 cargo odra build
```

Outputs:
- `wasm/SampledMarketplace.wasm`
- `wasm/LicenseNft.wasm`

### 2. Deploy Contracts

Deploy both contracts to Casper testnet:

```bash
# Deploy LicenseNft first
casper-client put-deploy ... --session-path wasm/LicenseNft.wasm

# Deploy SampledMarketplace
casper-client put-deploy ... --session-path wasm/SampledMarketplace.wasm

# Link contracts (call set_license_nft_contract on marketplace)
```

### 3. Frontend Configuration

Update contract addresses in your environment configuration to point to the deployed contracts.

## Purchase Flow

1. User selects a sample to purchase
2. User chooses license type (Personal/Commercial/Broadcast/Exclusive)
3. UI displays price breakdown with platform fee
4. User confirms purchase
5. Transaction calls `purchase_sample_license(sample_id, license_type)`
6. Contract mints License NFT to buyer
7. Creator receives 90%, platform receives 10%
8. If Exclusive: sample is deactivated from marketplace
9. User can download the sample file

## Resale Flow (Secondary Market)

1. License owner lists their license for sale
2. Buyer purchases the license
3. Transaction calls `transfer_license(license_id, buyer, sale_price)`
4. Original creator receives 10% royalty automatically
5. Platform receives 2% fee
6. Seller receives remaining 88%
7. License ownership transfers to buyer

## File Summary

### New Files
- `contracts/src/license_types.rs` - Type definitions
- `contracts/src/license_nft.rs` - License NFT contract
- `src/@types/license.ts` - TypeScript types
- `src/components/license/LicenseSelector.tsx` - License selection UI
- `src/components/license/LicenseSelectorModal.tsx` - Modal for license purchase flow

### Modified Files
- `contracts/src/lib.rs` - Module exports
- `contracts/src/sampled_marketplace.rs` - License purchase integration
- `contracts/src/types.rs` - License constants
- `contracts/src/events.rs` - License events
- `contracts/src/errors.rs` - License errors
- `contracts/Odra.toml` - Contract registration
- `src/hooks/useSampledContract.ts` - License hooks
- `src/components/music/PurchaseSampleTab.tsx` - Purchase flow UI
