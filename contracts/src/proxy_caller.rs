//! Proxy Caller for Odra Payable Functions
//!
//! This module provides a session code entry point that enables calling
//! Odra payable functions from an account by:
//! 1. Creating a cargo purse
//! 2. Funding it from the caller's main purse
//! 3. Calling the target contract with the cargo_purse argument

#![no_std]
#![no_main]

extern crate alloc;

use alloc::string::String;
use casper_contract::{
    contract_api::{account, runtime, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    bytesrepr::{Bytes, FromBytes},
    ContractPackageHash, RuntimeArgs, URef, U512,
};

/// Entry point name for the proxy caller
const CARGO_PURSE_ARG: &str = "cargo_purse";

/// Main entry point for proxy caller
#[no_mangle]
pub extern "C" fn call() {
    // Get the contract package hash to call
    let contract_package_hash: ContractPackageHash =
        runtime::get_named_arg("contract_package_hash");

    // Get the entry point to call
    let entry_point: String = runtime::get_named_arg("entry_point");

    // Get the serialized args for the actual function call
    let args_bytes: Bytes = runtime::get_named_arg("args");

    // Get the amount of CSPR to attach
    let attached_value: U512 = runtime::get_named_arg("attached_value");

    // Deserialize the args
    let (mut call_args, _): (RuntimeArgs, _) =
        RuntimeArgs::from_bytes(&args_bytes).unwrap_or_revert();

    // If there's value to attach, create and fund a cargo purse
    if attached_value > U512::zero() {
        // Create a new purse
        let cargo_purse: URef = system::create_purse();

        // Get the caller's main purse and transfer to cargo purse
        let main_purse = account::get_main_purse();
        system::transfer_from_purse_to_purse(
            main_purse,
            cargo_purse,
            attached_value,
            None,
        )
        .unwrap_or_revert();

        // Add cargo_purse to the call args
        call_args.insert(CARGO_PURSE_ARG, cargo_purse).unwrap_or_revert();
    }

    // Call the contract
    runtime::call_versioned_contract::<()>(
        contract_package_hash,
        None, // Use latest version
        &entry_point,
        call_args,
    );
}
