# Hybrid NFT Architecture for Sampled Marketplace

## Overview

This document outlines a hybrid approach that combines the benefits of CEP-78 standard NFTs (wallet visibility, ecosystem integration) with the custom LicenseNft contract's business logic (enforced royalties, license restrictions).

## The Problem

| Current Custom NFT | CEP-78 Standard |
|-------------------|-----------------|
| ✅ Enforced royalties (10% creator, 2% platform) | ❌ Royalties are optional/honor-system |
| ✅ License restrictions (exclusive non-transferable) | ❌ All tokens freely transferable |
| ✅ Integrated pricing & business logic | ❌ Separate from marketplace logic |
| ❌ Invisible in wallets | ✅ Shows in all Casper wallets |
| ❌ No external marketplace support | ✅ Listed on CSPR.live, CSPRMarket |
| ❌ Users must use dApp | ✅ Direct wallet transfers |

**Goal**: Get wallet visibility WITHOUT sacrificing royalty enforcement or business logic.

## Hybrid Architecture

### Concept

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Wallet                               │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   CEP-78 NFT        │    │   CSPR Balance                  │ │
│  │   (Visual Receipt)  │    │                                 │ │
│  │   - Visible ✓       │    │                                 │ │
│  │   - Collectible ✓   │    │                                 │ │
│  └──────────┬──────────┘    └─────────────────────────────────┘ │
└─────────────┼───────────────────────────────────────────────────┘
              │ linked via license_id
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LicenseNft Contract                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  License Record (Source of Truth)                           ││
│  │  - license_id: u64                                          ││
│  │  - sample_id: u64                                           ││
│  │  - license_type: LicenseType                                ││
│  │  - current_owner: Address                                   ││
│  │  - royalty_info: creator 10%, platform 2%                   ││
│  │  - is_transferable: bool                                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Two Implementation Options

## Option A: Soulbound CEP-78 (Recommended)

The CEP-78 NFT is **non-transferable** (soulbound). It serves purely as a visual receipt in the user's wallet. All transfers happen through the LicenseNft contract, which mints a new CEP-78 to the recipient and burns the old one.

### Flow

```
1. User purchases license
   └─► LicenseNft.purchase_sample_license()
       ├─► Creates license record (business logic)
       └─► Calls CEP78.mint() to buyer (visual receipt)

2. User views wallet
   └─► Sees CEP-78 NFT with artwork, metadata
   └─► Can click through to Sampled dApp for details

3. User resells license (must use Sampled dApp)
   └─► LicenseNft.transfer_license(license_id, to, price)
       ├─► Validates transfer allowed (not exclusive)
       ├─► Distributes payment (88% seller, 10% creator, 2% platform)
       ├─► Updates license record owner
       ├─► Burns old CEP-78 from seller
       └─► Mints new CEP-78 to buyer

4. User tries to transfer CEP-78 directly
   └─► BLOCKED - token is soulbound/non-transferable
   └─► Must use Sampled dApp to transfer (royalties enforced)
```

### Advantages
- **Royalties always enforced** - No way to bypass
- **Full business logic control** - Exclusive licenses stay non-transferable
- **Wallet visibility** - Users see their licenses as collectible NFTs
- **Clear mental model** - CEP-78 is a "receipt", license contract is "truth"

### Disadvantages
- Cannot list on external NFT marketplaces for resale
- Requires users to use Sampled dApp for transfers

### Contract Changes Required

```rust
// In LicenseNft contract - add CEP-78 integration

// Storage for CEP-78 contract reference
#[odra::variable]
cep78_contract: Var<Address>,

// Storage to link license_id <-> cep78_token_id
#[odra::mapping]
license_to_cep78: Mapping<u64, u64>,

#[odra::mapping]
cep78_to_license: Mapping<u64, u64>,

// Modified mint function
pub fn mint_license(...) -> u64 {
    // ... existing license creation logic ...

    // Mint CEP-78 receipt
    let cep78_token_id = self.mint_cep78_receipt(
        buyer,
        license_id,
        sample_id,
        license_type,
        metadata_uri
    );

    // Link them
    self.license_to_cep78.set(&license_id, cep78_token_id);
    self.cep78_to_license.set(&cep78_token_id, license_id);

    license_id
}

// Modified transfer function
pub fn transfer_license(license_id: u64, to: Address, sale_price: U512) {
    // ... existing validation & payment logic ...

    // Get linked CEP-78 token
    let cep78_token_id = self.license_to_cep78.get(&license_id).unwrap();

    // Burn from seller, mint to buyer
    self.burn_cep78(cep78_token_id);
    let new_cep78_id = self.mint_cep78_receipt(to, license_id, ...);

    // Update links
    self.license_to_cep78.set(&license_id, new_cep78_id);
    self.cep78_to_license.set(&new_cep78_id, license_id);
}
```

---

## Option B: Synchronized Transferable CEP-78

The CEP-78 NFT is transferable, but transfers are intercepted and routed through the LicenseNft contract to enforce royalties.

### Flow

