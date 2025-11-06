use anchor_lang::prelude::*;

declare_id!("GPckXY3ag2wYLkUAriq4Cmpa4yZNRr7SM7YXKR2KNd5N");

#[program]
pub mod anchor_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
