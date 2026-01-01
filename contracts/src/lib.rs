//! Sampled Marketplace - Music Sample Marketplace on Casper Network
//!
//! This contract allows music producers to:
//! - Upload samples with IPFS links and metadata
//! - Purchase samples from other producers
//! - Withdraw accumulated earnings
//!
//! Built with Odra framework for Casper Network.

#![cfg_attr(target_arch = "wasm32", no_std)]
#![cfg_attr(target_arch = "wasm32", no_main)]

extern crate alloc;

pub mod errors;
pub mod events;
pub mod types;
pub mod sampled_marketplace;

pub use sampled_marketplace::SampledMarketplace;
