use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::TrustPayError;
use crate::state::TrustPay;

#[derive(Accounts)]
pub struct MarkMilestoneComplete<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(
        mut,
        has_one = recipient,
        seeds = [b"trust-pay", trust_pay.payer.key().as_ref(), trust_pay.seed.to_le_bytes().as_ref()],
        bump = trust_pay.bump,
        constraint = trust_pay.contract_status == CONTRACT_STATUS_IN_PROGRESS @ TrustPayError::ContractNotInProgress
    )]
    pub trust_pay: Account<'info, TrustPay>,

    pub system_program: Program<'info, System>,
}

pub fn mark_milestone_complete(
    ctx: Context<MarkMilestoneComplete>,
    milestone_index: u8,
) -> Result<()> {
    let trust_pay = &mut ctx.accounts.trust_pay;
    let index = milestone_index as usize;

    // Validate milestone index
    require!(
        index < trust_pay.milestones.len(),
        TrustPayError::InvalidMilestoneIndex
    );

    // Store values needed for the event BEFORE getting mutable references
    let trust_pay_key = trust_pay.key();
    let payer = trust_pay.payer;
    let recipient_key = ctx.accounts.recipient.key();
    let milestone_description = trust_pay.milestones[index].description.clone();
    let milestone_amount = trust_pay.milestones[index].amount;

    // Verify contract is still within deadline if deadline is set
    let current_time = Clock::get()?.unix_timestamp;

    if let Some(deadline) = trust_pay.deadline {
        require!(
            (current_time as u64) < deadline,
            TrustPayError::ContractExpired
        );
    } else {
        // If no deadline is set, the contract hasn't been accepted yet
        return Err(TrustPayError::ContractNotAccepted.into());
    }

    // Now get mutable reference to milestone
    let milestone = &mut trust_pay.milestones[index];

    // Verify milestone is in pending status
    require!(
        milestone.status == MILESTONE_STATUS_PENDING,
        TrustPayError::MilestoneNotPending
    );

    // Update milestone status and timestamp
    milestone.status = MILESTONE_STATUS_COMPLETED_BY_SP;
    milestone.completed_at = Some(current_time);

    // Emit event using stored values
    emit!(crate::MilestoneCompletedEvent {
        trust_pay: trust_pay_key,
        payer,
        recipient: recipient_key,
        milestone_index,
        description: milestone_description,
        amount: milestone_amount,
        completed_at: current_time,
    });

    msg!(
        "Milestone {} marked complete by recipient: {}, amount: {}",
        milestone_index,
        recipient_key,
        milestone_amount
    );

    Ok(())
}
