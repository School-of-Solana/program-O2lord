use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

use crate::constants::*;
use crate::error::TrustPayError;
use crate::state::{GlobalState, TrustPay};

#[derive(Accounts)]
pub struct DisputeContract<'info> {
    #[account(mut)]
    pub disputer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"trust-pay", trust_pay.payer.key().as_ref(), trust_pay.seed.to_le_bytes().as_ref()],
        bump = trust_pay.bump,
        constraint = trust_pay.contract_status == CONTRACT_STATUS_IN_PROGRESS @ TrustPayError::ContractNotInProgress
    )]
    pub trust_pay: Account<'info, TrustPay>,

    #[account(
        mut,
        seeds = [b"global-state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub system_program: Program<'info, System>,
}

fn generate_dispute_id(trust_pay_pubkey: &Pubkey, milestone_index: u8, timestamp: i64) -> String {
    let seed = format!(
        "{}:{}:{}",
        trust_pay_pubkey.to_string(),
        milestone_index,
        timestamp
    );

    let hash_result = hash(seed.as_bytes());
    let hash_bytes = hash_result.to_bytes();

    let alpha1 = ((hash_bytes[0] % 26) + b'A') as char;
    let alpha2 = ((hash_bytes[1] % 26) + b'A') as char;
    let num1 = (hash_bytes[2] % 10) as u8;
    let num2 = (hash_bytes[3] % 10) as u8;
    let num3 = (hash_bytes[4] % 10) as u8;
    let num4 = (hash_bytes[5] % 10) as u8;

    format!("{}{}{}{}{}{}", alpha1, alpha2, num1, num2, num3, num4)
}

pub fn dispute_contract(
    ctx: Context<DisputeContract>,
    milestone_index: u8,
    dispute_reason: String,
) -> Result<()> {
    let index = milestone_index as usize;
    let trust_pay_key = ctx.accounts.trust_pay.key();
    let disputer_key = ctx.accounts.disputer.key();

    // Validate dispute reason
    require!(
        dispute_reason.len() >= 10 && dispute_reason.len() <= 500,
        TrustPayError::InvalidDisputeReason
    );

    // Validate milestone index
    require!(
        index < ctx.accounts.trust_pay.milestones.len(),
        TrustPayError::InvalidMilestoneIndex
    );

    // Validate that disputer is either payer or recipient
    {
        let trust_pay = &ctx.accounts.trust_pay;
        require!(
            disputer_key == trust_pay.payer || disputer_key == trust_pay.recipient,
            TrustPayError::UnauthorizedDisputer
        );
    }

    // Validate milestone status - must be completed by service provider
    {
        let milestone = &ctx.accounts.trust_pay.milestones[index];
        require!(
            milestone.status == MILESTONE_STATUS_COMPLETED_BY_SP,
            TrustPayError::MilestoneNotDisputable
        );
    }

    // Generate unique dispute ID
    let current_timestamp = Clock::get()?.unix_timestamp;
    let dispute_id = generate_dispute_id(&trust_pay_key, milestone_index, current_timestamp);

    // Store milestone info before mutation
    let milestone_description;
    let milestone_amount;
    {
        let milestone = &ctx.accounts.trust_pay.milestones[index];
        milestone_description = milestone.description.clone();
        milestone_amount = milestone.amount;
    }

    // Update milestone status to disputed
    {
        let trust_pay = &mut ctx.accounts.trust_pay;
        let milestone = &mut trust_pay.milestones[index];
        milestone.status = MILESTONE_STATUS_DISPUTED;
        milestone.dispute_reason = Some(dispute_reason.clone());
        milestone.dispute_id = Some(dispute_id.clone());

        // Update contract status to disputed
        trust_pay.contract_status = CONTRACT_STATUS_DISPUTED;
    }

    // Update global state
    {
        let global_state = &mut ctx.accounts.global_state;
        global_state.total_disputes = global_state
            .total_disputes
            .checked_add(1)
            .ok_or(TrustPayError::CalculationError)?;
    }

    // Emit dispute event
    emit!(crate::DisputeCreatedEvent {
        trust_pay: trust_pay_key,
        payer: ctx.accounts.trust_pay.payer,
        recipient: ctx.accounts.trust_pay.recipient,
        milestone_index,
        description: milestone_description,
        amount: milestone_amount,
        disputer: disputer_key,
        reason: dispute_reason,
        dispute_id: dispute_id.clone(),
        disputed_at: current_timestamp,
    });

    msg!(
        "Contract disputed - Milestone {}, Dispute ID: {}, Disputer: {}",
        milestone_index,
        dispute_id,
        disputer_key
    );

    Ok(())
}
