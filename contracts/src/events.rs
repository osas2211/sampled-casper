//! Event definitions for Sampled Marketplace
//!
//! Events are emitted for important state changes and can be
//! indexed by off-chain services.

use odra::prelude::*;
use odra::casper_types::U512;

/// Emitted when a new sample is uploaded to the marketplace
#[odra::event]
pub struct SampleUploaded {
    /// Unique identifier of the sample
    pub sample_id: u64,
    /// Address of the seller
    pub seller: Address,
    /// Price in motes (1 CSPR = 10^9 motes)
    pub price: U512,
    /// Title of the sample
    pub title: String,
    /// IPFS link to the audio file
    pub ipfs_link: String,
    /// IPFS link to the cover image
    pub cover_image: String,
    /// Timestamp when the sample was uploaded
    pub timestamp: u64,
}

/// Emitted when a sample is purchased
#[odra::event]
pub struct SamplePurchased {
    /// Unique identifier of the sample
    pub sample_id: u64,
    /// Address of the buyer
    pub buyer: Address,
    /// Address of the seller
    pub seller: Address,
    /// Total price paid
    pub price: U512,
    /// Platform fee deducted
    pub platform_fee: U512,
    /// Timestamp of the purchase
    pub timestamp: u64,
}

/// Emitted when a seller withdraws their earnings
#[odra::event]
pub struct EarningsWithdrawn {
    /// Address of the user withdrawing
    pub user: Address,
    /// Amount withdrawn in motes
    pub amount: U512,
    /// Timestamp of the withdrawal
    pub timestamp: u64,
}

/// Emitted when a sample is deactivated
#[odra::event]
pub struct SampleDeactivated {
    /// Unique identifier of the sample
    pub sample_id: u64,
    /// Address of the seller who deactivated it
    pub seller: Address,
    /// Timestamp when the sample was deactivated
    pub timestamp: u64,
}

/// Emitted when a sample's price is updated
#[odra::event]
pub struct PriceUpdated {
    /// Unique identifier of the sample
    pub sample_id: u64,
    /// Old price in motes
    pub old_price: U512,
    /// New price in motes
    pub new_price: U512,
    /// Timestamp of the update
    pub timestamp: u64,
}

// ============================================
// License NFT Events
// ============================================

/// Emitted when a new license NFT is minted
#[odra::event]
pub struct LicenseMinted {
    /// Unique identifier of the license
    pub license_id: u64,
    /// ID of the sample this license is for
    pub sample_id: u64,
    /// Type of license (0=Personal, 1=Commercial, 2=Broadcast, 3=Exclusive)
    pub license_type: u8,
    /// Address of the buyer who purchased the license
    pub buyer: Address,
    /// Address of the original sample creator
    pub creator: Address,
    /// Price paid for the license
    pub price: U512,
    /// Timestamp of the purchase
    pub timestamp: u64,
}

/// Emitted when a license NFT is transferred
#[odra::event]
pub struct LicenseTransferred {
    /// Unique identifier of the license
    pub license_id: u64,
    /// Address of the previous owner (seller)
    pub from: Address,
    /// Address of the new owner (buyer)
    pub to: Address,
    /// Sale price of the transfer
    pub sale_price: U512,
    /// Royalty amount paid to the original creator
    pub creator_royalty: U512,
    /// Platform fee on the resale
    pub platform_fee: U512,
    /// Timestamp of the transfer
    pub timestamp: u64,
}

/// Emitted when royalties are paid to a creator
#[odra::event]
pub struct RoyaltyPaid {
    /// ID of the license that was transferred
    pub license_id: u64,
    /// Address of the creator receiving royalties
    pub creator: Address,
    /// Amount paid
    pub amount: U512,
    /// Timestamp of the payment
    pub timestamp: u64,
}

/// Emitted when royalties are withdrawn by a creator
#[odra::event]
pub struct RoyaltiesWithdrawn {
    /// Address of the creator withdrawing
    pub creator: Address,
    /// Amount withdrawn
    pub amount: U512,
    /// Timestamp of the withdrawal
    pub timestamp: u64,
}

/// Emitted when an exclusive license is activated for a sample
#[odra::event]
pub struct ExclusiveLicenseActivated {
    /// ID of the sample that is now exclusively licensed
    pub sample_id: u64,
    /// ID of the exclusive license
    pub license_id: u64,
    /// Address of the exclusive license holder
    pub holder: Address,
    /// Timestamp when exclusivity was activated
    pub timestamp: u64,
}

/// Emitted when license pricing is updated for a sample
#[odra::event]
pub struct LicensePricingUpdated {
    /// ID of the sample
    pub sample_id: u64,
    /// Personal license multiplier (100 = 1x)
    pub personal_mult: u64,
    /// Commercial license multiplier
    pub commercial_mult: u64,
    /// Broadcast license multiplier
    pub broadcast_mult: u64,
    /// Exclusive license multiplier
    pub exclusive_mult: u64,
    /// Timestamp of the update
    pub timestamp: u64,
}
