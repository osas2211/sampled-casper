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
