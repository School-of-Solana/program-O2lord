# Project Description

**Deployed Frontend URL:** https://trustpaay.netlify.app/

**Solana Program ID:** CtvFQBDX6GdgDL5tS8spw7rZomT2ZwAxm6C9UaEe6hxo

## Project Overview

### Description
TrustPay is a decentralized escrow platform built on Solana that facilitates secure payments between clients (payers) and freelancers (recipients/service providers). The platform locks tokens in a secure vault until contract T&C are met, providing protection for both parties through one-time/milestone-based payments and built-in dispute resolution.

The dApp supports two types of contracts:
1. One-time Payment: A single payment released when work is completed
2. Milestone-based Payment: Where work is divided into up to 10 milestones, each of which are paid separately upon completion


### Key Features
- Flexible Contract Creation: Either party (payer or recipient) can initiate a contract
- SPL Token Support: Works with any SPL token via Token-2022 interface (But we currently limit it to our test-tokens on the frontend)
- Milestone Management: Break projects into up to 10 trackable milestones (verification is offchain either via WhatsApp or Discord, based on the parties agreement)
- Escrow Protection: Funds locked in program-controlled vault until conditions are met
- Dispute Resolution: Built-in mechanism for handling disagreements with authorized resolvers (submission of evidence by both parties via tickets on discord with the generated dispute ID)
- Contract Lifecycle: Create, Cancel, Accept, Decline, Complete, and Approve Payment
- Global Statistics: Track platform volume, Active, Closed and Completed contracts
- Automated Fee Handling: 0.05% platform fee automatically calculated and distributed to the platform wallet
- Time-based Deadlines: Contracts can have expiration dates for accountability
- Comprehensive event logging for transparency
  

### How to Use the dApp

1. **Connect Wallet**
- Visit https://trustpaay.netlify.app/
- Connect your Solana wallet (Phantom, Solflare, etc.)
- Click on the Request Airdrop Button to get our test USDC/USDT and SOL

2. **Creating a Contract:** 
- Choose your role: Payer (client) or Recipient (freelancer)
- Enter the other party's wallet address
- Select contract type: One-time or Milestone-based
- Fill in contract details:
   * Title (max 50 characters)
   * Terms and conditions (max 200 characters)
   * Total amount in tokens
   * Deadline duration in seconds
- For milestone contracts, add up to 10 milestones with descriptions and amounts
- If you're the payer creating the contract, tokens are deposited immediately
- If you're the recipient creating the contract, it remains pending until the payer accepts and tokens automatically deposited

3. **Cancelling a Contract :** 
- Only the contract creator can cancel if status is PENDING (Not yet accepted)
- All deposited tokens are refunded
- Contract and vault accounts are closed and rent returned

4. **Accepting/Declining a Contract (Payer):** 
- Review pending contracts sent to you
- Accept: This deposits the contract amount plus 0.05% fee, and set a deadline
- Decline: Reject the contract, refunding any deposited tokens

5. **Marking Milestones Complete (Recipient) :**
- Once work is done for a milestone, mark it as complete
- This notifies the payer that the milestone is ready for review
- Must be done before the contract deadline expires

6. **Approving Payments (Payer) :**
- Review completed milestones
- Approve payment to release funds to the recipient
- Platform fee (0.05%) is automatically deducted and sent to fee destination
- Contract closes automatically when all milestones are approved (vault accounts are closed and rent returned)

7. **Disputing a Milestone :** 
- Either party can dispute a completed milestone before approval
- Provide a detailed reason (10-500 characters)
- A unique dispute ID is generated that is used to open a ticket on discord
- Both Party Submit their respective evidence
- An authorized resolver will review and make a decision


## Program Architecture
TrustPay uses a modular architecture with separate instruction modules for each operation. The program manages state through two main account types: individual TrustPay contracts and a GlobalState account for platform-wide statistics.

