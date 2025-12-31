//! Sampled Marketplace - Main Contract Module
//!
//! This module implements the core marketplace functionality for
//! listing, purchasing, and managing music samples on Casper Network.

use odra::prelude::*;
use odra::casper_types::U512;
use odra::{Address, Mapping, List, Var};

use crate::errors::Error;
use crate::events::{
    SampleUploaded, SamplePurchased, EarningsWithdrawn,
    SampleDeactivated, PriceUpdated,
};
use crate::types::{Sample, PurchaseRecord, UserStats, MarketplaceStats, constants::*};

/// Initialization arguments for the marketplace
#[odra::odra_type]
pub struct SampledMarketplaceInitArgs {
    /// Initial admin address (receives platform fees)
    pub admin: Address,
}

/// Main marketplace contract module
#[odra::module(events = [
    SampleUploaded,
    SamplePurchased,
    EarningsWithdrawn,
    SampleDeactivated,
    PriceUpdated
])]
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
    // User Data Storage
    // ============================================

    /// List of sample IDs uploaded by each user
    user_uploaded_samples: Mapping<Address, List<u64>>,
    /// List of sample IDs purchased by each user
    user_purchased_samples: Mapping<Address, List<u64>>,
    /// User's available earnings (withdrawable)
    user_earnings: Mapping<Address, U512>,
    /// User's total lifetime earnings
    user_total_earned: Mapping<Address, U512>,
    /// User's total lifetime spending
    user_total_spent: Mapping<Address, U512>,
    /// Purchase records for each user (sample_id -> PurchaseRecord)
    user_purchase_records: Mapping<(Address, u64), PurchaseRecord>,
}

#[odra::module]
impl SampledMarketplace {
    // ============================================
    // Initialization
    // ============================================

    /// Initialize the marketplace contract
    ///
    /// # Arguments
    /// * `init_args` - Initialization arguments containing admin address
    #[odra(init)]
    pub fn init(&mut self, init_args: SampledMarketplaceInitArgs) {
        self.admin.set(init_args.admin);
        self.sample_count.set(0);
        self.total_volume.set(U512::zero());
        self.platform_fee_collected.set(U512::zero());
    }

    // ============================================
    // Core Entry Points
    // ============================================

    /// Upload a new sample to the marketplace
    ///
    /// # Arguments
    /// * `price` - Price in motes
    /// * `ipfs_link` - IPFS link to the audio file
    /// * `title` - Title of the sample
    /// * `bpm` - Beats per minute
    /// * `genre` - Music genre
    /// * `cover_image` - IPFS link to cover image
    /// * `video_preview_link` - Optional IPFS link to video preview
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

        // Add to user's uploaded samples
        let mut user_samples = self.user_uploaded_samples.get_or_default(&caller);
        user_samples.push(sample_id);

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
    ///
    /// # Arguments
    /// * `sample_id` - ID of the sample to purchase
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

        // Update buyer's data
        let mut buyer_purchases = self.user_purchased_samples.get_or_default(&caller);
        buyer_purchases.push(sample_id);
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
    ///
    /// # Arguments
    /// * `sample_id` - ID of the sample
    /// * `new_price` - New price in motes
    pub fn update_price(&mut self, sample_id: u64, new_price: U512) {
        let caller = self.env().caller();

        if new_price == U512::zero() {
            self.env().revert(Error::InvalidPrice);
        }

        // Get sample
        let mut sample = self.samples.get(&sample_id)
            .unwrap_or_else(|| self.env().revert(Error::SampleNotFound));

        // Verify ownership
        if sample.seller != caller {
            self.env().revert(Error::NotSeller);
        }

        let old_price = sample.price;
        sample.price = new_price;
        self.samples.set(&sample_id, sample);

        // Emit event
        self.env().emit_event(PriceUpdated {
            sample_id,
            old_price,
            new_price,
            timestamp: self.env().get_block_time(),
        });
    }

    /// Deactivate a sample (soft delete)
    ///
    /// # Arguments
    /// * `sample_id` - ID of the sample to deactivate
    pub fn deactivate_sample(&mut self, sample_id: u64) {
        let caller = self.env().caller();

        // Get sample
        let mut sample = self.samples.get(&sample_id)
            .unwrap_or_else(|| self.env().revert(Error::SampleNotFound));

        // Verify ownership
        if sample.seller != caller {
            self.env().revert(Error::NotSeller);
        }

        sample.is_active = false;
        self.samples.set(&sample_id, sample);

        // Emit event
        self.env().emit_event(SampleDeactivated {
            sample_id,
            seller: caller,
            timestamp: self.env().get_block_time(),
        });
    }

