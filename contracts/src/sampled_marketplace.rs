//! Sampled Marketplace - Main Contract Module
//!
//! This module implements the core marketplace functionality for
//! listing, purchasing, and managing music samples on Casper Network.
//! Now includes NFT-based license system integration.

use odra::prelude::*;
use odra::casper_types::U512;

use crate::errors::Error;
use crate::events::{
    SampleUploaded, SamplePurchased, EarningsWithdrawn,
    SampleDeactivated, PriceUpdated, LicensePricingUpdated,
};
use crate::types::{Sample, PurchaseRecord, UserStats, MarketplaceStats, constants::*};
use crate::license_types::{LicenseType, LicensePricing, AllLicensePrices};
use crate::license_nft::LicenseNftContractRef;
use odra::ContractRef;


/// Main marketplace contract module
#[odra::module(
    events = [SampleUploaded, SamplePurchased, EarningsWithdrawn, SampleDeactivated, PriceUpdated, LicensePricingUpdated],
    errors = Error
)]
pub struct SampledMarketplace {
    // ============================================
    // Storage Variables
    // ============================================

    /// Mapping of sample ID to Sample data
    samples: Mapping<u64, Sample>,
    /// Total number of samples (used for generating IDs)
    sample_count: Var<u64>,
    /// Total trading volume in motes
    total_volume: Var<U512>,
    /// Total platform fees collected
    platform_fee_collected: Var<U512>,
    /// Admin address (receives platform fees)
    admin: Var<Address>,

    // ============================================
    // User Data Storage (using indexed mappings)
    // ============================================

    /// Count of samples uploaded by each user
    user_uploaded_count: Mapping<Address, u64>,
    /// Indexed sample IDs: (user, index) -> sample_id
    user_uploaded_at: Mapping<(Address, u64), u64>,

    /// Count of samples purchased by each user
    user_purchased_count: Mapping<Address, u64>,
    /// Indexed purchased sample IDs: (user, index) -> sample_id
    user_purchased_at: Mapping<(Address, u64), u64>,

    /// User's available earnings (withdrawable)
    user_earnings: Mapping<Address, U512>,
    /// User's total lifetime earnings
    user_total_earned: Mapping<Address, U512>,
    /// User's total lifetime spending
    user_total_spent: Mapping<Address, U512>,
    /// Purchase records for each user (buyer, sample_id) -> PurchaseRecord
    user_purchase_records: Mapping<(Address, u64), PurchaseRecord>,

    // ============================================
    // License System Storage
    // ============================================

    /// License NFT contract reference
    license_nft_contract: Var<Address>,
    /// Custom license pricing per sample: sample_id -> LicensePricing
    sample_license_pricing: Mapping<u64, LicensePricing>,
}

#[odra::module]
impl SampledMarketplace {
    // ============================================
    // Initialization
    // ============================================

    /// Initialize the marketplace contract
    #[odra(init)]
    pub fn init(&mut self, admin: Address) {
        self.admin.set(admin);
        self.sample_count.set(0);
        self.total_volume.set(U512::zero());
        self.platform_fee_collected.set(U512::zero());
    }

    // ============================================
    // Core Entry Points
    // ============================================

    /// Upload a new sample to the marketplace
    pub fn upload_sample(
        &mut self,
        price: U512,
        ipfs_link: String,
        title: String,
        bpm: u64,
        genre: String,
        cover_image: String,
        video_preview_link: String,
    ) {
        let caller = self.env().caller();

        // Validate inputs
        if price == U512::zero() {
            self.env().revert(Error::InvalidPrice);
        }
        if title.len() > MAX_TITLE_LENGTH {
            self.env().revert(Error::TitleTooLong);
        }
        if ipfs_link.len() > MAX_IPFS_LINK_LENGTH {
            self.env().revert(Error::IpfsLinkTooLong);
        }
        if genre.len() > MAX_GENRE_LENGTH {
            self.env().revert(Error::GenreTooLong);
        }
        if cover_image.len() > MAX_COVER_IMAGE_LENGTH {
            self.env().revert(Error::CoverImageTooLong);
        }
        if video_preview_link.len() > MAX_VIDEO_PREVIEW_LENGTH {
            self.env().revert(Error::VideoPreviewTooLong);
        }

        // Generate new sample ID
        let sample_count = self.sample_count.get_or_default();
        let sample_id = sample_count + 1;
        self.sample_count.set(sample_id);

        // Get current timestamp
        let timestamp = self.env().get_block_time();

        // Create sample
        let sample = Sample {
            sample_id,
            seller: caller,
            price,
            ipfs_link: ipfs_link.clone(),
            title: title.clone(),
            bpm,
            genre,
            cover_image: cover_image.clone(),
            video_preview_link,
            total_sales: 0,
            is_active: true,
            created_at: timestamp,
        };

        // Store sample
        self.samples.set(&sample_id, sample);

        // Add to user's uploaded samples using indexed mapping
        let user_count = self.user_uploaded_count.get_or_default(&caller);
        self.user_uploaded_at.set(&(caller, user_count), sample_id);
        self.user_uploaded_count.set(&caller, user_count + 1);

        // Emit event
        self.env().emit_event(SampleUploaded {
            sample_id,
            seller: caller,
            price,
            title,
            ipfs_link,
            cover_image,
            timestamp,
        });
    }

