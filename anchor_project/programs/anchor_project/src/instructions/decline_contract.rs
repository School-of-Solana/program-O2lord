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
use crate::state::TrustPay;

#[derive(Accounts)]
pub struct DeclineContract<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: recipient account validated through has_one constraint
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        has_one = payer,
        has_one = recipient,
        has_one = mint,
        seeds = [b"trust-pay", payer.key().as_ref(), trust_pay.seed.to_le_bytes().as_ref()],
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

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program
    )]
    pub recipient_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn decline_contract(ctx: Context<DeclineContract>) -> Result<()> {
    let trust_pay_seed = ctx.accounts.trust_pay.seed;
    let trust_pay_bump = ctx.accounts.trust_pay.bump;
    let trust_pay_key = ctx.accounts.trust_pay.key();
    let payer_key = ctx.accounts.payer.key();
    let recipient_key = ctx.accounts.recipient.key();
    let mint_decimals = ctx.accounts.mint.decimals;

    // Create PDA signer seeds
    let seeds = &[
        b"trust-pay",
        payer_key.as_ref(),
        &trust_pay_seed.to_le_bytes()[..],
        &[trust_pay_bump],
    ];
    let signer_seeds = [&seeds[..]];

    // Check if there are any tokens in the vault (recipient may have deposited)
    ctx.accounts.vault.reload()?;
    let vault_balance = ctx.accounts.vault.amount;

    // If there are tokens in vault, refund them to the recipient who deposited
    if vault_balance > 0 {
        let vault_info = ctx.accounts.vault.to_account_info();
        let recipient_token_account_info = ctx.accounts.recipient_token_account.to_account_info();
        let mint_info = ctx.accounts.mint.to_account_info();
        let trust_pay_info = ctx.accounts.trust_pay.to_account_info();
        let token_program_info = ctx.accounts.token_program.to_account_info();

        // Transfer all tokens back to recipient
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

        transfer_checked(transfer_ctx, vault_balance, mint_decimals)?;

        msg!(
            "Refunded {} tokens to recipient {}",
            vault_balance,
            recipient_key
        );
    }

    // Close vault account
    let close_accounts = CloseAccount {
        account: ctx.accounts.vault.to_account_info(),
        destination: ctx.accounts.payer.to_account_info(),
        authority: ctx.accounts.trust_pay.to_account_info(),
    };

    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        close_accounts,
        &signer_seeds,
    );

    close_account(close_ctx)?;

    // Close TrustPay account and return rent to payer
    let payer_starting_lamports = ctx.accounts.payer.lamports();
    let trust_pay_lamports = ctx.accounts.trust_pay.to_account_info().lamports();

    **ctx.accounts.payer.lamports.borrow_mut() = payer_starting_lamports
        .checked_add(trust_pay_lamports)
        .ok_or(TrustPayError::CalculationError)?;
    **ctx
        .accounts
        .trust_pay
        .to_account_info()
        .lamports
        .borrow_mut() = 0;

    // Zero out account data
    let trust_pay_info = ctx.accounts.trust_pay.to_account_info();
    let mut trust_pay_data = trust_pay_info.try_borrow_mut_data()?;
    for byte in trust_pay_data.iter_mut() {
        *byte = 0;
    }

    // Emit contract declined event
    emit!(crate::ContractDeclinedEvent {
        trust_pay: trust_pay_key,
        payer: payer_key,
        recipient: recipient_key,
        total_amount: ctx.accounts.trust_pay.total_contract_amount,
        refunded_amount: vault_balance,
        declined_at: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Contract declined by payer: {}, refunded {} tokens, account closed",
        payer_key,
        vault_balance
    );

    Ok(())
}
