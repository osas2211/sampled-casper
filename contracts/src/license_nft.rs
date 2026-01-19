//! License NFT Contract for Sampled Marketplace
//!
//! This contract manages License NFTs that represent usage rights for samples.
//! Features:
//! - Mint license NFTs on sample purchase
//! - Transfer licenses with automatic royalty distribution
//! - Track royalty earnings for creators
//! - Support for different license types with varying rights

use odra::prelude::*;
use odra::casper_types::U512;

use crate::errors::Error;
use crate::events::{
    LicenseMinted, LicenseTransferred, RoyaltyPaid, RoyaltiesWithdrawn,
    ExclusiveLicenseActivated,
};
use crate::license_types::{
    LicenseType, LicenseMetadata, SampleLicenseInfo,
    constants::*,
};

/// License NFT Contract
#[odra::module(
    events = [LicenseMinted, LicenseTransferred, RoyaltyPaid, RoyaltiesWithdrawn, ExclusiveLicenseActivated],
    errors = Error
)]
pub struct LicenseNft {
    // ============================================
    // Core Storage
    // ============================================

    /// Admin address (can set marketplace)
    admin: Var<Address>,
    /// Marketplace contract address (authorized to mint)
    marketplace: Var<Address>,

    // ============================================
    // License Storage
    // ============================================

    /// Mapping of license ID to license metadata
    licenses: Mapping<u64, LicenseMetadata>,
    /// Total number of licenses minted
    license_count: Var<u64>,

    // ============================================
    // License Indexing by Sample
    // ============================================

    /// Count of licenses per sample: sample_id -> count
    sample_license_count: Mapping<u64, u64>,
    /// Indexed licenses: (sample_id, index) -> license_id
    sample_license_at: Mapping<(u64, u64), u64>,
    /// Track exclusive license holder per sample
    sample_exclusive_holder: Mapping<u64, Address>,
    /// Track if sample has exclusive license
    sample_has_exclusive: Mapping<u64, bool>,

    // ============================================
    // License Indexing by Owner
    // ============================================

    /// Count of licenses per owner: owner -> count
    owner_license_count: Mapping<Address, u64>,
    /// Indexed licenses: (owner, index) -> license_id
    owner_license_at: Mapping<(Address, u64), u64>,

    // ============================================
    // User License Tracking (for duplicate prevention)
    // ============================================

    /// Track if user has specific license type for sample: (user, sample_id, license_type) -> license_id
    user_sample_license: Mapping<(Address, u64, u8), u64>,
    /// Check if user has specific license type: (user, sample_id, license_type) -> bool
    user_has_license_type: Mapping<(Address, u64, u8), bool>,

    // ============================================
    // Royalty Storage
    // ============================================

    /// Creator's accumulated royalty earnings
    creator_royalty_earnings: Mapping<Address, U512>,
    /// Total royalties earned by creator (lifetime)
    creator_total_royalties: Mapping<Address, U512>,
}

#[odra::module]
impl LicenseNft {
    // ============================================
    // Initialization
    // ============================================

    /// Initialize the License NFT contract
    #[odra(init)]
    pub fn init(&mut self, admin: Address) {
        self.admin.set(admin);
        self.license_count.set(0);
    }

    // ============================================
    // Admin Functions
    // ============================================

    /// Set the marketplace contract address (only admin)
    pub fn set_marketplace(&mut self, marketplace: Address) {
        let caller = self.env().caller();
        let admin = self.admin.get().unwrap();
        if caller != admin {
            self.env().revert(Error::Unauthorized);
        }
        self.marketplace.set(marketplace);
    }

    /// Get the marketplace address
    pub fn get_marketplace(&self) -> Option<Address> {
        self.marketplace.get()
    }

    /// Get the admin address
    pub fn get_admin(&self) -> Option<Address> {
        self.admin.get()
    }

    // ============================================
    // Minting (Called by Marketplace)
    // ============================================

