use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TrustPay {
    pub contract_type: u8, // 0 = one-time, 1 = milestone
    pub seed: u64,
    pub payer: Pubkey,     // This is the client
    pub recipient: Pubkey, // This is the worker
    pub mint: Pubkey,
    #[max_len(50)]
    pub title: String,
    #[max_len(200)]
    pub terms_and_conditions: String,
    pub total_contract_amount: u64,
    pub deadline: Option<u64>,
    pub acceptance_timestamp: Option<i64>,
    pub contract_status: u8,
    pub fee_percentage: u16,
    pub fee_destination: Pubkey,
    pub fee: u64,
    #[max_len(10)]
    pub milestones: Vec<Milestone>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Milestone {
    #[max_len(200)]
    pub description: String,
    pub amount: u64,
    pub status: u8,
    pub completed_at: Option<i64>,
    pub approved_at: Option<i64>,
    #[max_len(300)]
    pub dispute_reason: Option<String>,
    #[max_len(6)]
    pub dispute_id: Option<String>,
}

impl TrustPay {
    pub fn is_all_milestones_approved(&self) -> bool {
        self.milestones
            .iter()
            .all(|m| m.status == MILESTONE_STATUS_APPROVED_BY_PAYER)
    }

    pub fn get_total_approved_amount(&self) -> u64 {
        self.milestones
            .iter()
            .filter(|m| m.status == MILESTONE_STATUS_APPROVED_BY_PAYER)
            .map(|m| m.amount)
            .sum()
    }

    pub fn get_remaining_amount(&self) -> u64 {
        let approved_amount = self.get_total_approved_amount();
        self.total_contract_amount.saturating_sub(approved_amount)
    }

    pub fn has_active_disputes(&self) -> bool {
        self.milestones
            .iter()
            .any(|m| m.status == MILESTONE_STATUS_DISPUTED)
    }
}

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,
    pub total_trust_pay_created: u64,
    pub total_trust_pay_closed: u64,
    pub total_confirmations: u64,
    pub fee_percentage: u16,
    pub fee_destination: Pubkey,
    pub total_fees_collected: u64,
    pub total_disputes: u64,
    pub total_volume: u64,
    pub token_decimals: u8,
    pub high_watermark_volume: u64,
    pub last_volume_update: i64,
    pub bump: u8,
}