    /// Purchase a sample from the marketplace
    #[odra(payable)]
    pub fn purchase_sample(&mut self, sample_id: u64) {
        let caller = self.env().caller();
        let attached_value = self.env().attached_value();

        // Get sample
        let mut sample = self.samples.get(&sample_id)
            .unwrap_or_else(|| self.env().revert(Error::SampleNotFound));

        // Validate
        if !sample.is_active {
            self.env().revert(Error::SampleInactive);
        }
        if attached_value < sample.price {
            self.env().revert(Error::InsufficientPayment);
        }

        // Check if already purchased
        if self.has_purchased_internal(&caller, sample_id) {
            self.env().revert(Error::AlreadyPurchased);
        }

        // Calculate fees
        let platform_fee = sample.price * PLATFORM_FEE_NUMERATOR / PLATFORM_FEE_DENOMINATOR;
        let seller_amount = sample.price - platform_fee;

        // Update sample stats
        sample.total_sales += 1;
        self.samples.set(&sample_id, sample.clone());

        // Update marketplace stats
        let total_volume = self.total_volume.get_or_default() + sample.price;
        self.total_volume.set(total_volume);
        let fee_collected = self.platform_fee_collected.get_or_default() + platform_fee;
        self.platform_fee_collected.set(fee_collected);

        // Update buyer's purchased samples using indexed mapping
        let buyer_count = self.user_purchased_count.get_or_default(&caller);
        self.user_purchased_at.set(&(caller, buyer_count), sample_id);
        self.user_purchased_count.set(&caller, buyer_count + 1);

        let buyer_spent = self.user_total_spent.get_or_default(&caller) + sample.price;
        self.user_total_spent.set(&caller, buyer_spent);

        // Store purchase record
        let timestamp = self.env().get_block_time();
        let purchase_record = PurchaseRecord {
            sample_id,
            seller: sample.seller,
            price: sample.price,
            timestamp,
            ipfs_link: sample.ipfs_link.clone(),
        };
        self.user_purchase_records.set(&(caller, sample_id), purchase_record);

        // Update seller's earnings
        let seller_earnings = self.user_earnings.get_or_default(&sample.seller) + seller_amount;
        self.user_earnings.set(&sample.seller, seller_earnings);
        let seller_total = self.user_total_earned.get_or_default(&sample.seller) + seller_amount;
        self.user_total_earned.set(&sample.seller, seller_total);

        // Transfer platform fee to admin
        let admin = self.admin.get().unwrap();
        self.env().transfer_tokens(&admin, &platform_fee);

        // Emit event
        self.env().emit_event(SamplePurchased {
            sample_id,
            buyer: caller,
            seller: sample.seller,
            price: sample.price,
            platform_fee,
            timestamp,
        });
    }

    /// Update the price of a sample
    pub fn update_price(&mut self, sample_id: u64, new_price: U512) {
        let caller = self.env().caller();

        if new_price == U512::zero() {
            self.env().revert(Error::InvalidPrice);
        }

        let mut sample = self.samples.get(&sample_id)
            .unwrap_or_else(|| self.env().revert(Error::SampleNotFound));

        if sample.seller != caller {
            self.env().revert(Error::NotSeller);
        }

        let old_price = sample.price;
        sample.price = new_price;
        self.samples.set(&sample_id, sample);

        self.env().emit_event(PriceUpdated {
            sample_id,
            old_price,
            new_price,
            timestamp: self.env().get_block_time(),
        });
    }