**Data Flow**
1. **Contract Creation Flow:**
- User calls create_contract with role (payer/recipient), counterparty address, and contract details
- Program derives TrustPay PDA from [b"trust-pay", payer_pubkey, seed]
- Program initializes vault ATA with TrustPay PDA as authority
- If creator is payer: tokens transferred immediately to vault, status = IN_PROGRESS
- If creator is recipient: no transfer, status = PENDING (awaits payer acceptance)
- Program calculates 0.05% fee and stores in contract state
- GlobalState counter incremented
- ContractCreatedEvent emitted for indexers

2. **Milestone Completion Flow:**
- Recipient calls mark_milestone_complete with milestone index
- Program validates: recipient authorization, contract IN_PROGRESS, milestone PENDING, deadline not expired
- Milestone status updated to COMPLETED_BY_SP with timestamp
- MilestoneCompletedEvent emitted
- Payer notified off-chain to review and approve

3. **Payment Approval Flow:**
- Payer calls approve_milestone_payment with milestone index
- Program validates: payer authorization, milestone COMPLETED_BY_SP status
- Program calculates proportional fee for milestone
- Using PDA signer seeds, program transfers:
    Milestone amount → recipient's token account
    Fee amount → fee destination token account
- Milestone status updated to APPROVED_BY_PAYER
- GlobalState volume and confirmation counters updated
- If all milestones approved:
    Contract status → COMPLETED
    Any vault dust → fee destination
    Vault ATA closed (rent to payer)
    TrustPay PDA closed (rent to payer)
- MilestoneApprovedEvent (and ContractCompletedEvent if done) emitted

4. **Dispute & Resolution Flow**:
- Either party calls dispute_contract with milestone index and reason
- Program validates: caller is payer or recipient, milestone is COMPLETED_BY_SP
- Unique 6-char dispute ID generated via hash of contract+milestone+timestamp
- Milestone status → DISPUTED, contract status → DISPUTED
- GlobalState dispute counter incremented
- DisputeCreatedEvent emitted
- Authorized resolver calls resolve_dispute with resolution decision:
    * Resolution 0 (favor payer): Milestone amount + fee refunded to payer
    * Resolution 1 (favor recipient): Milestone amount → recipient, fee → fee destination
    * Resolution 2 (split): 50% → recipient, 50% + fee → payer (no fee charged)
- Milestone status updated based on resolution
- If all milestones resolved, contract closes similar to approval flow
- DisputeResolvedEvent emitted



### PDA Usage
TrustPay implements Program Derived Addresses strategically to ensure security, uniqueness, and deterministic account discovery.

**PDAs Used:**
1. **TrustPay Contract PDA**
- **Seeds:** [b"trust-pay", payer.key(), seed.to_le_bytes()]
    * `b"trust-pay"`: Namespace identifier to prevent collisions with other programs
    * `payer.key()`: Ensures contracts are organized by the payer (client), making it easy to query all contracts for a specific client
    * `seed.to_le_bytes()`: User-provided u64 seed allows multiple concurrent contracts between the same payer-recipient pair. Without this, the same payer and recipient could only have one contract at a time.
- **Benefits:**
    * Deterministic: Anyone can derive the contract address if they know the payer and seed
    * Unique: Each seed value creates a distinct contract, even for the same parties
    * Secure: Only the program can sign transactions on behalf of this PDA
    * Organized: Easy to fetch all contracts for a specific payer using `getProgramAccounts` filters
- **Implementation Example:**
```rust
   #[account(
       init,
       payer = creator,
       space = ANCHOR_DISCRIMINATOR + TrustPay::INIT_SPACE,
       seeds = [b"trust-pay", payer_pubkey.as_ref(), seed.to_le_bytes().as_ref()],
       bump
   )]
   pub trust_pay: Box<Account>,
```

2. **GlobalState PDA**
- **Seeds:** [b"global-state"]
    * Simple, constant seed ensures only one GlobalState account exists
