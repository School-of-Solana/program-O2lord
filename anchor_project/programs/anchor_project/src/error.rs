use anchor_lang::prelude::*;

#[error_code]
pub enum TrustPayError {
    #[msg("Custom error message")]
    CustomError,
    #[msg("Invalid amount specified.")]
    InvalidAmount,
    #[msg("Contract title is too long (max 100 characters).")]
    TitleTooLong,
    #[msg("No milestones provided for the contract.")]
    NoMilestonesProvided,
    #[msg("Too many milestones (max 10 allowed).")]
    TooManyMilestones,
    #[msg("Invalid deadline specified.")]
    InvalidDeadline,
    #[msg("Dispute resolution mechanism description is too long (max 200 characters).")]
    DisputeResolutionTooLong,
    #[msg("Dispute resolution mechanism description is too long (max 200 characters).")]
    TermsAndConditionsTooLong,
    #[msg("Contract has not been accepted yet.")]
    ContractNotAccepted,
    #[msg("Milestone amounts do not sum to total contract amount.")]
    MilestoneAmountMismatch,
    #[msg("Calculation error occurred.")]
    CalculationError,
    #[msg("Contract is not in pending status.")]
    ContractNotPending,
    #[msg("Contract has expired.")]
    ContractExpired,
    #[msg("Contract is not in progress.")]
    ContractNotInProgress,
    #[msg("Contract is not in disputed status.")]
    ContractNotDisputed,
    #[msg("Invalid milestone index.")]
    InvalidMilestoneIndex,
    #[msg("Milestone is not in pending status.")]
    MilestoneNotPending,
    #[msg("Milestone is not completed by service provider.")]
    MilestoneNotCompleted,
    #[msg("Milestone is not disputable.")]
    MilestoneNotDisputable,
    #[msg("Milestone is not in disputed status.")]
    MilestoneNotDisputed,
    #[msg("Invalid dispute reason.")]
    InvalidDisputeReason,
    #[msg("Invalid resolution value.")]
    InvalidResolution,
    #[msg("Deadlin is too far.")]
    DeadlineTooFar,
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("Only the payer or recipient can dispute a milestone.")]
    UnauthorizedDisputer,
    #[msg("Only an authorized resolver can resolve a dispute.")]
    UnauthorizedResolver,
    #[msg("Invalid role specified. Must be 0 (payer) or 1 (recipient).")]
    InvalidRole,
    #[msg("Invalid contract type. Must be 0 (one-time payment) or 1 (milestone payment).")]
    InvalidContractType,
    #[msg("Payer Mismatch")]
    PayerMismatch,
}
