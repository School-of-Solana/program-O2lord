use anchor_lang::prelude::*;

// Contract type
pub const CONTRACT_TYPE_ONE_TIME: u8 = 0;
pub const CONTRACT_TYPE_MILESTONE: u8 = 1;

// Roles
pub const ROLE_PAYER: u8 = 0;
pub const ROLE_RECIPIENT: u8 = 1;

// One-time payment status constants
pub const CONTRACT_STATUS_PENDING: u8 = 0;
pub const CONTRACT_STATUS_IN_PROGRESS: u8 = 1;
pub const CONTRACT_STATUS_COMPLETED: u8 = 2;
pub const CONTRACT_STATUS_DISPUTED: u8 = 3;
pub const CONTRACT_STATUS_CANCELLED: u8 = 4;

// Milestone status constants
pub const MILESTONE_STATUS_PENDING: u8 = 0;
pub const MILESTONE_STATUS_COMPLETED_BY_SP: u8 = 1;
pub const MILESTONE_STATUS_APPROVED_BY_PAYER: u8 = 2;
pub const MILESTONE_STATUS_DISPUTED: u8 = 3;

// Constants
pub const ANCHOR_DISCRIMINATOR: usize = 8;
pub const RESOLVER_AUTHORITY: Pubkey = pubkey!("ack4hThDoBbzRqs13Nq7o3h1juM8UFJtQf6csS8ZaLR");