```
1. User purchases license
   └─► Same as Option A

2. User transfers via Sampled dApp
   └─► Same as Option A (royalties enforced)

3. User transfers CEP-78 directly (external wallet/marketplace)
   └─► CEP-78 has custom transfer handler
       └─► Calls LicenseNft.sync_transfer(token_id, from, to)
           ├─► Validates transfer allowed
           ├─► PROBLEM: No payment attached, can't distribute royalties
           └─► Options:
               a) Block transfer (defeats purpose)
               b) Allow transfer, lose royalties (bad)
               c) Mark as "pending" until royalties paid (complex)
```

### Advantages
- Can list on external marketplaces (theoretically)
- More "standard" NFT behavior

### Disadvantages
- **Royalty bypass risk** - Direct transfers skip payment
- **Complex sync logic** - Two sources of truth can desync
- **CEP-78 limitations** - Custom transfer hooks are limited in Casper

### Recommendation: Don't use Option B

The complexity and royalty bypass risks make this approach unsuitable for a license system where royalties are a core feature.

---

## Option A Implementation Guide

### Step 1: Deploy CEP-78 Contract

Deploy a standard CEP-78 contract with these configurations:

```rust
// CEP-78 Installation Arguments
NFTIdentifierMode: Ordinal           // Simple incrementing IDs
NFTMetadataKind: CustomValidated     // Custom metadata schema
OwnershipMode: Transferable          // We'll restrict via Minter mode
NFTMintingMode: Installer            // Only LicenseNft can mint
NFTBurnMode: Burnable                // Allow burning on transfer
OwnerReverseLookupMode: Complete     // Enable owner queries

// Metadata Schema
{
  "properties": {
    "license_id": { "type": "integer" },
    "sample_id": { "type": "integer" },
    "sample_name": { "type": "string" },
    "license_type": { "type": "string" },
    "creator_name": { "type": "string" },
    "artwork_url": { "type": "string" },
    "purchased_at": { "type": "integer" }
  }
}
```

### Step 2: Modify LicenseNft Contract

Add CEP-78 integration to the existing contract:

```rust
// license_nft.rs additions

use odra::casper_types::{ContractPackageHash, RuntimeArgs, runtime_args};

#[odra::module]
impl LicenseNft {
    // Initialize with CEP-78 contract reference
    pub fn set_cep78_contract(&mut self, cep78_package_hash: ContractPackageHash) {
        self.only_owner();
        self.cep78_contract.set(cep78_package_hash);
    }

    // Internal: Mint CEP-78 receipt
    fn mint_cep78_receipt(
        &mut self,
        owner: Address,
        license_id: u64,
        sample_id: u64,
        license_type: LicenseType,
        sample_name: String,
        creator_name: String,
        artwork_url: String,
    ) -> u64 {
        let cep78 = self.cep78_contract.get().expect("CEP-78 not configured");

        let metadata = format!(
            r#"{{"license_id":{},"sample_id":{},"sample_name":"{}","license_type":"{}","creator_name":"{}","artwork_url":"{}","purchased_at":{}}}"#,
            license_id,
            sample_id,
            sample_name,
            license_type.as_str(),
            creator_name,
            artwork_url,
            self.env().get_block_time()
        );

        // Cross-contract call to CEP-78 mint
        let args = runtime_args! {
            "token_owner" => owner,
            "token_meta_data" => metadata,
        };

        self.env().call_contract::<(String, Address, String)>(
            cep78,
            "mint",
            args
        );

        // Return the new token ID (CEP-78 returns this)
        self.get_cep78_total_supply() - 1
    }

    // Internal: Burn CEP-78 token
    fn burn_cep78(&mut self, token_id: u64) {
        let cep78 = self.cep78_contract.get().expect("CEP-78 not configured");

        let args = runtime_args! {
            "token_id" => token_id,
        };

        self.env().call_contract::<()>(cep78, "burn", args);
    }
}
```

### Step 3: Update Frontend

Add CEP-78 metadata to purchase flow:

```typescript
// useSampledContract.ts additions

interface LicenseNFTMetadata {
  license_id: number;
  sample_id: number;
  sample_name: string;
  license_type: string;
  creator_name: string;
  artwork_url: string;
  purchased_at: number;
}

// When purchasing, include metadata for CEP-78
export const usePurchaseSampleLicense = () => {
  return useMutation({
    mutationFn: async ({
      sampleId,
      licenseType,
      sampleName,      // New: for CEP-78 metadata
      creatorName,     // New: for CEP-78 metadata
      artworkUrl       // New: for CEP-78 metadata
    }) => {
      // ... existing purchase logic ...
      // Contract now handles CEP-78 minting internally
    }
  });
};
```

### Step 4: Generate Artwork

Create unique artwork for each license NFT:

