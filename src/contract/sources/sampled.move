// sources/sampled_marketplace.move
// Sampled - Music Sample Marketplace on Movement

module sampled_addr::sampled_marketplace {
    use std::signer; 
    use std::string::{Self, String};
    use std::vector;
    use std::option::{Self, Option};
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_std::table::{Self, Table};

    // ============================================
    // Error Constants
    // ============================================
    
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_SAMPLE_NOT_FOUND: u64 = 3;
    const E_INSUFFICIENT_PAYMENT: u64 = 4;
    const E_NOT_SELLER: u64 = 5;
    const E_SAMPLE_INACTIVE: u64 = 6;
    const E_INVALID_PRICE: u64 = 7;
    const E_ALREADY_PURCHASED: u64 = 8;
    const E_NO_EARNINGS: u64 = 9;
    const E_SAMPLE_TITLE_EXISTS: u64 = 10;
    const E_TITLE_TOO_LONG: u64 = 11;
    const E_IPFS_LINK_TOO_LONG: u64 = 12;
    const E_COVER_IMAGE_TOO_LONG: u64 = 14;
    const E_GENRE_TOO_LONG: u64 = 13;

    // ============================================
    // Constants
    // ============================================
    
    const PLATFORM_FEE_NUMERATOR: u64 = 10;
    const PLATFORM_FEE_DENOMINATOR: u64 = 100;
    const MAX_TITLE_LENGTH: u64 = 100;
    const MAX_IPFS_LINK_LENGTH: u64 = 256;
    const MAX_COVER_IMAGE_LENGTH: u64 = 256;
    const MAX_GENRE_LENGTH: u64 = 30;
    const MAX_VIDEO_PREVIEW_LENGTH: u64 = 256;

    // ============================================
    // Data Structures
    // ============================================

    struct Sample has store, copy, drop {
        sample_id: u64,
        seller: address,
        price: u64,              // Price in octas (APT smallest unit)
        ipfs_link: String,       // IPFS link for audio file
        title: String,
        bpm: u64,
        genre: String,
        cover_image: String,     // IPFS link for cover image
        video_preview_link: String, // Optional IPFS link for video preview
        total_sales: u64,
        is_active: bool,
        created_at: u64,
    }

    struct Marketplace has key {
        samples: Table<u64, Sample>,
        sample_count: u64,
        total_volume: u64,
        platform_fee_collected: u64,
        admin: address,
        // Resource account for holding escrowed funds
        resource_addr: address,
        signer_cap: account::SignerCapability,

        // Event handles
        sample_uploaded_events: EventHandle<SampleUploadedEvent>,
        sample_purchased_events: EventHandle<SamplePurchasedEvent>,
        earnings_withdrawn_events: EventHandle<EarningsWithdrawnEvent>,
        sample_deactivated_events: EventHandle<SampleDeactivatedEvent>,
    }

    struct UserAccount has key {
        uploaded_samples: vector<u64>,    // IDs of samples uploaded
        purchased_samples: vector<u64>,   // IDs of samples purchased
        earnings: u64,                    // Earnings available for withdrawal
        total_earned: u64,
        total_spent: u64,
        purchase_history: Table<u64, PurchaseRecord>,
    }

    struct PurchaseRecord has store, drop {
        sample_id: u64,
        seller: address,
        price: u64,
        timestamp: u64,
        ipfs_link: String,
    }

    // ============================================
    // Events
    // ============================================

    struct SampleUploadedEvent has drop, store {
        sample_id: u64,
        seller: address,
        price: u64,
        title: String,
        ipfs_link: String,
        cover_image: String,
        timestamp: u64,
    }

    struct SamplePurchasedEvent has drop, store {
        sample_id: u64,
        buyer: address,
        seller: address,
        price: u64,
        platform_fee: u64,
        timestamp: u64,
    }

    struct EarningsWithdrawnEvent has drop, store {
        user: address,
        amount: u64,
        timestamp: u64,
    }

    struct SampleDeactivatedEvent has drop, store {
        sample_id: u64,
        seller: address,
        timestamp: u64,
    }

    // ============================================
    // Initialization
    // ============================================