    /// Deactivate a sample (soft delete)
    pub fn deactivate_sample(&mut self, sample_id: u64) {
        let caller = self.env().caller();

        let mut sample = self.samples.get(&sample_id)
            .unwrap_or_else(|| self.env().revert(Error::SampleNotFound));

        if sample.seller != caller {
            self.env().revert(Error::NotSeller);
        }

        sample.is_active = false;
        self.samples.set(&sample_id, sample);

        self.env().emit_event(SampleDeactivated {
            sample_id,
            seller: caller,
            timestamp: self.env().get_block_time(),
        });
    }

    /// Withdraw accumulated earnings
    pub fn withdraw_earnings(&mut self) {
        let caller = self.env().caller();

        let earnings = self.user_earnings.get_or_default(&caller);
        if earnings == U512::zero() {
            self.env().revert(Error::NoEarnings);
        }

        // Reset earnings before transfer (CEI pattern)
        self.user_earnings.set(&caller, U512::zero());

        // Transfer earnings to user
        self.env().transfer_tokens(&caller, &earnings);

        self.env().emit_event(EarningsWithdrawn {
            user: caller,
            amount: earnings,
            timestamp: self.env().get_block_time(),
        });
    }

    // ============================================
    // License System Entry Points
    // ============================================

    /// Set the License NFT contract address (admin only)
    pub fn set_license_nft_contract(&mut self, license_contract: Address) {
        let caller = self.env().caller();
        let admin = self.admin.get().unwrap();
        if caller != admin {
            self.env().revert(Error::Unauthorized);
        }
        self.license_nft_contract.set(license_contract);
    }

    /// Get the License NFT contract address
    pub fn get_license_nft_contract(&self) -> Option<Address> {
        self.license_nft_contract.get()
    }

    /// Purchase a sample license (mints a License NFT)
    #[odra(payable)]
    pub fn purchase_sample_license(&mut self, sample_id: u64, license_type: u8) {
        let caller = self.env().caller();
        let attached_value = self.env().attached_value();

        // Get sample
        let mut sample = self.samples.get(&sample_id)
            .unwrap_or_else(|| self.env().revert(Error::SampleNotFound));

        // Validate sample is active
        if !sample.is_active {
            self.env().revert(Error::SampleInactive);
        }

        // Cannot purchase own sample
        if sample.seller == caller {
            self.env().revert(Error::CannotPurchaseOwnSample);
        }

        // Check for exclusive license by querying the LicenseNft contract
        let license_contract_addr = self.license_nft_contract.get()
            .unwrap_or_else(|| self.env().revert(Error::LicenseContractNotSet));
        let mut license_nft = LicenseNftContractRef::new(self.env(), license_contract_addr);
        if license_nft.is_exclusively_licensed(sample_id) {
            self.env().revert(Error::SampleExclusivelyLicensed);
        }

        // Parse license type
        let lt = LicenseType::from_u8(license_type)
            .unwrap_or_else(|| self.env().revert(Error::InvalidLicenseType));

        // Calculate license price
        let license_price = self.calculate_license_price(sample_id, &lt, sample.price);

        // Validate payment
        if attached_value < license_price {
            self.env().revert(Error::InsufficientPayment);
        }

        // License contract reference already obtained above

        // Calculate fees
        let platform_fee = license_price * PLATFORM_FEE_NUMERATOR / PLATFORM_FEE_DENOMINATOR;
        let seller_amount = license_price - platform_fee;

        // Update sample stats
        sample.total_sales += 1;
        self.samples.set(&sample_id, sample.clone());

        // Update marketplace stats
        let total_volume = self.total_volume.get_or_default() + license_price;
        self.total_volume.set(total_volume);
        let fee_collected = self.platform_fee_collected.get_or_default() + platform_fee;
        self.platform_fee_collected.set(fee_collected);

        // Update buyer stats
        let buyer_count = self.user_purchased_count.get_or_default(&caller);
        self.user_purchased_at.set(&(caller, buyer_count), sample_id);
        self.user_purchased_count.set(&caller, buyer_count + 1);
        let buyer_spent = self.user_total_spent.get_or_default(&caller) + license_price;
        self.user_total_spent.set(&caller, buyer_spent);

        // Store purchase record
        let timestamp = self.env().get_block_time();
        let purchase_record = PurchaseRecord {
            sample_id,
            seller: sample.seller,
            price: license_price,
            timestamp,
            ipfs_link: sample.ipfs_link.clone(),
        };
        self.user_purchase_records.set(&(caller, sample_id), purchase_record);

        // Update seller's earnings
        let seller_earnings = self.user_earnings.get_or_default(&sample.seller) + seller_amount;
        self.user_earnings.set(&sample.seller, seller_earnings);
        let seller_total = self.user_total_earned.get_or_default(&sample.seller) + seller_amount;
        self.user_total_earned.set(&sample.seller, seller_total);

        // Transfer platform fee to admin
        let admin = self.admin.get().unwrap();
        self.env().transfer_tokens(&admin, &platform_fee);

        // Handle exclusive license - deactivate sample
        if lt.to_u8() == LicenseType::Exclusive.to_u8() {
            // Deactivate sample from marketplace
            let mut sample = self.samples.get(&sample_id).unwrap();
            sample.is_active = false;
            self.samples.set(&sample_id, sample);
        }

        // Mint license NFT (LicenseNft contract handles exclusive tracking)
        license_nft.mint_license(
            sample_id,
            license_type,
            caller,
            sample.seller,
            license_price,
        );

        // Emit event
        self.env().emit_event(SamplePurchased {
            sample_id,
            buyer: caller,
            seller: sample.seller,
            price: license_price,
            platform_fee,
            timestamp,
        });
    }

