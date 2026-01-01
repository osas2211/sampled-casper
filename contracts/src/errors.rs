//! Error definitions for Sampled Marketplace

use odra::prelude::*;

/// Custom errors for the Sampled Marketplace contract
#[odra::odra_error]
pub enum Error {
    /// Contract has already been initialized
    AlreadyInitialized = 1,
    /// Sample with given ID was not found
    SampleNotFound = 2,
    /// Insufficient payment for purchase
    InsufficientPayment = 3,
    /// Caller is not the seller of this sample
    NotSeller = 4,
    /// Sample is not active (deactivated)
    SampleInactive = 5,
    /// Invalid price (must be greater than 0)
    InvalidPrice = 6,
    /// User has already purchased this sample
    AlreadyPurchased = 7,
    /// No earnings available to withdraw
    NoEarnings = 8,
    /// Title exceeds maximum length
    TitleTooLong = 9,
    /// IPFS link exceeds maximum length
    IpfsLinkTooLong = 10,
    /// Genre exceeds maximum length
    GenreTooLong = 11,
    /// Cover image URL exceeds maximum length
    CoverImageTooLong = 12,
    /// Video preview link exceeds maximum length
    VideoPreviewTooLong = 13,
    /// Caller is not authorized (not admin)
    Unauthorized = 14,
    /// Transfer failed
    TransferFailed = 15,
}
