use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::constants::*;
use crate::error::TrustPayError;
use crate::instructions::shared::*;
use crate::state::TrustPay;

#[derive(Accounts)]
pub struct AcceptContract<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
    init_if_needed,
    payer = payer,
    associated_token::mint = mint,
    associated_token::authority = payer,
    associated_token::token_program = token_program
    )]
    pub payer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        has_one = payer,
        has_one = mint,
        seeds = [b"trust-pay", trust_pay.payer.key().as_ref(), trust_pay.seed.to_le_bytes().as_ref()],
        bump = trust_pay.bump,
        constraint = trust_pay.contract_status == CONTRACT_STATUS_PENDING @ TrustPayError::ContractNotPending
    )]
    pub trust_pay: Account<'info, TrustPay>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = trust_pay,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn accept_contract(ctx: Context<AcceptContract>, deadline_duration_seconds: u64) -> Result<()> {
    let trust_pay_key = ctx.accounts.trust_pay.key();
    let current_time = Clock::get()?.unix_timestamp;

    // Validate deadline duration
    require!(
        deadline_duration_seconds > 0,
        TrustPayError::InvalidDeadline
    );

    // Ensure deadline_duration_seconds can be safely cast to i64
    require!(
        deadline_duration_seconds <= i64::MAX as u64,
        TrustPayError::CalculationError
    );

    // Calculate the actual deadline by adding the duration to current time
    let calculated_deadline = current_time
        .checked_add(deadline_duration_seconds as i64)
        .ok_or(TrustPayError::CalculationError)?;

    // Ensure the calculated deadline is in the future (sanity check)
    require!(
        current_time < calculated_deadline,
        TrustPayError::ContractExpired
    );

    // Additional validation: ensure deadline is reasonable (e.g., not more than 10 years in future)
    let max_reasonable_deadline = current_time
        .checked_add(10 * 365 * 24 * 60 * 60) // 10 years in seconds
        .ok_or(TrustPayError::CalculationError)?;

    require!(
        calculated_deadline <= max_reasonable_deadline,
        TrustPayError::DeadlineTooFar
    );

    // Calculate total amount to deposit (contract amount + fee)
    let total_deposit = ctx
        .accounts
        .trust_pay
        .total_contract_amount
        .checked_add(ctx.accounts.trust_pay.fee)
        .ok_or(TrustPayError::CalculationError)?;

    // Transfer tokens to vault (payer accepts and deposits)
    transfer_tokens(
        &ctx.accounts.payer_token_account,
        &ctx.accounts.vault,
        &total_deposit,
        &ctx.accounts.mint,
        &ctx.accounts.payer,
        &ctx.accounts.token_program,
    )?;

    // Update the trust_pay account with acceptance details
    let trust_pay = &mut ctx.accounts.trust_pay;
    trust_pay.deadline = Some(calculated_deadline as u64);
    trust_pay.acceptance_timestamp = Some(current_time);
    trust_pay.contract_status = CONTRACT_STATUS_IN_PROGRESS;

    // Emit contract accepted event
    emit!(crate::ContractAcceptedEvent {
        trust_pay: trust_pay_key,
        payer: trust_pay.payer,
        recipient: trust_pay.recipient,
        title: trust_pay.title.clone(),
        total_amount: trust_pay.total_contract_amount,
        milestone_count: trust_pay.milestones.len() as u8,
        accepted_at: current_time,
        deadline: calculated_deadline,
    });

    msg!(
        "Contract accepted by payer: {}, deadline set to: {}, current time: {}, deposited: {} tokens",
        ctx.accounts.payer.key(),
        calculated_deadline,
        current_time,
        total_deposit
    );

    Ok(())
}