    /// Withdraw accumulated earnings
    pub fn withdraw_earnings(&mut self) {
        let caller = self.env().caller();

        // Get earnings
        let earnings = self.user_earnings.get_or_default(&caller);
        if earnings == U512::zero() {
            self.env().revert(Error::NoEarnings);
        }

        // Reset earnings before transfer (CEI pattern)
        self.user_earnings.set(&caller, U512::zero());

        // Transfer earnings to user
        self.env().transfer_tokens(&caller, &earnings);

        // Emit event
        self.env().emit_event(EarningsWithdrawn {
            user: caller,
            amount: earnings,
            timestamp: self.env().get_block_time(),
        });
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
        let uploaded_samples = self.user_uploaded_samples.get_or_default(&user);
        let purchased_samples = self.user_purchased_samples.get_or_default(&user);

        UserStats {
            uploaded_count: uploaded_samples.len() as u64,
            purchased_count: purchased_samples.len() as u64,
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
        let samples = self.user_uploaded_samples.get_or_default(&user);
        samples.iter().collect()
    }

    /// Get user's purchased sample IDs
    pub fn get_user_purchases(&self, user: Address) -> Vec<u64> {
        let samples = self.user_purchased_samples.get_or_default(&user);
        samples.iter().collect()
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
        let sample_ids = self.user_uploaded_samples.get_or_default(&user);
        let mut result = Vec::new();

        for id in sample_ids.iter() {
            if let Some(sample) = self.samples.get(&id) {
                result.push(sample);
            }
        }

        result
    }

    /// Get full sample data for user's purchased samples
    pub fn get_user_purchases_full(&self, user: Address) -> Vec<Sample> {
        let sample_ids = self.user_purchased_samples.get_or_default(&user);
        let mut result = Vec::new();

        for id in sample_ids.iter() {
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

    /// Internal check if user has purchased a sample
    fn has_purchased_internal(&self, buyer: &Address, sample_id: u64) -> bool {
        self.user_purchase_records.get(&(*buyer, sample_id)).is_some()
    }
}

// ============================================
// Tests
// ============================================

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostEnv, NoArgs};

    fn setup() -> (SampledMarketplaceHostRef, HostEnv) {
        let env = odra_test::env();
        let admin = env.get_account(0);

        let init_args = SampledMarketplaceInitArgs { admin };
        let contract = SampledMarketplaceHostRef::deploy(&env, init_args);

        (contract, env)
    }

    #[test]
    fn test_upload_sample() {
        let (mut contract, env) = setup();
        let seller = env.get_account(1);
        env.set_caller(seller);

        contract.upload_sample(
            U512::from(1_000_000_000u64), // 1 CSPR
            "ipfs://QmTest123".to_string(),
            "Test Beat".to_string(),
            120,
            "Hip Hop".to_string(),
            "ipfs://QmCover123".to_string(),
            "".to_string(),
        );

        let sample = contract.get_sample(1).expect("Sample should exist");
        assert_eq!(sample.title, "Test Beat");
        assert_eq!(sample.seller, seller);
        assert!(sample.is_active);
    }

    #[test]
    fn test_purchase_sample() {
        let (mut contract, env) = setup();
        let seller = env.get_account(1);
        let buyer = env.get_account(2);

        // Upload sample
        env.set_caller(seller);
        contract.upload_sample(
            U512::from(1_000_000_000u64),
            "ipfs://QmTest123".to_string(),
            "Test Beat".to_string(),
            120,
            "Hip Hop".to_string(),
            "ipfs://QmCover123".to_string(),
            "".to_string(),
        );

        // Purchase sample
        env.set_caller(buyer);
        contract.with_tokens(U512::from(1_000_000_000u64)).purchase_sample(1);

        // Verify purchase
        assert!(contract.has_purchased(buyer, 1));

        // Verify seller earnings (90% of price)
        let earnings = contract.get_earnings(seller);
        assert_eq!(earnings, U512::from(900_000_000u64));
    }

    #[test]
    fn test_withdraw_earnings() {
        let (mut contract, env) = setup();
        let seller = env.get_account(1);
        let buyer = env.get_account(2);

        // Upload and purchase
        env.set_caller(seller);
        contract.upload_sample(
            U512::from(1_000_000_000u64),
            "ipfs://QmTest123".to_string(),
            "Test Beat".to_string(),
            120,
            "Hip Hop".to_string(),
            "ipfs://QmCover123".to_string(),
            "".to_string(),
        );

        env.set_caller(buyer);
        contract.with_tokens(U512::from(1_000_000_000u64)).purchase_sample(1);

        // Withdraw earnings
        env.set_caller(seller);
        contract.withdraw_earnings();

        // Verify earnings are now 0
        let earnings = contract.get_earnings(seller);
        assert_eq!(earnings, U512::zero());
    }

    #[test]
    fn test_deactivate_sample() {
        let (mut contract, env) = setup();
        let seller = env.get_account(1);

        env.set_caller(seller);
        contract.upload_sample(
            U512::from(1_000_000_000u64),
            "ipfs://QmTest123".to_string(),
            "Test Beat".to_string(),
            120,
            "Hip Hop".to_string(),
            "ipfs://QmCover123".to_string(),
            "".to_string(),
        );

        contract.deactivate_sample(1);

        let sample = contract.get_sample(1).expect("Sample should exist");
        assert!(!sample.is_active);
    }

    #[test]
    fn test_update_price() {
        let (mut contract, env) = setup();
        let seller = env.get_account(1);

        env.set_caller(seller);
        contract.upload_sample(
            U512::from(1_000_000_000u64),
            "ipfs://QmTest123".to_string(),
            "Test Beat".to_string(),
            120,
            "Hip Hop".to_string(),
            "ipfs://QmCover123".to_string(),
            "".to_string(),
        );

        contract.update_price(1, U512::from(2_000_000_000u64));

        let sample = contract.get_sample(1).expect("Sample should exist");
        assert_eq!(sample.price, U512::from(2_000_000_000u64));
    }
}
