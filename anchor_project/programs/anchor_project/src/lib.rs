use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub use instructions::*;
pub mod state;
pub use state::*;
pub mod constants;
pub use constants::*;
pub mod events;
pub use events::*;

declare_id!("CtvFQBDX6GdgDL5tS8spw7rZomT2ZwAxm6C9UaEe6hxo");

#[program]
pub mod anchor_project {
    use super::*;

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
        milestone_inputs: Vec<create_contract::MilestoneInput>,
        deadline_duration_seconds: u64,
    ) -> Result<()> {
        create_contract::create_contract(
            ctx,
            seed,
            creator_role,
            payer_pubkey,
            other_party,
            contract_type,
            title,
            terms_and_conditions,
            total_amount,
            milestone_inputs,
            deadline_duration_seconds,
        )
    }

    pub fn cancel_contract(ctx: Context<CancelContract>) -> Result<()> {
        cancel_contract::cancel_contract(ctx)
    }

    pub fn accept_contract(
        ctx: Context<AcceptContract>,
        deadline_duration_seconds: u64,
    ) -> Result<()> {
        accept_contract::accept_contract(ctx, deadline_duration_seconds)
    }

    pub fn decline_contract(ctx: Context<DeclineContract>) -> Result<()> {
        decline_contract::decline_contract(ctx)
    }

    pub fn mark_milestone_complete(
        ctx: Context<MarkMilestoneComplete>,
        milestone_index: u8,
    ) -> Result<()> {
        mark_as_complete::mark_milestone_complete(ctx, milestone_index)
    }

    pub fn approve_milestone_payment(
        ctx: Context<ApproveMilestonePayment>,
        milestone_index: u8,
    ) -> Result<()> {
        approve_payment::approve_milestone_payment(ctx, milestone_index)
    }

    pub fn dispute_contract(
        ctx: Context<DisputeContract>,
        milestone_index: u8,
        dispute_reason: String,
    ) -> Result<()> {
        dispute_contract::dispute_contract(ctx, milestone_index, dispute_reason)
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        milestone_index: u8,
        resolution: u8,
        resolution_reason: String,
    ) -> Result<()> {
        resolve_dispute::resolve_dispute(ctx, milestone_index, resolution, resolution_reason)
    }
}
