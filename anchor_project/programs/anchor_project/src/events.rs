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
