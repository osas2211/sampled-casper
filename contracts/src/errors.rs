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

    // ============================================
    // License NFT Errors (20-39)
    // ============================================

    /// License with given ID was not found
    LicenseNotFound = 20,
    /// Caller is not the owner of this license
    NotLicenseOwner = 21,
    /// Invalid license type provided
    InvalidLicenseType = 22,
    /// Sample already has an exclusive license
    SampleExclusivelyLicensed = 23,
    /// User already has this type of license for this sample
    AlreadyHasLicenseType = 24,
    /// Insufficient payment for royalties on transfer
    InsufficientRoyaltyPayment = 25,
    /// Exclusive licenses cannot be transferred
    CannotTransferExclusiveLicense = 26,
    /// No royalties available to withdraw
    NoRoyaltiesToWithdraw = 27,
    /// Invalid pricing multiplier (must be > 0)
    InvalidPricingMultiplier = 28,
    /// License is not active
    LicenseInactive = 29,
    /// Cannot purchase license for own sample
    CannotPurchaseOwnSample = 30,
    /// License NFT contract not set
    LicenseContractNotSet = 31,
}
