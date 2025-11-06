use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::constants::ANCHOR_DISCRIMINATOR;
use crate::error::TrustPayError;
use crate::state::GlobalState;

#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + GlobalState::INIT_SPACE,
        seeds = [b"global-state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    //CHECK: token mint
    #[account()]
    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_global_state(ctx: Context<InitializeGlobalState>) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    global_state.authority = ctx.accounts.authority.key();
    global_state.total_trust_pay_created = 0;
    global_state.total_trust_pay_closed = 0;
    global_state.total_confirmations = 0;
    global_state.total_volume = 0;
    global_state.high_watermark_volume = 0;
    global_state.last_volume_update = Clock::get()?.unix_timestamp;
    global_state.token_decimals = ctx.accounts.mint.decimals;
    global_state.bump = ctx.bumps.global_state;
    msg!(
        "Global state initialized with token decimals: {}",
        global_state.token_decimals
    );
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateVolumeMetrics<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global-state"],
        bump = global_state.bump,
        has_one = authority
    )]
    pub global_state: Account<'info, GlobalState>,

    pub system_program: Program<'info, System>,
}

pub fn update_volume_metrics(ctx: Context<UpdateVolumeMetrics>, volume: u64) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    //update volume only if the new is higher than the previous volume
    if volume > global_state.high_watermark_volume {
        global_state.high_watermark_volume = volume;
    }

    global_state.last_volume_update = Clock::get()?.unix_timestamp;

    msg!(
        "Volume metrics updated. New high watermark: token={}",
        global_state.high_watermark_volume
    );

    Ok(())
}

// Update the global state on approval of payments
pub fn update_on_payment_approval(
    global_state: &mut Account<'_, GlobalState>,
    token_amount: u64,
) -> Result<()> {
    // Increase the number
    global_state.total_confirmations += 1;
    global_state.total_volume += token_amount;

    // update the volume
    if global_state.total_volume > global_state.high_watermark_volume {
        global_state.high_watermark_volume = global_state.total_volume;
    }

    // Update the time
    global_state.last_volume_update = Clock::get()?.unix_timestamp;

    Ok(())
}

// Update global state when trust pay is closed
pub fn update_on_trust_pay_close(global_state: &mut Account<'_, GlobalState>) -> Result<()> {
    // Increase number for closed trust pays
    global_state.total_trust_pay_closed += 1;

    // Update timestamp
    global_state.last_volume_update = Clock::get()?.unix_timestamp;

    Ok(())
}

pub fn update_on_fee_collection(global_state: &mut GlobalState, fee_amount: u64) -> Result<()> {
    global_state.total_fees_collected = global_state
        .total_fees_collected
        .checked_add(fee_amount)
        .ok_or(TrustPayError::CalculationError)?;
    Ok(())
}
// Function to handle refund
pub fn handle_trust_pay_refund(global_state: &mut Account<'_, GlobalState>) -> Result<()> {
    update_on_trust_pay_close(global_state)
}

// Function to ensure high watermark is captured during any global state operation
pub fn ensure_high_watermark_preserved(global_state: &mut Account<'_, GlobalState>) -> Result<()> {
    if global_state.total_volume < global_state.high_watermark_volume {
        msg!(
            "Warning: Total volume ({}) is less than high watermark ({})",
            global_state.total_volume,
            global_state.high_watermark_volume
        );
    }

    // Update timestamp
    global_state.last_volume_update = Clock::get()?.unix_timestamp;

    Ok(())
}