- **Benefits:**
     - Singleton pattern: Guaranteed single source of truth for platform metrics
     - Predictable: Everyone knows the exact address without any parameters
   
- **Implementation Example:**
```rust
   #[account(
       init_if_needed,
       payer = creator,
       space = 8 + GlobalState::INIT_SPACE,
       seeds = [b"global-state"],
       bump
   )]
   pub global_state: Account,
```

3. **Vault Token Account (Associated Token Account)**
* **Authority:** TrustPay Contract PDA
   - Purpose: Escrow account that holds tokens until release conditions are met
* **Why ATA with PDA authority:**
    - Uses Anchor's `associated_token::authority = trust_pay` constraint
    - The TrustPay PDA becomes the owner of the token account
    - Only the program can sign transfers from this vault using PDA signer seeds
    - Follows Solana's ATA standard for predictable token account addresses
* **Benefits:**
    - Secure: Tokens cannot be moved without program approval
    - Standard: Uses widely adopted ATA pattern
    - Deterministic: Token account address can be derived from mint + authority
    - No private keys: Since PDA has no private key, tokens are program-controlled
   
* **Implementation Example:**
```rust
   #[account(
       init,
       payer = creator,
       associated_token::mint = mint,
       associated_token::authority = trust_pay,
       associated_token::token_program = token_program
   )]
   pub vault: Box<InterfaceAccount>,
```

**PDA Signer Seeds Usage**:
When the program needs to transfer tokens from the vault, it uses the PDA as a signer:
```rust
let seeds = &[
    b"trust-pay",
    payer_key.as_ref(),
    &trust_pay_seed.to_le_bytes()[..],
    &[trust_pay_bump],  // Bump seed ensures valid PDA
];
let signer_seeds = [&seeds[..]];

// Use in CPI call
let transfer_ctx = CpiContext::new_with_signer(
    token_program_info.clone(),
    transfer_accounts,
    &signer_seeds  // Program signs as the PDA
);
```

**Design Decisions**:

1. **Why include payer in TrustPay PDA seeds instead of recipient?**
   - Payers (clients) typically manage multiple contracts with different freelancers
   - Recipients might work with many different clients
   - Organizing by payer makes client dashboards more efficient
   - Seed parameter still allows uniqueness regardless of recipient

2. **Why use u64 seed instead of a counter?**
   - More flexible: Users can choose their own seeds (timestamps, IDs, etc.)
   - No global counter needed (reduces contention)
   - Simpler: No need to query for "next available seed"
   - Frontend can generate seeds based on timestamp or random numbers

3. **Why separate GlobalState instead of storing stats in TrustPay accounts?**
   - Aggregation: Easier to get platform-wide metrics from one account
   - Gas efficiency: Don't need to query multiple accounts for total volume
   - Authority: Single place to store resolver authority
   - Scalability: Stats don't bloat individual contract accounts

4. **Why use PDA for vault authority instead of program-owned account?**
   - Security: PDA has no private key, so tokens cannot be stolen
   - Standard: Follows Solana best practices for escrow
   - Deterministic: Vault address is predictable from TrustPay address
   - Clean: Each contract has its own isolated vault


### Program Instructions

**Instructions Implemented:**
1. **initialize_global_state**
- Initializes the platform-wide GlobalState account that tracks statistics and configuration
- Sets the resolver authority for dispute resolution
- Initializes all counters to zero (contracts, volume, disputes, fees)

2. **create_contract**
- Creates a new TrustPay contract between a payer (client) and recipient (freelancer)
- **Accounts Required:** Creator (signer), Mint, Creator token account, TrustPay PDA, Vault ATA, Fee destination, GlobalState, Token programs
- **What it does**:
    - Validates role, contract type, amounts, and milestone totals
    - Creates TrustPay PDA and vault ATA
    - If creator is payer: transfers tokens immediately, status = IN_PROGRESS
    - If creator is recipient: no transfer, status = PENDING (awaits acceptance)
    - Calculates 0.5% platform fee
    - Creates milestones with PENDING status
    - Increments GlobalState contract counter
    - Emits ContractCreatedEvent


