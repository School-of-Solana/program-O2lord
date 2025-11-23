use anchor_lang::prelude::*;

#[event]
pub struct ContractCreatedEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub mint: Pubkey,
    pub title: String,
    pub total_amount: u64,
    pub milestone_count: u8,
    pub deadline: i64,
    pub fee_percentage: u16,
    pub fee_destination: Pubkey,
}

#[event]
pub struct ContractCancelledEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub canceller: Pubkey,
    pub total_amount: u64,
    pub refunded_amount: u64,
    pub cancelled_at: i64,
}
#[event]
pub struct ContractAcceptedEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub title: String,
    pub total_amount: u64,
    pub milestone_count: u8,
    pub accepted_at: i64,
    pub deadline: i64,
}

#[event]
pub struct MilestoneCompletedEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub milestone_index: u8,
    pub description: String,
    pub amount: u64,
    pub completed_at: i64,
}

#[event]
pub struct MilestoneApprovedEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub milestone_index: u8,
    pub description: String,
    pub amount: u64,
    pub fee_amount: u64,
    pub approved_at: i64,
}

#[event]
pub struct ContractCompletedEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub total_amount: u64,
    pub completed_at: i64,
}

#[event]
pub struct ContractDeclinedEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub total_amount: u64,
    pub refunded_amount: u64,
    pub declined_at: i64,
}

#[event]
pub struct DisputeCreatedEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub milestone_index: u8,
    pub description: String,
    pub amount: u64,
    pub disputer: Pubkey,
    pub reason: String,
    pub dispute_id: String,
    pub disputed_at: i64,
}

#[event]
pub struct DisputeResolvedEvent {
    pub trust_pay: Pubkey,
    pub payer: Pubkey,
    pub recipient: Pubkey,
    pub milestone_index: u8,
    pub description: String,
    pub amount: u64,
    pub fee_amount: u64,
    pub resolver: Pubkey,
    pub resolution: u8, // 0 = favor payer, 1 = favor recipient, 2 = split
    pub resolution_reason: String,
    pub resolved_at: i64,
}