```typescript
// services/nftArtwork.ts

export async function generateLicenseArtwork(
  sampleId: number,
  licenseType: LicenseType,
  sampleCoverUrl: string
): Promise<string> {
  // Option 1: Use sample cover with license type overlay
  // Option 2: Generate unique artwork via API (e.g., Cloudinary transforms)
  // Option 3: Use template system with dynamic text

  const baseUrl = sampleCoverUrl;
  const overlay = getLicenseTypeOverlay(licenseType);

  return `${baseUrl}?overlay=${overlay}&license=${licenseType}`;
}

function getLicenseTypeOverlay(type: LicenseType): string {
  switch (type) {
    case LicenseType.Personal:
      return 'badge_personal_v1';
    case LicenseType.Commercial:
      return 'badge_commercial_v1';
    case LicenseType.Broadcast:
      return 'badge_broadcast_v1';
    case LicenseType.Exclusive:
      return 'badge_exclusive_v1';
  }
}
```

---

## Metadata & Display

### CEP-78 Token Metadata Structure

```json
{
  "license_id": 42,
  "sample_id": 123,
  "sample_name": "Midnight Bass Drop",
  "license_type": "Commercial",
  "creator_name": "BeatMaker Pro",
  "artwork_url": "https://sampled.io/nft/42/artwork.png",
  "purchased_at": 1706054400
}
```

### CSPR.live / Wallet Display

The CEP-78 NFT will display in wallets with:
- **Image**: Generated artwork with license type badge
- **Name**: "{Sample Name} - {License Type} License"
- **Collection**: "Sampled Licenses"
- **Attributes**: License type, creator, purchase date

### Deep Link to dApp

Include a link in metadata that opens the Sampled dApp:
```
https://sampled.io/license/42
```

---

## Migration Strategy

For existing licenses without CEP-78 receipts:

### Option 1: Lazy Migration
Mint CEP-78 when user visits their licenses page:

```typescript
async function ensureCep78Exists(licenseId: number) {
  const hasCep78 = await contract.license_has_cep78(licenseId);
  if (!hasCep78) {
    await contract.mint_cep78_for_existing_license(licenseId);
  }
}
```

### Option 2: Batch Migration
Admin function to mint CEP-78s for all existing licenses:

```rust
pub fn batch_mint_cep78_for_existing(&mut self, license_ids: Vec<u64>) {
    self.only_owner();
    for license_id in license_ids {
        if self.license_to_cep78.get(&license_id).is_none() {
            let license = self.licenses.get(&license_id).unwrap();
            let cep78_id = self.mint_cep78_receipt(...);
            self.license_to_cep78.set(&license_id, cep78_id);
        }
    }
}
```

### Option 3: User Claim
Let users claim their CEP-78 receipt:

```rust
pub fn claim_cep78_receipt(&mut self, license_id: u64) {
    let license = self.licenses.get(&license_id).expect("License not found");
    require!(license.current_owner == self.env().caller(), "Not owner");
    require!(self.license_to_cep78.get(&license_id).is_none(), "Already claimed");

    let cep78_id = self.mint_cep78_receipt(...);
    self.license_to_cep78.set(&license_id, cep78_id);
}
```

---

## Cost Analysis

### Additional Gas Costs

| Operation | Current | With CEP-78 | Increase |
|-----------|---------|-------------|----------|
| Purchase License | ~3 CSPR | ~5 CSPR | +2 CSPR |
| Transfer License | ~2 CSPR | ~4 CSPR | +2 CSPR |

The increase comes from cross-contract calls to mint/burn CEP-78 tokens.

### Storage Costs

- CEP-78 contract deployment: ~200 CSPR (one-time)
- Per-token storage: ~0.5 CSPR (paid during mint)

---

## Security Considerations

1. **CEP-78 Minting Authority**: Only LicenseNft contract can mint. Achieved via `NFTMintingMode::Installer` and setting LicenseNft as the installer.

2. **Burn Authority**: Only LicenseNft contract can burn. Required for transfer flow.

3. **Metadata Immutability**: Once minted, CEP-78 metadata cannot be changed. License updates (like transfers) create new tokens.

4. **Contract Upgrade Path**: If LicenseNft is upgraded, new version must be authorized as CEP-78 minter.

---

## Summary

The **Soulbound CEP-78 Receipt** approach (Option A) provides:

- ✅ Wallet visibility for users
- ✅ Enforced royalties on all transfers
- ✅ License type restrictions maintained
- ✅ Clear separation of concerns (CEP-78 = display, LicenseNft = logic)
- ✅ Future-proof (can evolve independently)

**Trade-off**: Users cannot list licenses on external NFT marketplaces, but this is acceptable since:
1. License NFTs are functional (rights-based), not collectible
2. External marketplaces wouldn't enforce royalties anyway
3. Sampled can build its own secondary marketplace with proper royalty enforcement

---

## Next Steps

1. [ ] Deploy CEP-78 contract on testnet
2. [ ] Add cross-contract calls to LicenseNft
3. [ ] Design license artwork templates
4. [ ] Update frontend to display CEP-78 NFTs
5. [ ] Implement migration strategy for existing licenses
6. [ ] Test full purchase → transfer → view flow
7. [ ] Deploy to mainnet