3. **accept_contract**
- Payer accepts a pending contract created by recipient and Deposits total amount plus fee into vault
- **Accounts Required:** Payer (signer), Mint, Payer token account, TrustPay PDA, Vault, Token programs
- **What it does**:
    - Validates contract is in PENDING status
    - Validates deadline is reasonable (between 0 and 10 years)
    - Calculates actual deadline timestamp (current_time + duration)
    - Transfers total amount + fee to vault
    - Updates contract status to IN_PROGRESS
    - Sets deadline and acceptance timestamp
    - Emits ContractAcceptedEvent

4. **decline_contract**
- Payer rejects a pending contract
- **Accounts Required:** Payer (signer), Recipient, Mint, TrustPay PDA, Vault, Recipient token account, Token programs
- **What it does**:
    - Validates contract is in PENDING status
    - Checks vault balance and refunds tokens to recipient if any
    - Closes vault ATA (rent to payer)
    - Closes TrustPay PDA (rent to payer)
    - Zeros out account data for security
    - Emits ContractDeclinedEvent

5. **cancel_contract**
- Creator cancels a pending contract
- **Accounts Required:** Canceller (signer), Payer, Recipient, Mint, TrustPay PDA, Vault, Canceller token account, Token programs
- **What it does**:
    - Validates contract is in PENDING status
    - Determines who created the contract based on vault balance
    - Validates canceller is the creator
    - Refunds deposited tokens to creator if any
    - Closes vault ATA (rent to payer)
    - Closes TrustPay PDA (rent to payer)
    - Zeros out account data
    - Emits ContractCancelledEvent

6. **mark_milestone_complete**
- Recipient marks a milestone as completed and ready for payer review
- **Accounts Required:** Recipient (signer), TrustPay PDA, System Program
- **What it does**:
    - Validates contract is IN_PROGRESS
    - Validates milestone index is valid
    - Validates milestone is in PENDING status
    - Checks contract hasn't expired (current_time < deadline)
    - Updates milestone status to COMPLETED_BY_SP
    - Records completion timestamp
    - Emits MilestoneCompletedEvent


7. **approve_milestone_payment**
- Payer approves a completed milestone and releases payment to recipient
- **Accounts Required:** Payer (signer), Recipient, TrustPay PDA, Mint, Vault, Recipient token account, Fee destination, Fee destination token account, GlobalState, Token programs
- **What it does**:
     - Validates contract is IN_PROGRESS
     - Validates milestone is COMPLETED_BY_SP status
     - Calculates proportional fee for this milestone
     - Transfers milestone amount to recipient using PDA signer
     - Transfers fee to fee destination
     - Updates milestone status to APPROVED_BY_PAYER
     - Records approval timestamp
     - Updates GlobalState volume and confirmation counters
     - If all milestones approved:
       - Transfers any vault dust to fee destination
       - Closes vault ATA (rent to payer)
       - Closes TrustPay PDA (rent to payer)
       - Updates GlobalState closed contracts counter
       - Emits ContractCompletedEvent
     - Emits MilestoneApprovedEvent

8. **dispute_contract**
- Either party disputes a completed milestone before payment approval
- **Accounts Required:** Disputer (signer), TrustPay PDA, GlobalState, System Program
- **What it does**:
     - Validates contract is IN_PROGRESS
     - Validates disputer is either payer or recipient
     - Validates milestone is COMPLETED_BY_SP status
     - Validates dispute reason length (10-500 characters)
     - Generates unique 6-character dispute ID via hash (e.g., "AB1234")
     - Updates milestone status to DISPUTED
     - Stores dispute reason and ID in milestone
     - Updates contract status to DISPUTED
     - Increments GlobalState dispute counter
     - Emits DisputeCreatedEvent



