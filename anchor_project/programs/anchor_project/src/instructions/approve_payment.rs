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
use crate::instructions::shared::*;
use crate::state::TrustPay;
use crate::{update_on_payment_approval, update_on_trust_pay_close, GlobalState};

#[derive(Accounts)]
pub struct ApproveMilestonePayment<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: recipient account validated through has_one constraint
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        has_one = payer,
        has_one = recipient,
        has_one = mint,
        has_one = fee_destination,
        seeds = [b"trust-pay", payer.key().as_ref(), trust_pay.seed.to_le_bytes().as_ref()],
        bump = trust_pay.bump,
        constraint = trust_pay.contract_status == CONTRACT_STATUS_IN_PROGRESS @ TrustPayError::ContractNotInProgress
    )]
    pub trust_pay: Account<'info, TrustPay>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = trust_pay,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: This is the fee destination account
    pub fee_destination: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
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

pub fn approve_milestone_payment(
    ctx: Context<ApproveMilestonePayment>,
    milestone_index: u8,
) -> Result<()> {
    let trust_pay_seed = ctx.accounts.trust_pay.seed;
    let trust_pay_bump = ctx.accounts.trust_pay.bump;
    let trust_pay_key = ctx.accounts.trust_pay.key();
    let payer_key = ctx.accounts.payer.key();
    let recipient_key = ctx.accounts.recipient.key();
    let mint_decimals = ctx.accounts.mint.decimals;
    let index = milestone_index as usize;

    // Create PDA signer seeds
    let seeds = &[
        b"trust-pay",
        payer_key.as_ref(),
        &trust_pay_seed.to_le_bytes()[..],
        &[trust_pay_bump],
    ];
    let signer_seeds = [&seeds[..]];

    // Validate milestone index and status
    {
        let trust_pay = &ctx.accounts.trust_pay;
        require!(
            index < trust_pay.milestones.len(),
            TrustPayError::InvalidMilestoneIndex
        );

        let milestone = &trust_pay.milestones[index];
        require!(
            milestone.status == MILESTONE_STATUS_COMPLETED_BY_SP,
            TrustPayError::MilestoneNotCompleted
        );
    }

    // Get milestone amount and calculate fee
    let milestone_amount;
    let milestone_description;
    let fee_amount;
    {
        let trust_pay = &ctx.accounts.trust_pay;
        let milestone = &trust_pay.milestones[index];
        milestone_amount = milestone.amount;
        milestone_description = milestone.description.clone();

        // Calculate the proportional fee for this milestone
        fee_amount = milestone_amount
            .checked_mul(trust_pay.fee_percentage as u64)
            .ok_or(TrustPayError::CalculationError)?
            .checked_div(10000)
            .ok_or(TrustPayError::CalculationError)?;
    }

    let vault_info = ctx.accounts.vault.to_account_info();
    let recipient_token_account_info = ctx.accounts.recipient_token_account.to_account_info();
    let fee_destination_token_account_info =
        ctx.accounts.fee_destination_token_account.to_account_info();
    let mint_info = ctx.accounts.mint.to_account_info();
    let trust_pay_info = ctx.accounts.trust_pay.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();

    // Transfer milestone amount to recipient
    let transfer_accounts = TransferChecked {
        from: vault_info.clone(),
        to: recipient_token_account_info.clone(),
        mint: mint_info.clone(),
        authority: trust_pay_info.clone(),
    };

    let transfer_ctx =
        CpiContext::new_with_signer(token_program_info.clone(), transfer_accounts, &signer_seeds);

    transfer_checked(transfer_ctx, milestone_amount, mint_decimals)?;

    // Transfer fee if any
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

    // Update milestone status and check if contract is complete
    let contract_completed;
    {
        let trust_pay = &mut ctx.accounts.trust_pay;
        let milestone = &mut trust_pay.milestones[index];
        milestone.status = MILESTONE_STATUS_APPROVED_BY_PAYER;
        milestone.approved_at = Some(Clock::get()?.unix_timestamp);

        // Check if all milestones are approved
        contract_completed = trust_pay.is_all_milestones_approved();
        if contract_completed {
            trust_pay.contract_status = CONTRACT_STATUS_COMPLETED;
        }
    }

    // Update global statistics
    update_on_payment_approval(&mut ctx.accounts.global_state, milestone_amount)?;

    // Emit milestone approved event
    emit!(crate::MilestoneApprovedEvent {
        trust_pay: trust_pay_key,
        payer: payer_key,
        recipient: recipient_key,
        milestone_index,
        description: milestone_description,
        amount: milestone_amount,
        fee_amount,
        approved_at: Clock::get()?.unix_timestamp,
    });

    // If contract is completed, handle cleanup
    if contract_completed {
        // Check for any remaining dust in vault
        ctx.accounts.vault.reload()?;
        let remaining_balance = ctx.accounts.vault.amount;

        if remaining_balance > 0 {
            // Transfer any remaining dust to fee destination
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

        // Update global statistics for contract closure
        update_on_trust_pay_close(&mut ctx.accounts.global_state)?;

        // Close TrustPay account and return rent to payer
        let payer_starting_lamports = ctx.accounts.payer.lamports();
        let trust_pay_lamports = trust_pay_info.lamports();

        **ctx.accounts.payer.lamports.borrow_mut() = payer_starting_lamports
            .checked_add(trust_pay_lamports)
            .ok_or(TrustPayError::CalculationError)?;
        **trust_pay_info.lamports.borrow_mut() = 0;

        // Zero out account data
        let mut trust_pay_data = trust_pay_info.try_borrow_mut_data()?;
        for byte in trust_pay_data.iter_mut() {
            *byte = 0;
        }

        // Emit contract completed event
        emit!(crate::ContractCompletedEvent {
            trust_pay: trust_pay_key,
            payer: payer_key,
            recipient: recipient_key,
            total_amount: ctx.accounts.trust_pay.total_contract_amount,
            completed_at: Clock::get()?.unix_timestamp,
        });

        msg!("Contract completed and closed successfully");
    }

    msg!(
        "Milestone {} approved: {} tokens transferred to recipient, {} fee collected",
        milestone_index,
        milestone_amount,
        fee_amount
    );

    Ok(())
}
