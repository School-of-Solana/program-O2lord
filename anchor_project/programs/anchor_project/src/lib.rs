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

declare_id!("GPckXY3ag2wYLkUAriq4Cmpa4yZNRr7SM7YXKR2KNd5N");

#[program]
pub mod anchor_project {
    use super::*;

    pub fn create_contract(
        ctx: Context<CreateContract>,
        seed: u64,
        creator_role: u8,
        other_party: Pubkey,
        contract_type: u8,
        title: String,
        total_amount: u64,
        milestone_inputs: Vec<create_contract::MilestoneInput>,
        deadline_duration_seconds: u64,
    ) -> Result<()> {
        create_contract::create_contract(
            ctx,
            seed,
            creator_role,
            other_party,
            contract_type,
            title,
            total_amount,
            milestone_inputs,
            deadline_duration_seconds,
        )
    }
}
