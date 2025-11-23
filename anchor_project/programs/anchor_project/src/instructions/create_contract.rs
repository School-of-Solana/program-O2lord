use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::error::TrustPayError;
use crate::instructions::shared::*;
use crate::state::*;
use crate::constants::*;
use crate::GlobalState;

#[derive(Accounts)]
#[instruction(
    seed: u64,
    creator_role: u8,
    payer_pubkey: Pubkey,  
    other_party: Pubkey,
    contract_type: u8,
    title: String,
    terms_and_conditions: String,
    total_amount: u64,
    milestones: Vec<MilestoneInput>,    
    deadline_duration_seconds: u64,
)]
pub struct CreateContract<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
    init_if_needed,
    payer = creator,
    associated_token::mint = mint,
    associated_token::authority = creator,
    associated_token::token_program = token_program
    )]
    pub creator_token_account: Box<InterfaceAccount<'info, TokenAccount>>,


    #[account(
        init,
        payer = creator,
        space = ANCHOR_DISCRIMINATOR + TrustPay::INIT_SPACE,
        seeds = [b"trust-pay", payer_pubkey.as_ref(), seed.to_le_bytes().as_ref()],
        bump
    )]
    pub trust_pay: Box<Account<'info, TrustPay>>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = trust_pay,
        associated_token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: This is the fee destination account, validated in the instruction
    pub fee_destination: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = creator,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [b"global-state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MilestoneInput {
    pub description: String,
    pub amount: u64,
}

