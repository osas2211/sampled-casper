//! License type definitions for Sampled Marketplace NFT License System
//!
//! This module defines the license types, pricing structures, and metadata
//! for the NFT-based licensing system.

use odra::prelude::*;
use odra::casper_types::U512;

/// License types representing different usage rights
#[odra::odra_type]
#[derive(Default, Copy)]
pub enum LicenseType {
    /// Personal use only - demos, personal projects, non-commercial
    #[default]
    Personal = 0,
    /// Commercial use - releases, keep 100% of royalties
    Commercial = 1,
    /// Broadcast use - TV, radio, streaming platforms, advertisements
    Broadcast = 2,
    /// Exclusive rights - sample removed from marketplace after purchase
    Exclusive = 3,
}

impl LicenseType {
    /// Convert from u8 to LicenseType
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(LicenseType::Personal),
            1 => Some(LicenseType::Commercial),
            2 => Some(LicenseType::Broadcast),
            3 => Some(LicenseType::Exclusive),
            _ => None,
        }
    }

    /// Convert LicenseType to u8
    pub fn to_u8(&self) -> u8 {
        match self {
            LicenseType::Personal => 0,
            LicenseType::Commercial => 1,
            LicenseType::Broadcast => 2,
            LicenseType::Exclusive => 3,
        }
    }
}

/// Pricing multipliers for each license type
/// Values are percentages where 100 = 1x base price
#[odra::odra_type]
#[derive(Default)]
pub struct LicensePricing {
    /// Multiplier for personal license (default: 100 = 1x)
    pub personal_multiplier: u64,
    /// Multiplier for commercial license (default: 250 = 2.5x)
    pub commercial_multiplier: u64,
    /// Multiplier for broadcast license (default: 500 = 5x)
    pub broadcast_multiplier: u64,
    /// Multiplier for exclusive license (default: 2000 = 20x)
    pub exclusive_multiplier: u64,
}

impl LicensePricing {
    /// Create default pricing multipliers
    pub fn default_pricing() -> Self {
        Self {
            personal_multiplier: 100,    // 1x
            commercial_multiplier: 250,  // 2.5x
            broadcast_multiplier: 500,   // 5x
            exclusive_multiplier: 2000,  // 20x
        }
    }

    /// Get the multiplier for a specific license type
    pub fn get_multiplier(&self, license_type: &LicenseType) -> u64 {
        match license_type {
            LicenseType::Personal => self.personal_multiplier,
            LicenseType::Commercial => self.commercial_multiplier,
            LicenseType::Broadcast => self.broadcast_multiplier,
            LicenseType::Exclusive => self.exclusive_multiplier,
        }
    }

    /// Calculate the price for a license type given the base price
    pub fn calculate_price(&self, base_price: U512, license_type: &LicenseType) -> U512 {
        let multiplier = self.get_multiplier(license_type);
        base_price * multiplier / 100
    }
}

/// Metadata for a license NFT
#[odra::odra_type]
pub struct LicenseMetadata {
    /// Unique identifier for this license
    pub license_id: u64,
    /// ID of the sample this license is for
    pub sample_id: u64,
    /// Type of license (Personal, Commercial, Broadcast, Exclusive)
    pub license_type: LicenseType,
    /// Address of the original sample creator (receives royalties on resale)
    pub original_creator: Address,
    /// Current owner of this license NFT
    pub current_owner: Address,
    /// Price paid when this license was first purchased
    pub purchase_price: U512,
    /// Timestamp when the license was purchased
    pub purchase_timestamp: u64,
    /// Whether this license is active (can be transferred)
    pub is_active: bool,
    /// Number of times this license has been transferred
    pub transfer_count: u64,
}

/// Record of a royalty payment made during license transfer
#[odra::odra_type]
pub struct RoyaltyPayment {
    /// ID of the license that was transferred
    pub license_id: u64,
    /// Address of the seller (previous owner)
    pub from: Address,
    /// Address of the buyer (new owner)
    pub to: Address,
    /// Sale price of the transfer
    pub sale_price: U512,
    /// Royalty amount paid to the original creator
    pub creator_royalty: U512,
    /// Platform fee on the resale
    pub platform_fee: U512,
    /// Original creator who received the royalty
    pub creator: Address,
    /// Timestamp of the transfer
    pub timestamp: u64,
}

/// Summary of licenses for a sample
#[odra::odra_type]
#[derive(Default)]
pub struct SampleLicenseInfo {
    /// Total number of licenses issued for this sample
    pub total_licenses: u64,
    /// Number of personal licenses issued
    pub personal_count: u64,
    /// Number of commercial licenses issued
    pub commercial_count: u64,
    /// Number of broadcast licenses issued
    pub broadcast_count: u64,
    /// Whether an exclusive license has been issued
    pub has_exclusive: bool,
    /// Address of exclusive license holder (if any)
    pub exclusive_holder: Option<Address>,
}

/// All license prices for a sample (for view function return)
#[odra::odra_type]
#[derive(Default)]
pub struct AllLicensePrices {
    /// Personal license price
    pub personal: U512,
    /// Commercial license price
    pub commercial: U512,
    /// Broadcast license price
    pub broadcast: U512,
    /// Exclusive license price
    pub exclusive: U512,
}

/// Constants for license system
pub mod constants {
    /// Royalty percentage for original creator on resales (10%)
    pub const CREATOR_ROYALTY_PERCENT: u64 = 10;
    /// Platform fee percentage on resales (2%)
    pub const RESALE_PLATFORM_FEE_PERCENT: u64 = 2;
    /// Default personal license multiplier (1x)
    pub const DEFAULT_PERSONAL_MULT: u64 = 100;
    /// Default commercial license multiplier (2.5x)
    pub const DEFAULT_COMMERCIAL_MULT: u64 = 250;
    /// Default broadcast license multiplier (5x)
    pub const DEFAULT_BROADCAST_MULT: u64 = 500;
    /// Default exclusive license multiplier (20x)
    pub const DEFAULT_EXCLUSIVE_MULT: u64 = 2000;
    /// Multiplier denominator (for calculating prices)
    pub const MULTIPLIER_DENOMINATOR: u64 = 100;
}
