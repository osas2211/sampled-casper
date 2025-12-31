//! Error definitions for Sampled Marketplace

use odra::OdraError;

/// Custom errors for the Sampled Marketplace contract
#[derive(OdraError)]
pub enum Error {
    /// Contract has already been initialized
    #[odra(msg = "Contract already initialized")]
    AlreadyInitialized = 1,

    /// Sample with given ID was not found
    #[odra(msg = "Sample not found")]
    SampleNotFound = 2,

    /// Insufficient payment for purchase
    #[odra(msg = "Insufficient payment")]
    InsufficientPayment = 3,

    /// Caller is not the seller of this sample
    #[odra(msg = "Not the seller")]
    NotSeller = 4,

    /// Sample is not active (deactivated)
    #[odra(msg = "Sample is inactive")]
    SampleInactive = 5,

    /// Invalid price (must be greater than 0)
    #[odra(msg = "Invalid price")]
    InvalidPrice = 6,

    /// User has already purchased this sample
    #[odra(msg = "Already purchased")]
    AlreadyPurchased = 7,

    /// No earnings available to withdraw
    #[odra(msg = "No earnings to withdraw")]
    NoEarnings = 8,

    /// Title exceeds maximum length
    #[odra(msg = "Title too long")]
    TitleTooLong = 9,

    /// IPFS link exceeds maximum length
    #[odra(msg = "IPFS link too long")]
    IpfsLinkTooLong = 10,

    /// Genre exceeds maximum length
    #[odra(msg = "Genre too long")]
    GenreTooLong = 11,

    /// Cover image URL exceeds maximum length
    #[odra(msg = "Cover image URL too long")]
    CoverImageTooLong = 12,

    /// Video preview link exceeds maximum length
    #[odra(msg = "Video preview link too long")]
    VideoPreviewTooLong = 13,

    /// Caller is not authorized (not admin)
    #[odra(msg = "Unauthorized")]
    Unauthorized = 14,

    /// Transfer failed
    #[odra(msg = "Transfer failed")]
    TransferFailed = 15,
}