    /// Initialize the marketplace (only admin can call)
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);

        // Ensure not already initialized
        assert!(!exists<Marketplace>(@sampled_addr), E_ALREADY_INITIALIZED);

        // Create resource account to hold escrowed funds
        let seed = b"sampled_escrow";
        let (resource_signer, signer_cap) = account::create_resource_account(admin, seed);
        let resource_addr = signer::address_of(&resource_signer);

        // Register the resource account to receive AptosCoin
        coin::register<AptosCoin>(&resource_signer);

        // Create marketplace resource
        move_to(admin, Marketplace {
            samples: table::new(),
            sample_count: 0,
            total_volume: 0,
            platform_fee_collected: 0,
            admin: admin_addr,
            resource_addr,
            signer_cap,
            sample_uploaded_events: account::new_event_handle<SampleUploadedEvent>(admin),
            sample_purchased_events: account::new_event_handle<SamplePurchasedEvent>(admin),
            earnings_withdrawn_events: account::new_event_handle<EarningsWithdrawnEvent>(admin),
            sample_deactivated_events: account::new_event_handle<SampleDeactivatedEvent>(admin),
        });
    }

    // ============================================
    // Core Functions
    // ============================================

    /// Upload a new sample to the marketplace
    public entry fun upload_sample(
        seller: &signer,
        price: u64,
        ipfs_link: String,
        title: String,
        bpm: u64,
        genre: String,
        cover_image: String,
        video_preview_link: String,
    ) acquires Marketplace, UserAccount {
        let seller_addr = signer::address_of(seller);

        // Validate inputs
        assert!(price > 0, E_INVALID_PRICE);
        assert!(string::length(&title) <= MAX_TITLE_LENGTH, E_TITLE_TOO_LONG);
        assert!(string::length(&ipfs_link) <= MAX_IPFS_LINK_LENGTH, E_IPFS_LINK_TOO_LONG);
        assert!(string::length(&genre) <= MAX_GENRE_LENGTH, E_GENRE_TOO_LONG);
        assert!(string::length(&cover_image) <= MAX_COVER_IMAGE_LENGTH, E_COVER_IMAGE_TOO_LONG);
        assert!(string::length(&video_preview_link) <= MAX_VIDEO_PREVIEW_LENGTH, E_COVER_IMAGE_TOO_LONG);

        // Get marketplace
        let marketplace = borrow_global_mut<Marketplace>(@sampled_addr);

        // Generate new sample ID
        let sample_id = marketplace.sample_count + 1;
        marketplace.sample_count = sample_id;

        // Create sample struct
        let sample = Sample {
            sample_id,
            seller: seller_addr,
            price,
            ipfs_link,
            title,
            bpm,
            genre,
            cover_image,
            video_preview_link,
            total_sales: 0,
            is_active: true,
            created_at: timestamp::now_seconds(),
        };
        
        // Add to marketplace
        table::add(&mut marketplace.samples, sample_id, sample);
        
        // Initialize or update user account
        if (!exists<UserAccount>(seller_addr)) {
            move_to(seller, UserAccount {
                uploaded_samples: vector::empty(),
                purchased_samples: vector::empty(),
                earnings: 0,
                total_earned: 0,
                total_spent: 0,
                purchase_history: table::new(),
            });
        };
        
        let user_account = borrow_global_mut<UserAccount>(seller_addr);
        vector::push_back(&mut user_account.uploaded_samples, sample_id);
        
        // Emit event
        event::emit_event(
            &mut marketplace.sample_uploaded_events,
            SampleUploadedEvent {
                sample_id,
                seller: seller_addr,
                price,
                title,
                ipfs_link,
                cover_image,
                timestamp: timestamp::now_seconds(),
            },
        );
    }

    /// Purchase a sample from the marketplace
    public entry fun purchase_sample(
        buyer: &signer,
        sample_id: u64,
    ) acquires Marketplace, UserAccount {
        let buyer_addr = signer::address_of(buyer);
        
        // Get marketplace
        let marketplace = borrow_global_mut<Marketplace>(@sampled_addr);
        
        // Get sample
        assert!(table::contains(&marketplace.samples, sample_id), E_SAMPLE_NOT_FOUND);
        let sample = table::borrow_mut(&mut marketplace.samples, sample_id);
        
        // Validate sample is active
        assert!(sample.is_active, E_SAMPLE_INACTIVE);
        
        // Calculate fees
        let platform_fee = (sample.price * PLATFORM_FEE_NUMERATOR) / PLATFORM_FEE_DENOMINATOR;
        let seller_amount = sample.price - platform_fee;

        // Transfer seller's earnings to resource account (escrow)
        coin::transfer<AptosCoin>(buyer, marketplace.resource_addr, seller_amount);

        // Transfer platform fee to admin
        coin::transfer<AptosCoin>(buyer, marketplace.admin, platform_fee);
        
        // Update sample stats
        sample.total_sales = sample.total_sales + 1;
        
        // Update marketplace stats
        marketplace.total_volume = marketplace.total_volume + sample.price;
        marketplace.platform_fee_collected = marketplace.platform_fee_collected + platform_fee;
        
        // Initialize buyer account if needed
        if (!exists<UserAccount>(buyer_addr)) {
            move_to(buyer, UserAccount {
                uploaded_samples: vector::empty(),
                purchased_samples: vector::empty(),
                earnings: 0,
                total_earned: 0,
                total_spent: 0,
                purchase_history: table::new(),
            });
        };
        
        // Update buyer account
        let buyer_account = borrow_global_mut<UserAccount>(buyer_addr);
        vector::push_back(&mut buyer_account.purchased_samples, sample_id);
        buyer_account.total_spent = buyer_account.total_spent + sample.price;
        
        // Add purchase record
        let purchase_record = PurchaseRecord {
            sample_id,
            seller: sample.seller,
            price: sample.price,
            timestamp: timestamp::now_seconds(),
            ipfs_link: sample.ipfs_link,
        };
        table::add(&mut buyer_account.purchase_history, sample_id, purchase_record);
        
        // Update seller earnings
        if (exists<UserAccount>(sample.seller)) {
            let seller_account = borrow_global_mut<UserAccount>(sample.seller);
            seller_account.earnings = seller_account.earnings + seller_amount;
            seller_account.total_earned = seller_account.total_earned + seller_amount;
        };
        
        // Emit event
        event::emit_event(
            &mut marketplace.sample_purchased_events,
            SamplePurchasedEvent {
                sample_id,
                buyer: buyer_addr,
                seller: sample.seller,
                price: sample.price,
                platform_fee,
                timestamp: timestamp::now_seconds(),
            },
        );
    }

    /// Update the price of a sample
    public entry fun update_price(
        seller: &signer,
        sample_id: u64,
        new_price: u64,
    ) acquires Marketplace {
        let seller_addr = signer::address_of(seller);
        
        // Validate new price
        assert!(new_price > 0, E_INVALID_PRICE);
        
        // Get marketplace
        let marketplace = borrow_global_mut<Marketplace>(@sampled_addr);
        
        // Get sample and verify ownership
        assert!(table::contains(&marketplace.samples, sample_id), E_SAMPLE_NOT_FOUND);
        let sample = table::borrow_mut(&mut marketplace.samples, sample_id);
        assert!(sample.seller == seller_addr, E_NOT_SELLER);
        
        // Update price
        sample.price = new_price;
    }

    /// Deactivate a sample (soft delete)
    public entry fun deactivate_sample(
        seller: &signer,
        sample_id: u64,
    ) acquires Marketplace {
        let seller_addr = signer::address_of(seller);
        
        // Get marketplace
        let marketplace = borrow_global_mut<Marketplace>(@sampled_addr);
        
        // Get sample and verify ownership
        assert!(table::contains(&marketplace.samples, sample_id), E_SAMPLE_NOT_FOUND);
        let sample = table::borrow_mut(&mut marketplace.samples, sample_id);
        assert!(sample.seller == seller_addr, E_NOT_SELLER);
        
        // Deactivate
        sample.is_active = false;
        
        // Emit event
        event::emit_event(
            &mut marketplace.sample_deactivated_events,
            SampleDeactivatedEvent {
                sample_id,
                seller: seller_addr,
                timestamp: timestamp::now_seconds(),
            },
        );
    }

    /// Withdraw accumulated earnings
    public entry fun withdraw_earnings(
        user: &signer,
    ) acquires UserAccount, Marketplace {
        let user_addr = signer::address_of(user);

        // Check user has account
        assert!(exists<UserAccount>(user_addr), E_NOT_INITIALIZED);

        // Get user account
        let user_account = borrow_global_mut<UserAccount>(user_addr);

        // Check earnings
        assert!(user_account.earnings > 0, E_NO_EARNINGS);

        let amount = user_account.earnings;
        user_account.earnings = 0;

        // Get marketplace to access signer capability
        let marketplace = borrow_global<Marketplace>(@sampled_addr);

        // Create signer from capability to transfer from escrow
        let resource_signer = account::create_signer_with_capability(&marketplace.signer_cap);

        // Transfer earnings from escrow to user
        coin::transfer<AptosCoin>(&resource_signer, user_addr, amount);

        // Get mutable marketplace for events
        let marketplace_mut = borrow_global_mut<Marketplace>(@sampled_addr);

        // Emit event
        event::emit_event(
            &mut marketplace_mut.earnings_withdrawn_events,
            EarningsWithdrawnEvent {
                user: user_addr,
                amount,
                timestamp: timestamp::now_seconds(),
            },
        );
    }

    // ============================================
    // View Functions
    // ============================================

    #[view]
    /// Get sample details
    public fun get_sample(sample_id: u64): Sample acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(@sampled_addr);
        assert!(table::contains(&marketplace.samples, sample_id), E_SAMPLE_NOT_FOUND);
        *table::borrow(&marketplace.samples, sample_id)
    }

    #[view]
    /// Get user statistics
    public fun get_user_stats(user_addr: address): (u64, u64, u64, u64, u64) acquires UserAccount {
        if (!exists<UserAccount>(user_addr)) {
            return (0, 0, 0, 0, 0)
        };
        
        let account = borrow_global<UserAccount>(user_addr);
        (
            vector::length(&account.uploaded_samples),
            vector::length(&account.purchased_samples),
            account.earnings,
            account.total_earned,
            account.total_spent,
        )
    }

    #[view]
    /// Get marketplace statistics
    public fun get_marketplace_stats(): (u64, u64, u64) acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(@sampled_addr);
        (
            marketplace.sample_count,
            marketplace.total_volume,
            marketplace.platform_fee_collected,
        )
    }

    #[view]
    /// Check if user has purchased a specific sample
    public fun has_purchased(buyer_addr: address, sample_id: u64): bool acquires UserAccount {
        if (!exists<UserAccount>(buyer_addr)) {
            return false
        };
        
        let account = borrow_global<UserAccount>(buyer_addr);
        vector::contains(&account.purchased_samples, &sample_id)
    }

    #[view]
    /// Get user's uploaded samples
    public fun get_user_samples(user_addr: address): vector<u64> acquires UserAccount {
        if (!exists<UserAccount>(user_addr)) {
            return vector::empty()
        };
        
        let account = borrow_global<UserAccount>(user_addr);
        account.uploaded_samples
    }

    #[view]
    /// Get user's purchased samples
    public fun get_user_purchases(user_addr: address): vector<u64> acquires UserAccount {
        if (!exists<UserAccount>(user_addr)) {
            return vector::empty()
        };
        
        let account = borrow_global<UserAccount>(user_addr);
        account.purchased_samples
    }

    #[view]
    /// Get user's available earnings
    public fun get_earnings(user_addr: address): u64 acquires UserAccount {
        if (!exists<UserAccount>(user_addr)) {
            return 0
        };

        let account = borrow_global<UserAccount>(user_addr);
        account.earnings
    }

    #[view]
    /// Get all active samples in the marketplace
    public fun get_all_samples(): vector<Sample> acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(@sampled_addr);
        let result = vector::empty<Sample>();
        let i = 1u64;

        while (i <= marketplace.sample_count) {
            if (table::contains(&marketplace.samples, i)) {
                let sample = *table::borrow(&marketplace.samples, i);
                if (sample.is_active) {
                    vector::push_back(&mut result, sample);
                };
            };
            i = i + 1;
        };

        result
    }

    #[view]
    /// Get full sample data for user's uploaded samples
    public fun get_user_samples_full(user_addr: address): vector<Sample> acquires UserAccount, Marketplace {
        if (!exists<UserAccount>(user_addr)) {
            return vector::empty()
        };

        let account = borrow_global<UserAccount>(user_addr);
        let marketplace = borrow_global<Marketplace>(@sampled_addr);
        let result = vector::empty<Sample>();
        let len = vector::length(&account.uploaded_samples);
        let i = 0u64;

        while (i < len) {
            let sample_id = *vector::borrow(&account.uploaded_samples, i);
            if (table::contains(&marketplace.samples, sample_id)) {
                let sample = *table::borrow(&marketplace.samples, sample_id);
                vector::push_back(&mut result, sample);
            };
            i = i + 1;
        };

        result
    }

    #[view]
    /// Get full sample data for user's purchased samples
    public fun get_user_purchases_full(user_addr: address): vector<Sample> acquires UserAccount, Marketplace {
        if (!exists<UserAccount>(user_addr)) {
            return vector::empty()
        };

        let account = borrow_global<UserAccount>(user_addr);
        let marketplace = borrow_global<Marketplace>(@sampled_addr);
        let result = vector::empty<Sample>();
        let len = vector::length(&account.purchased_samples);
        let i = 0u64;

        while (i < len) {
            let sample_id = *vector::borrow(&account.purchased_samples, i);
            if (table::contains(&marketplace.samples, sample_id)) {
                let sample = *table::borrow(&marketplace.samples, sample_id);
                vector::push_back(&mut result, sample);
            };
            i = i + 1;
        };

        result
    }

    // ============================================
    // Test Functions (only for testing)
    // ============================================

    #[test_only]
    public fun init_for_test(admin: &signer) {
        initialize(admin);
    }

    #[test_only]
    public fun get_sample_count(): u64 acquires Marketplace {
        let marketplace = borrow_global<Marketplace>(@sampled_addr);
        marketplace.sample_count
    }
}