    /// Set custom license pricing for a sample (seller only)
    pub fn set_license_pricing(
        &mut self,
        sample_id: u64,
        personal_mult: u64,
        commercial_mult: u64,
        broadcast_mult: u64,
        exclusive_mult: u64,
    ) {
        let caller = self.env().caller();

        // Validate multipliers
        if personal_mult == 0 || commercial_mult == 0 || broadcast_mult == 0 || exclusive_mult == 0 {
            self.env().revert(Error::InvalidPricingMultiplier);
        }

        // Get sample and verify ownership
        let sample = self.samples.get(&sample_id)
            .unwrap_or_else(|| self.env().revert(Error::SampleNotFound));

        if sample.seller != caller {
            self.env().revert(Error::NotSeller);
        }

        // Set pricing
        let pricing = LicensePricing {
            personal_multiplier: personal_mult,
            commercial_multiplier: commercial_mult,
            broadcast_multiplier: broadcast_mult,
            exclusive_multiplier: exclusive_mult,
        };
        self.sample_license_pricing.set(&sample_id, pricing);

        self.env().emit_event(LicensePricingUpdated {
            sample_id,
            personal_mult,
            commercial_mult,
            broadcast_mult,
            exclusive_mult,
            timestamp: self.env().get_block_time(),
        });
    }

    /// Get the price for a specific license type
    pub fn get_license_price(&self, sample_id: u64, license_type: u8) -> U512 {
        if let Some(sample) = self.samples.get(&sample_id) {
            let lt = LicenseType::from_u8(license_type).unwrap_or(LicenseType::Personal);
            self.calculate_license_price(sample_id, &lt, sample.price)
        } else {
            U512::zero()
        }
    }

    /// Get all license prices for a sample
    pub fn get_all_license_prices(&self, sample_id: u64) -> AllLicensePrices {
        if let Some(sample) = self.samples.get(&sample_id) {
            AllLicensePrices {
                personal: self.calculate_license_price(sample_id, &LicenseType::Personal, sample.price),
                commercial: self.calculate_license_price(sample_id, &LicenseType::Commercial, sample.price),
                broadcast: self.calculate_license_price(sample_id, &LicenseType::Broadcast, sample.price),
                exclusive: self.calculate_license_price(sample_id, &LicenseType::Exclusive, sample.price),
            }
        } else {
            AllLicensePrices::default()
        }
    }

    /// Get license pricing multipliers for a sample
    pub fn get_license_pricing(&self, sample_id: u64) -> LicensePricing {
        self.sample_license_pricing.get(&sample_id)
            .unwrap_or_else(LicensePricing::default_pricing)
    }

    /// Check if a sample has an exclusive license
    pub fn is_exclusively_licensed(&self, sample_id: u64) -> bool {
        if let Some(license_contract_addr) = self.license_nft_contract.get() {
            let license_nft = LicenseNftContractRef::new(self.env(), license_contract_addr);
            license_nft.is_exclusively_licensed(sample_id)
        } else {
            false
        }
    }