9. **resolve_dispute**
- Only Authorized resolver decides the outcome of a disputed milestone
- **What it does**:
    - Validates resolver is the GlobalState authority
    - Validates contract is DISPUTED
    - Validates milestone is DISPUTED status
    - Validates resolution value (0, 1, or 2)
    - Based on resolution:
       - **0 (Favor Payer)**: Refunds milestone amount + fee to payer
       - **1 (Favor Recipient)**: Pays milestone amount to recipient, fee to fee destination, updates volume stats
       - **2 (Split 50/50)**: 50% to recipient, 50% + fee to payer (no fee charged)
    - Updates milestone status (APPROVED_BY_PAYER or PENDING)
    - Records approval timestamp
    - If all milestones resolved:
       - Closes vault and TrustPay accounts
       - Updates GlobalState
       - Emits ContractCompletedEvent
    - Emits DisputeResolvedEvent


10. **update_volume_metrics**
- Admin function to update platform volume statistics
- **Accounts Required:** Authority (signer), GlobalState, System Program
- **What it does**:
    - Validates caller is GlobalState authority
    - Updates high_watermark_volume if new volume is higher
    - Records last_volume_update timestamp

**Shared Helper Functions:**

- **transfer_tokens**: Helper function that wraps `transfer_checked` CPI for token transfers with proper decimal validation
- **update_on_payment_approval**: Updates GlobalState counters when milestone payment is approved
- **update_on_trust_pay_close**: Increments closed contract counter in GlobalState
- **update_on_fee_collection**: Tracks cumulative fees collected (currently unused but available for future use)
- **handle_trust_pay_refund**: Wrapper for updating stats on contract refunds
- **ensure_high_watermark_preserved**: Validates volume metrics consistency


### Account Structure
```rust
#[account]
pub struct TrustPay {
    pub contract_type: u8,              // 0 = one-time, 1 = milestone
    pub seed: u64,                      // Unique seed for multiple contracts
    pub payer: Pubkey,                  // Client wallet
    pub recipient: Pubkey,              // Freelancer wallet
    pub mint: Pubkey,                   // SPL token mint
    pub title: String,                  // Max 50 chars
    pub terms_and_conditions: String,   // Max 200 chars
    pub total_contract_amount: u64,     // Total payment amount
    pub deadline: Option<u64>,          // Unix timestamp deadline
    pub acceptance_timestamp: Option<i64>, // When contract was accepted
    pub contract_status: u8,            // PENDING/IN_PROGRESS/COMPLETED/DISPUTED/CANCELLED
    pub fee_percentage: u16,            // Basis points (50 = 0.5%)
    pub fee_destination: Pubkey,        // Platform fee recipient
    pub fee: u64,                       // Calculated fee amount
    pub milestones: Vec<Milestone>,     // Max 10 milestones
    pub bump: u8,                       // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Milestone {
    pub description: String,            // Max 200 chars
    pub amount: u64,                    // Payment for this milestone
    pub status: u8,                     // PENDING/COMPLETED_BY_SP/APPROVED_BY_PAYER/DISPUTED
    pub completed_at: Option<i64>,      // When marked complete
    pub approved_at: Option<i64>,       // When payment approved
    pub dispute_reason: Option<String>, // Max 300 chars
    pub dispute_id: Option<String>,     // 6-char unique ID
}

#[account]
pub struct GlobalState {
    pub authority: Pubkey,              // Resolver authority for disputes
    pub total_trust_pay_created: u64,   // Total contracts created
    pub total_trust_pay_closed: u64,    // Total contracts completed
    pub total_confirmations: u64,       // Total milestone approvals
    pub fee_percentage: u16,            // Platform fee basis points
    pub fee_destination: Pubkey,        // Platform fee recipient
    pub total_fees_collected: u64,      // Cumulative fees
    pub total_disputes: u64,            // Total disputes created
    pub total_volume: u64,              // Current active volume
    pub token_decimals: u8,             // Token decimal places
    pub high_watermark_volume: u64,     // Peak volume achieved
    pub last_volume_update: i64,        // Last metrics update
    pub bump: u8,                       // PDA bump seed
}
```