    /// Mint a new license NFT
    /// Only callable by the marketplace contract
    pub fn mint_license(
        &mut self,
        sample_id: u64,
        license_type: u8,
        buyer: Address,
        original_creator: Address,
        purchase_price: U512,
    ) -> u64 {
        // Verify caller is marketplace
        let caller = self.env().caller();
        let marketplace = self.marketplace.get()
            .unwrap_or_else(|| self.env().revert(Error::LicenseContractNotSet));
        if caller != marketplace {
            self.env().revert(Error::Unauthorized);
        }

        // Parse license type
        let lt = LicenseType::from_u8(license_type)
            .unwrap_or_else(|| self.env().revert(Error::InvalidLicenseType));

        // Check for exclusive license restrictions
        if self.sample_has_exclusive.get_or_default(&sample_id) {
            self.env().revert(Error::SampleExclusivelyLicensed);
        }

        // Check if user already has this license type for this sample
        if self.user_has_license_type.get_or_default(&(buyer, sample_id, license_type)) {
            self.env().revert(Error::AlreadyHasLicenseType);
        }

        // Generate new license ID
        let license_count = self.license_count.get_or_default();
        let license_id = license_count + 1;
        self.license_count.set(license_id);

        let timestamp = self.env().get_block_time();

        // Create license metadata
        let license = LicenseMetadata {
            license_id,
            sample_id,
            license_type: lt,
            original_creator,
            current_owner: buyer,
            purchase_price,
            purchase_timestamp: timestamp,
            is_active: true,
            transfer_count: 0,
        };

        // Store license
        self.licenses.set(&license_id, license);

        // Index by sample
        let sample_count = self.sample_license_count.get_or_default(&sample_id);
        self.sample_license_at.set(&(sample_id, sample_count), license_id);
        self.sample_license_count.set(&sample_id, sample_count + 1);

        // Index by owner
        let owner_count = self.owner_license_count.get_or_default(&buyer);
        self.owner_license_at.set(&(buyer, owner_count), license_id);
        self.owner_license_count.set(&buyer, owner_count + 1);

        // Track user's license type
        self.user_sample_license.set(&(buyer, sample_id, license_type), license_id);
        self.user_has_license_type.set(&(buyer, sample_id, license_type), true);

        // Handle exclusive license
        if lt.to_u8() == LicenseType::Exclusive.to_u8() {
            self.sample_has_exclusive.set(&sample_id, true);
            self.sample_exclusive_holder.set(&sample_id, buyer);

            self.env().emit_event(ExclusiveLicenseActivated {
                sample_id,
                license_id,
                holder: buyer,
                timestamp,
            });
        }

        // Emit mint event
        self.env().emit_event(LicenseMinted {
            license_id,
            sample_id,
            license_type,
            buyer,
            creator: original_creator,
            price: purchase_price,
            timestamp,
        });

        license_id
    }

    // ============================================
    // Transfer Functions
    // ============================================