    /// Get the exclusive license holder for a sample
    pub fn get_exclusive_holder(&self, sample_id: u64) -> Option<Address> {
        if let Some(license_contract_addr) = self.license_nft_contract.get() {
            let license_nft = LicenseNftContractRef::new(self.env(), license_contract_addr);
            license_nft.get_exclusive_holder(sample_id)
        } else {
            None
        }
    }

    // ============================================
    // View Functions
    // ============================================

    /// Get a sample by ID
    pub fn get_sample(&self, sample_id: u64) -> Option<Sample> {
        self.samples.get(&sample_id)
    }

    /// Get user statistics
    pub fn get_user_stats(&self, user: Address) -> UserStats {
        UserStats {
            uploaded_count: self.user_uploaded_count.get_or_default(&user),
            purchased_count: self.user_purchased_count.get_or_default(&user),
            earnings: self.user_earnings.get_or_default(&user),
            total_earned: self.user_total_earned.get_or_default(&user),
            total_spent: self.user_total_spent.get_or_default(&user),
        }
    }

    /// Get marketplace statistics
    pub fn get_marketplace_stats(&self) -> MarketplaceStats {
        MarketplaceStats {
            sample_count: self.sample_count.get_or_default(),
            total_volume: self.total_volume.get_or_default(),
            platform_fee_collected: self.platform_fee_collected.get_or_default(),
        }
    }

    /// Check if a user has purchased a specific sample
    pub fn has_purchased(&self, buyer: Address, sample_id: u64) -> bool {
        self.has_purchased_internal(&buyer, sample_id)
    }

    /// Get user's uploaded sample IDs
    pub fn get_user_samples(&self, user: Address) -> Vec<u64> {
        let count = self.user_uploaded_count.get_or_default(&user);
        let mut result = Vec::new();
        for i in 0..count {
            if let Some(id) = self.user_uploaded_at.get(&(user, i)) {
                result.push(id);
            }
        }
        result
    }

    /// Get user's purchased sample IDs
    pub fn get_user_purchases(&self, user: Address) -> Vec<u64> {
        let count = self.user_purchased_count.get_or_default(&user);
        let mut result = Vec::new();
        for i in 0..count {
            if let Some(id) = self.user_purchased_at.get(&(user, i)) {
                result.push(id);
            }
        }
        result
    }

    /// Get user's available earnings
    pub fn get_earnings(&self, user: Address) -> U512 {
        self.user_earnings.get_or_default(&user)
    }

    /// Get all active samples
    pub fn get_all_samples(&self) -> Vec<Sample> {
        let count = self.sample_count.get_or_default();
        let mut result = Vec::new();
        for id in 1..=count {
            if let Some(sample) = self.samples.get(&id) {
                if sample.is_active {
                    result.push(sample);
                }
            }
        }
        result
    }

    /// Get full sample data for user's uploaded samples
    pub fn get_user_samples_full(&self, user: Address) -> Vec<Sample> {
        let sample_ids = self.get_user_samples(user);
        let mut result = Vec::new();
        for id in sample_ids {
            if let Some(sample) = self.samples.get(&id) {
                result.push(sample);
            }
        }
        result
    }

    /// Get full sample data for user's purchased samples
    pub fn get_user_purchases_full(&self, user: Address) -> Vec<Sample> {
        let sample_ids = self.get_user_purchases(user);
        let mut result = Vec::new();
        for id in sample_ids {
            if let Some(sample) = self.samples.get(&id) {
                result.push(sample);
            }
        }
        result
    }

    /// Get the admin address
    pub fn get_admin(&self) -> Option<Address> {
        self.admin.get()
    }

    // ============================================
    // Internal Functions
    // ============================================

    fn has_purchased_internal(&self, buyer: &Address, sample_id: u64) -> bool {
        self.user_purchase_records.get(&(*buyer, sample_id)).is_some()
    }

    /// Calculate the license price based on sample base price and license type
    fn calculate_license_price(&self, sample_id: u64, license_type: &LicenseType, base_price: U512) -> U512 {
        // Get custom pricing or use defaults
        let pricing = self.sample_license_pricing.get(&sample_id)
            .unwrap_or_else(LicensePricing::default_pricing);

        pricing.calculate_price(base_price, license_type)
    }
}

// ============================================
// Tests - TODO: Fix test configuration for cross-contract references
// ============================================

// Tests are temporarily disabled due to Odra macro limitations with cross-contract references.
// The contracts compile and build successfully. Integration tests should be run separately.