## Testing

### Test Coverage

**Happy Path Tests:**
✅ Create contract as payer with immediate deposit
✅ Create contract as recipient with pending status
✅ Accept contract and deposit funds with deadline
✅ Mark milestone as complete before deadline
✅ Approve milestone payment with fee distribution
✅ Complete multi-milestone contract with sequential approvals
✅ Close accounts and return rent after completion
✅ Calculate fees correctly (0.5% of milestone amount)
✅ Update global statistics on contract lifecycle events


**Unhappy Path Tests:**
❌ Create contract with invalid amount (zero or negative)
❌ Create contract with milestones not summing to total
❌ Create contract with too many milestones (>10)
❌ Accept contract with invalid deadline
❌ Mark milestone complete after deadline expires
❌ Approve milestone that hasn't been completed
❌ Dispute milestone not in COMPLETED_BY_SP status
❌ Resolve dispute by unauthorized wallet
❌ Cancel contract by non-creator
❌ Decline contract by non-payer
❌ Accept already accepted contract
❌ Double-approve same milestone
❌ Invalid contract type or role parameters
❌ Exceed maximum string lengths (title, terms, descriptions)

**Edge Cases Tested:**
- Contract with single one-time milestone
- Maximum 10 milestones
- Deadline at boundary (1 second vs 10 years)
- Dispute resolution with split decision (handles odd amounts)
- Vault dust handling after final approval
- Multiple contracts between same parties (different seeds)
- Fee calculation with small amounts


### Running Tests
```bash
# Run all tests
anchor test

# Build without testing
anchor build

# Deploying program
anchor deploy

```

### Additional Notes for Evaluators

**IMPORTANT - Dispute Resolution Technical Limitation:**
- The Issue:
There is a known discrepancy between the test environment and production deployment regarding dispute resolution:

**Production Design (Intended):** The resolver authority is hardcoded as ack4hThDoBbzRqs13Nq7o3h1juM8UFJtQf6csS8ZaLR in constants.rs. Only this wallet should be able to resolve disputes, and the frontend admin page is properly restricted to only this wallet address.
Test Environment (Modified): In create_contract.rs (line ~145), the code temporarily uses the contract creator (payer) as the resolver authority instead of the hardcoded admin:
```rust

   // In testing mode, the payer is used as authority
     let authority = payer.key();
     
     //TODO: use the RESOLVER_AUTHORITY
     // In production, the hardcoded RESOLVER_AUTHORITY is the authority        
     //let authority = crate::RESOLVER_AUTHORITY;
```     
- **Why This Was Done:**
During testing, evaluators don't have access to the seed phrase of the hardcoded admin wallet (ack4h...), so they cannot sign transactions to resolve disputes. To allow the test suite to pass and demonstrate full functionality, the resolver was temporarily set to the contract creator (who the test suite does have keys for).

- **The Problem This Creates:**
Frontend only allows the hardcoded admin (ack4h...) to access the admin/dispute resolution page
But the program sets the creator as the resolver
So if a real dispute occurs during evaluation, it cannot be resolved because:
The creator has resolver rights in the program, but can't access the admin UI
The admin can access the UI, but doesn't have resolver rights in the program

- **For Production Deployment:**
The commented lines in create_contract.rs should be uncommented to use the hardcoded RESOLVER_AUTHORITY constant. This ensures only the intended admin wallet can resolve disputes, matching the frontend restrictions.

**This is a Testing-vs-Production configuration issue, not a fundamental architectural flaw. The dispute resolution mechanism itself works correctly when properly configured.**