    /// Transfer a license NFT to another address
    /// Requires attached payment: sale_price + royalties
    /// Royalties: 10% to original creator, 2% to platform
    #[odra(payable)]
    pub fn transfer_license(
        &mut self,
        license_id: u64,
        to: Address,
        sale_price: U512,
    ) {
        let caller = self.env().caller();
        let attached_value = self.env().attached_value();

        // Get license
        let mut license = self.licenses.get(&license_id)
            .unwrap_or_else(|| self.env().revert(Error::LicenseNotFound));

        // Validate ownership
        if license.current_owner != caller {
            self.env().revert(Error::NotLicenseOwner);
        }

        // Check license is active
        if !license.is_active {
            self.env().revert(Error::LicenseInactive);
        }

        // Exclusive licenses cannot be transferred
        if license.license_type.to_u8() == LicenseType::Exclusive.to_u8() {
            self.env().revert(Error::CannotTransferExclusiveLicense);
        }

        // Calculate royalties
        let creator_royalty = sale_price * CREATOR_ROYALTY_PERCENT / 100;
        let platform_fee = sale_price * RESALE_PLATFORM_FEE_PERCENT / 100;
        let total_required = sale_price + creator_royalty + platform_fee;

        // Verify payment
        if attached_value < total_required {
            self.env().revert(Error::InsufficientRoyaltyPayment);
        }

        let previous_owner = license.current_owner;
        let license_type_u8 = license.license_type.to_u8();
        let sample_id = license.sample_id;

        // Update license ownership
        license.current_owner = to;
        license.transfer_count += 1;
        self.licenses.set(&license_id, license.clone());

        // Update owner indexing - remove from previous owner's list
        self.remove_from_owner_list(previous_owner, license_id);
        // Add to new owner's list
        let new_owner_count = self.owner_license_count.get_or_default(&to);
        self.owner_license_at.set(&(to, new_owner_count), license_id);
        self.owner_license_count.set(&to, new_owner_count + 1);

        // Update user license tracking
        self.user_has_license_type.set(&(previous_owner, sample_id, license_type_u8), false);
        self.user_sample_license.set(&(previous_owner, sample_id, license_type_u8), 0);
        self.user_has_license_type.set(&(to, sample_id, license_type_u8), true);
        self.user_sample_license.set(&(to, sample_id, license_type_u8), license_id);

        // Transfer sale price to seller
        self.env().transfer_tokens(&previous_owner, &sale_price);

        // Add royalty to creator's earnings
        let current_royalties = self.creator_royalty_earnings.get_or_default(&license.original_creator);
        self.creator_royalty_earnings.set(&license.original_creator, current_royalties + creator_royalty);
        let total_royalties = self.creator_total_royalties.get_or_default(&license.original_creator);
        self.creator_total_royalties.set(&license.original_creator, total_royalties + creator_royalty);

        // Transfer platform fee to admin
        let admin = self.admin.get().unwrap();
        self.env().transfer_tokens(&admin, &platform_fee);

        let timestamp = self.env().get_block_time();

        // Emit events
        self.env().emit_event(LicenseTransferred {
            license_id,
            from: previous_owner,
            to,
            sale_price,
            creator_royalty,
            platform_fee,
            timestamp,
        });

        self.env().emit_event(RoyaltyPaid {
            license_id,
            creator: license.original_creator,
            amount: creator_royalty,
            timestamp,
        });
    }

    // ============================================
    // Royalty Withdrawal
    // ============================================

    /// Withdraw accumulated royalty earnings
    pub fn withdraw_royalties(&mut self) {
        let caller = self.env().caller();

        let earnings = self.creator_royalty_earnings.get_or_default(&caller);
        if earnings == U512::zero() {
            self.env().revert(Error::NoRoyaltiesToWithdraw);
        }

        // Reset earnings before transfer (CEI pattern)
        self.creator_royalty_earnings.set(&caller, U512::zero());

        // Transfer royalties
        self.env().transfer_tokens(&caller, &earnings);

        self.env().emit_event(RoyaltiesWithdrawn {
            creator: caller,
            amount: earnings,
            timestamp: self.env().get_block_time(),
        });
    }

    // ============================================
    // View Functions
    // ============================================

    /// Get license metadata by ID
    pub fn get_license(&self, license_id: u64) -> Option<LicenseMetadata> {
        self.licenses.get(&license_id)
    }

    /// Get the owner of a license
    pub fn get_owner(&self, license_id: u64) -> Option<Address> {
        self.licenses.get(&license_id).map(|l| l.current_owner)
    }

    /// Get total number of licenses minted
    pub fn get_license_count(&self) -> u64 {
        self.license_count.get_or_default()
    }

