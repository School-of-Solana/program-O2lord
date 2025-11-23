use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::constants::*;
use crate::error::TrustPayError;
use crate::state::{GlobalState, TrustPay};
use crate::{update_on_payment_approval, update_on_trust_pay_close};

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,

    #[account(mut)]
    pub payer: SystemAccount<'info>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        has_one = payer,
        has_one = recipient,
        has_one = mint,
        has_one = fee_destination,
        seeds = [b"trust-pay", payer.key().as_ref(), trust_pay.seed.to_le_bytes().as_ref()],
        bump = trust_pay.bump,
        constraint = trust_pay.contract_status == CONTRACT_STATUS_DISPUTED @ TrustPayError::ContractNotDisputed
    )]
    pub trust_pay: Account<'info, TrustPay>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = trust_pay,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program,
    )]
    pub payer_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: This is the fee destination account validated by has_one constraint on trust_pay
    pub fee_destination: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = resolver,
        associated_token::mint = mint,
        associated_token::authority = fee_destination,
        associated_token::token_program = token_program,
    )]
    pub fee_destination_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"global-state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn resolve_dispute(
    ctx: Context<ResolveDispute>,
    milestone_index: u8,
    resolution: u8, // 0 = favor payer (refund), 1 = favor recipient (pay), 2 = split
    resolution_reason: String,
) -> Result<()> {
    // Authorization check at the beginning of the instruction
    require!(
        ctx.accounts.resolver.key() == ctx.accounts.global_state.authority,
        TrustPayError::UnauthorizedResolver
    );

    let index = milestone_index as usize;
    let trust_pay_seed = ctx.accounts.trust_pay.seed;
    let trust_pay_bump = ctx.accounts.trust_pay.bump;
    let trust_pay_key = ctx.accounts.trust_pay.key();
    let payer_key = ctx.accounts.payer.key();
    let recipient_key = ctx.accounts.recipient.key();
    let mint_decimals = ctx.accounts.mint.decimals;

    // Validate resolution
    require!(resolution <= 2, TrustPayError::InvalidResolution);

    // Validate milestone index and status
    require!(
        index < ctx.accounts.trust_pay.milestones.len(),
        TrustPayError::InvalidMilestoneIndex
    );

    require!(
        ctx.accounts.trust_pay.milestones[index].status == MILESTONE_STATUS_DISPUTED,
        TrustPayError::MilestoneNotDisputed
    );

    // Create PDA signer seeds
    let seeds = &[
        b"trust-pay",
        payer_key.as_ref(),
        &trust_pay_seed.to_le_bytes()[..],
        &[trust_pay_bump],
    ];
    let signer_seeds = [&seeds[..]];

    // Get milestone details
    let milestone_amount;
    let milestone_description;
    let fee_amount;
    {
        let milestone = &ctx.accounts.trust_pay.milestones[index];
        milestone_amount = milestone.amount;
        milestone_description = milestone.description.clone();

        let trust_pay = &ctx.accounts.trust_pay;
        fee_amount = milestone_amount
            .checked_mul(trust_pay.fee_percentage as u64)
            .ok_or(TrustPayError::CalculationError)?
            .checked_div(10000)
            .ok_or(TrustPayError::CalculationError)?;
    }

    let vault_info = ctx.accounts.vault.to_account_info();
    let payer_token_account_info = ctx.accounts.payer_token_account.to_account_info();
    let recipient_token_account_info = ctx.accounts.recipient_token_account.to_account_info();
    let fee_destination_token_account_info =
        ctx.accounts.fee_destination_token_account.to_account_info();
    let mint_info = ctx.accounts.mint.to_account_info();
    let trust_pay_info = ctx.accounts.trust_pay.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();

    // Handle resolution based on decision
    match resolution {
        0 => {
            // Favor payer - refund milestone amount (no fee charged)
            let transfer_accounts = TransferChecked {
                from: vault_info.clone(),
                to: payer_token_account_info.clone(),
                mint: mint_info.clone(),
                authority: trust_pay_info.clone(),
            };

            let transfer_ctx = CpiContext::new_with_signer(
                token_program_info.clone(),
                transfer_accounts,
                &signer_seeds,
            );

            transfer_checked(transfer_ctx, milestone_amount, mint_decimals)?;

            // Return the fee as well
            if fee_amount > 0 {
                let fee_refund_accounts = TransferChecked {
                    from: vault_info.clone(),
                    to: payer_token_account_info.clone(),
                    mint: mint_info.clone(),
                    authority: trust_pay_info.clone(),
                };

                let fee_refund_ctx = CpiContext::new_with_signer(
                    token_program_info.clone(),
                    fee_refund_accounts,
                    &signer_seeds,
                );

                transfer_checked(fee_refund_ctx, fee_amount, mint_decimals)?;
            }
        }
        1 => {
            // Favor recipient - pay out milestone amount
            let transfer_accounts = TransferChecked {
                from: vault_info.clone(),
                to: recipient_token_account_info.clone(),
                mint: mint_info.clone(),
                authority: trust_pay_info.clone(),
            };

            let transfer_ctx = CpiContext::new_with_signer(
                token_program_info.clone(),
                transfer_accounts,
                &signer_seeds,
            );

            transfer_checked(transfer_ctx, milestone_amount, mint_decimals)?;

            // Transfer fee to fee destination
            if fee_amount > 0 {
                let fee_transfer_accounts = TransferChecked {
                    from: vault_info.clone(),
                    to: fee_destination_token_account_info.clone(),
                    mint: mint_info.clone(),
                    authority: trust_pay_info.clone(),
                };

                let fee_transfer_ctx = CpiContext::new_with_signer(
                    token_program_info.clone(),
                    fee_transfer_accounts,
                    &signer_seeds,
                );

                transfer_checked(fee_transfer_ctx, fee_amount, mint_decimals)?;
            }

            // Update global stats for successful payment
            update_on_payment_approval(&mut ctx.accounts.global_state, milestone_amount)?;
        }
        2 => {
            // Split - 50/50 between payer and recipient (no fee charged)
            let split_amount = milestone_amount
                .checked_div(2)
                .ok_or(TrustPayError::CalculationError)?;

            // Transfer to recipient
            let recipient_transfer_accounts = TransferChecked {
                from: vault_info.clone(),
                to: recipient_token_account_info.clone(),
                mint: mint_info.clone(),
                authority: trust_pay_info.clone(),
            };

            let recipient_transfer_ctx = CpiContext::new_with_signer(
                token_program_info.clone(),
                recipient_transfer_accounts,
                &signer_seeds,
            );

            transfer_checked(recipient_transfer_ctx, split_amount, mint_decimals)?;

            // Transfer remainder to payer (includes any dust from division)
            let remaining = milestone_amount
                .checked_add(fee_amount)
                .ok_or(TrustPayError::CalculationError)?
                .checked_sub(split_amount)
                .ok_or(TrustPayError::CalculationError)?;

            let payer_transfer_accounts = TransferChecked {
                from: vault_info.clone(),
                to: payer_token_account_info.clone(),
                mint: mint_info.clone(),
                authority: trust_pay_info.clone(),
            };

            let payer_transfer_ctx = CpiContext::new_with_signer(
                token_program_info.clone(),
                payer_transfer_accounts,
                &signer_seeds,
            );

            transfer_checked(payer_transfer_ctx, remaining, mint_decimals)?;
        }
        _ => return Err(TrustPayError::InvalidResolution.into()),
    }

    // Update milestone status
    let contract_completed;
    {
        let trust_pay = &mut ctx.accounts.trust_pay;
        let milestone = &mut trust_pay.milestones[index];

        // Mark as approved if resolved in favor of recipient, otherwise mark as cancelled
        milestone.status = if resolution == 1 {
            MILESTONE_STATUS_APPROVED_BY_PAYER
        } else {
            MILESTONE_STATUS_PENDING // Reset to pending or could use a new CANCELLED status
        };

        milestone.approved_at = Some(Clock::get()?.unix_timestamp);

        // Check if all milestones are resolved
        let all_resolved = trust_pay.milestones.iter().all(|m| {
            m.status == MILESTONE_STATUS_APPROVED_BY_PAYER || m.status == MILESTONE_STATUS_PENDING
        });

        if all_resolved {
            trust_pay.contract_status = CONTRACT_STATUS_COMPLETED;
            contract_completed = true;
        } else {
            trust_pay.contract_status = CONTRACT_STATUS_IN_PROGRESS;
            contract_completed = false;
        }
    }

    // Emit dispute resolved event
    emit!(crate::DisputeResolvedEvent {
        trust_pay: trust_pay_key,
        payer: payer_key,
        recipient: recipient_key,
        milestone_index,
        description: milestone_description,
        amount: milestone_amount,
        fee_amount,
        resolver: ctx.accounts.resolver.key(),
        resolution,
        resolution_reason: resolution_reason.clone(),
        resolved_at: Clock::get()?.unix_timestamp,
    });

    // If contract is completed, close accounts
    if contract_completed {
        ctx.accounts.vault.reload()?;
        let remaining_balance = ctx.accounts.vault.amount;

        if remaining_balance > 0 {
            let dust_transfer_accounts = TransferChecked {
                from: vault_info.clone(),
                to: fee_destination_token_account_info.clone(),
                mint: mint_info.clone(),
                authority: trust_pay_info.clone(),
            };

            let dust_transfer_ctx = CpiContext::new_with_signer(
                token_program_info.clone(),
                dust_transfer_accounts,
                &signer_seeds,
            );

            transfer_checked(dust_transfer_ctx, remaining_balance, mint_decimals)?;
        }

        // Close vault account
        let close_accounts = CloseAccount {
            account: vault_info.clone(),
            destination: ctx.accounts.payer.to_account_info(),
            authority: trust_pay_info.clone(),
        };

        let close_ctx =
            CpiContext::new_with_signer(token_program_info.clone(), close_accounts, &signer_seeds);

        close_account(close_ctx)?;

        // Update global statistics
        update_on_trust_pay_close(&mut ctx.accounts.global_state)?;

        // Close TrustPay account
        let payer_starting_lamports = ctx.accounts.payer.lamports();
        let trust_pay_lamports = trust_pay_info.lamports();

        **ctx.accounts.payer.lamports.borrow_mut() = payer_starting_lamports
            .checked_add(trust_pay_lamports)
            .ok_or(TrustPayError::CalculationError)?;
        **trust_pay_info.lamports.borrow_mut() = 0;

        let mut trust_pay_data = trust_pay_info.try_borrow_mut_data()?;
        for byte in trust_pay_data.iter_mut() {
            *byte = 0;
        }

        emit!(crate::ContractCompletedEvent {
            trust_pay: trust_pay_key,
            payer: payer_key,
            recipient: recipient_key,
            total_amount: ctx.accounts.trust_pay.total_contract_amount,
            completed_at: Clock::get()?.unix_timestamp,
        });
    }

    msg!(
        "Dispute resolved - Milestone {}, Resolution: {}, Reason: {}",
        milestone_index,
        resolution,
        resolution_reason
    );

    Ok(())
}