pub fn create_contract(
    ctx: Context<CreateContract>,
    seed: u64,
    creator_role: u8,
    payer_pubkey: Pubkey,
    other_party: Pubkey,
    contract_type: u8,
    title: String,
    terms_and_conditions: String, 
    total_amount: u64,
    milestone_inputs: Vec<MilestoneInput>,
    deadline_duration_seconds: u64,
) -> Result<()> {
    // Validations
    let creator = ctx.accounts.creator.key();
    let (payer, recipient) = match creator_role {
        ROLE_PAYER => (creator, other_party),
        ROLE_RECIPIENT => (other_party, creator),
        _ => return Err(TrustPayError::InvalidRole.into()),
    };

    require!(
        payer == payer_pubkey,
        TrustPayError::PayerMismatch 
    );

    require!(
        creator_role == ROLE_PAYER || creator_role == ROLE_RECIPIENT,
        TrustPayError::InvalidRole
    );
    require!(
        contract_type == CONTRACT_TYPE_ONE_TIME || contract_type == CONTRACT_TYPE_MILESTONE,
        TrustPayError::InvalidContractType
    );

    require!(total_amount > 0, TrustPayError::InvalidAmount);
    require!(
        terms_and_conditions.len() > 0 && terms_and_conditions.len() <= 200,
        TrustPayError::TermsAndConditionsTooLong
    );
    require!(title.len() <= 50, TrustPayError::TitleTooLong);
    require!(
        deadline_duration_seconds > 0,
        TrustPayError::InvalidDeadline
    );

    // Determine who is payer and who is recipient
    let creator = ctx.accounts.creator.key();
    let (payer, recipient) = match creator_role {
        ROLE_PAYER => (creator, other_party),
        ROLE_RECIPIENT => (other_party, creator),
        _ => return Err(TrustPayError::InvalidRole.into()),
    };

    // Validate milestones based on contract type
    if contract_type == CONTRACT_TYPE_MILESTONE {
        require!(
            milestone_inputs.len() > 0,
            TrustPayError::NoMilestonesProvided
        );
        require!(
            milestone_inputs.len() <= 10,
            TrustPayError::TooManyMilestones
        );
        let milestone_total: u64 = milestone_inputs.iter().map(|m| m.amount).sum();
        require!(
            milestone_total == total_amount,
            TrustPayError::MilestoneAmountMismatch
        );
    } else {
        // For one-time payment, milestones should be empty or we auto-create one
        require!(
            milestone_inputs.len() == 0,
            TrustPayError::TooManyMilestones
        );
    }

    //Fee percentage
    let fee_percentage: u16 = 5;
    let fee_destination = ctx.accounts.fee_destination.key();

    // Calculate fee amount
    let fee_amount = total_amount
        .checked_mul(fee_percentage as u64)
        .ok_or(TrustPayError::CalculationError)?
        .checked_div(10000)
        .ok_or(TrustPayError::CalculationError)?;

    // Transfer tokens to vault
    let total_deposit = total_amount
        .checked_add(fee_amount)
        .ok_or(TrustPayError::CalculationError)?;

    // Only deposit tokens if creator is the payer
    let should_deposit = creator_role == ROLE_PAYER;
    let contract_status = if should_deposit {
        // Transfer tokens to vault
        transfer_tokens(
            &ctx.accounts.creator_token_account,
            &ctx.accounts.vault,
            &total_deposit,
            &ctx.accounts.mint,
            &ctx.accounts.creator,
            &ctx.accounts.token_program,
        )?;
        CONTRACT_STATUS_IN_PROGRESS
    } else {
        // Don't transfer yet, waiting for payer to accept
        CONTRACT_STATUS_PENDING
    };

    // Create milestones
    let milestones: Vec<Milestone> = if contract_type == CONTRACT_TYPE_MILESTONE {
        milestone_inputs
            .into_iter()
            .map(|input| Milestone {
                description: input.description,
                amount: input.amount,
                status: MILESTONE_STATUS_PENDING,
                completed_at: None,
                approved_at: None,
                dispute_reason: None,
                dispute_id: None,
            })
            .collect()
    } else {
        // For one-time payment, create a single milestone
        vec![Milestone {
            description: "One-time payment".to_string(),
            amount: total_amount,
            status: MILESTONE_STATUS_PENDING,
            completed_at: None,
            approved_at: None,
            dispute_reason: None,
            dispute_id: None,
        }]
    };

    // Calculate deadline timestamp
    let clock = Clock::get()?;

    // Initialize global state if needed
    initialize_global_state_if_needed(
        &mut ctx.accounts.global_state,
        &ctx.accounts.creator,
        &ctx.accounts.mint,
        ctx.bumps.global_state,
    );

    // Initialize TrustPay contract
    ctx.accounts.trust_pay.set_inner(TrustPay {
        seed,
        contract_type,
        payer,
        recipient,
        mint: ctx.accounts.mint.key(),
        title: title.clone(),
        terms_and_conditions: terms_and_conditions.clone(),
        total_contract_amount: total_amount,
        deadline: if should_deposit { 
        Some(clock.unix_timestamp.checked_add(deadline_duration_seconds as i64).ok_or(TrustPayError::CalculationError)? as u64) 
            } else { 
                None 
            },
            acceptance_timestamp: if should_deposit { Some(clock.unix_timestamp) } else { None },

        contract_status,
        fee_percentage,
        fee_destination,
        fee: fee_amount,
        milestones,
        bump: ctx.bumps.trust_pay,
    });

    // Update global statistics
    let global_state = &mut ctx.accounts.global_state;
    global_state.total_trust_pay_created += 1;

    // Emit event
    emit!(crate::ContractCreatedEvent {
        trust_pay: ctx.accounts.trust_pay.key(),
        payer,
        recipient,
        mint: ctx.accounts.mint.key(),
        title,
        total_amount,
        milestone_count: ctx.accounts.trust_pay.milestones.len() as u8,
        deadline: deadline_duration_seconds as i64,
        fee_percentage,
        fee_destination,
    });

    msg!(
        "TrustPay contract created by {}: {} tokens {}, {} milestones, payer: {}, recipient: {}, deadline: {}",
        if creator_role == ROLE_PAYER { "payer" } else { "recipient" },
        total_deposit,
        if should_deposit { "deposited" } else { "pending deposit" },
        ctx.accounts.trust_pay.milestones.len(),
        payer,
        recipient,
        deadline_duration_seconds

    );

    Ok(())
}

fn initialize_global_state_if_needed(
    global_state: &mut Account<GlobalState>,
    payer: &Signer,
    mint: &InterfaceAccount<Mint>,
    bump: u8,
) {
    if global_state.total_trust_pay_created == 0
        && global_state.total_trust_pay_closed == 0
        && global_state.total_confirmations == 0
    {
        // In testing mode, the payer is used as authority
        
        let authority = payer.key();
        
        //TODO: use the RESOLVER_AUTHORITY
        // In production, the hardcoded RESOLVER_AUTHORITY is the authority        
        //let authority = crate::RESOLVER_AUTHORITY;
        
        global_state.authority = authority;
        global_state.total_trust_pay_created = 0;
        global_state.total_trust_pay_closed = 0;
        global_state.total_confirmations = 0;
        global_state.total_volume = 0;
        global_state.high_watermark_volume = 0;
        global_state.last_volume_update = Clock::get().unwrap().unix_timestamp;
        global_state.token_decimals = mint.decimals;
        global_state.total_disputes = 0;
        global_state.bump = bump;

        msg!("Global state initialized with resolver authority: {}", authority);
    }
}