    /// Get all license IDs owned by an address
    pub fn get_licenses_by_owner(&self, owner: Address) -> Vec<u64> {
        let count = self.owner_license_count.get_or_default(&owner);
        let mut result = Vec::new();
        for i in 0..count {
            if let Some(id) = self.owner_license_at.get(&(owner, i)) {
                if id > 0 {
                    // Verify ownership hasn't changed
                    if let Some(license) = self.licenses.get(&id) {
                        if license.current_owner == owner {
                            result.push(id);
                        }
                    }
                }
            }
        }
        result
    }

    /// Get all license IDs for a sample
    pub fn get_licenses_by_sample(&self, sample_id: u64) -> Vec<u64> {
        let count = self.sample_license_count.get_or_default(&sample_id);
        let mut result = Vec::new();
        for i in 0..count {
            if let Some(id) = self.sample_license_at.get(&(sample_id, i)) {
                result.push(id);
            }
        }
        result
    }

    /// Get license count for a sample
    pub fn get_sample_license_count(&self, sample_id: u64) -> u64 {
        self.sample_license_count.get_or_default(&sample_id)
    }

    /// Check if user has a specific license type for a sample
    pub fn has_license(&self, owner: Address, sample_id: u64, license_type: u8) -> bool {
        self.user_has_license_type.get_or_default(&(owner, sample_id, license_type))
    }

    /// Get user's license ID for a sample and type (if they have one)
    pub fn get_user_license(&self, owner: Address, sample_id: u64, license_type: u8) -> Option<u64> {
        let license_id = self.user_sample_license.get_or_default(&(owner, sample_id, license_type));
        if license_id > 0 {
            Some(license_id)
        } else {
            None
        }
    }

    /// Check if sample has an exclusive license
    pub fn is_exclusively_licensed(&self, sample_id: u64) -> bool {
        self.sample_has_exclusive.get_or_default(&sample_id)
    }

    /// Get exclusive license holder for a sample
    pub fn get_exclusive_holder(&self, sample_id: u64) -> Option<Address> {
        if self.sample_has_exclusive.get_or_default(&sample_id) {
            self.sample_exclusive_holder.get(&sample_id)
        } else {
            None
        }
    }

    /// Get sample license info summary
    pub fn get_sample_license_info(&self, sample_id: u64) -> SampleLicenseInfo {
        let licenses = self.get_licenses_by_sample(sample_id);
        let mut info = SampleLicenseInfo::default();
        info.total_licenses = licenses.len() as u64;

        for license_id in licenses {
            if let Some(license) = self.licenses.get(&license_id) {
                match license.license_type {
                    LicenseType::Personal => info.personal_count += 1,
                    LicenseType::Commercial => info.commercial_count += 1,
                    LicenseType::Broadcast => info.broadcast_count += 1,
                    LicenseType::Exclusive => {
                        info.has_exclusive = true;
                        info.exclusive_holder = Some(license.current_owner);
                    }
                }
            }
        }

        info
    }

    /// Get creator's available royalty earnings
    pub fn get_royalty_earnings(&self, creator: Address) -> U512 {
        self.creator_royalty_earnings.get_or_default(&creator)
    }

    /// Get creator's total lifetime royalties
    pub fn get_total_royalties(&self, creator: Address) -> U512 {
        self.creator_total_royalties.get_or_default(&creator)
    }

    // ============================================
    // Internal Functions
    // ============================================

    /// Remove a license from an owner's indexed list
    /// Note: This leaves gaps in the index, which is handled in get_licenses_by_owner
    fn remove_from_owner_list(&mut self, owner: Address, license_id: u64) {
        let count = self.owner_license_count.get_or_default(&owner);
        for i in 0..count {
            if let Some(id) = self.owner_license_at.get(&(owner, i)) {
                if id == license_id {
                    // Mark as removed by setting to 0
                    self.owner_license_at.set(&(owner, i), 0);
                    break;
                }
            }
        }
    }
}

// ============================================
// Tests - TODO: Fix test configuration for cross-contract references
// ============================================

// Tests are temporarily disabled due to Odra macro limitations with cross-contract references.
// The contracts compile and build successfully. Integration tests should be run separately.
