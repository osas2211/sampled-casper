//! Data type definitions for Sampled Marketplace

use odra::prelude::*;
use odra::casper_types::U512;
use odra::Address;

/// Represents a music sample listed on the marketplace
#[odra::odra_type]
#[derive(Default)]
pub struct Sample {
    /// Unique identifier for this sample
    pub sample_id: u64,
    /// Address of the seller who uploaded this sample
    pub seller: Address,
    /// Price in motes (1 CSPR = 10^9 motes)
    pub price: U512,
    /// IPFS link to the audio file
    pub ipfs_link: String,
    /// Title of the sample
    pub title: String,
    /// Beats per minute
    pub bpm: u64,
    /// Music genre (e.g., "Hip Hop", "Electronic")
    pub genre: String,
    /// IPFS link to the cover image
    pub cover_image: String,
    /// Optional IPFS link to video preview
    pub video_preview_link: String,
    /// Total number of times this sample has been sold
    pub total_sales: u64,
    /// Whether this sample is available for purchase
    pub is_active: bool,
    /// Unix timestamp when the sample was created
    pub created_at: u64,
}

/// Record of a purchase made by a user
#[odra::odra_type]
#[derive(Default)]
pub struct PurchaseRecord {
    /// ID of the purchased sample
    pub sample_id: u64,
    /// Address of the seller
    pub seller: Address,
    /// Price paid for the sample
    pub price: U512,
    /// Timestamp of the purchase
    pub timestamp: u64,
    /// IPFS link to access the purchased content
    pub ipfs_link: String,
}

/// User statistics
#[odra::odra_type]
#[derive(Default)]
pub struct UserStats {
    /// Number of samples uploaded by this user
    pub uploaded_count: u64,
    /// Number of samples purchased by this user
    pub purchased_count: u64,
    /// Current available earnings (not yet withdrawn)
    pub earnings: U512,
    /// Total amount ever earned
    pub total_earned: U512,
    /// Total amount ever spent on purchases
    pub total_spent: U512,
}

/// Marketplace statistics
#[odra::odra_type]
#[derive(Default)]
pub struct MarketplaceStats {
    /// Total number of samples listed
    pub sample_count: u64,
    /// Total trading volume in motes
    pub total_volume: U512,
    /// Total platform fees collected
    pub platform_fee_collected: U512,
}

/// Constants for validation
pub mod constants {
    /// Maximum length for sample titles
    pub const MAX_TITLE_LENGTH: usize = 100;
    /// Maximum length for IPFS links
    pub const MAX_IPFS_LINK_LENGTH: usize = 256;
    /// Maximum length for cover image URLs
    pub const MAX_COVER_IMAGE_LENGTH: usize = 256;
    /// Maximum length for genre strings
    pub const MAX_GENRE_LENGTH: usize = 30;
    /// Maximum length for video preview links
    pub const MAX_VIDEO_PREVIEW_LENGTH: usize = 256;
    /// Platform fee: 10% (numerator)
    pub const PLATFORM_FEE_NUMERATOR: u64 = 10;
    /// Platform fee: 100 (denominator)
    pub const PLATFORM_FEE_DENOMINATOR: u64 = 100;
}
