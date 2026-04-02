use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DPIdo1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// DPINO Staking program ID (for tier CPI read, cross-program check)
pub const STAKING_PROGRAM_ID: &str = "DPStak1ngXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

/// Protocol fee to DPINO treasury: 50 bps = 0.5%
pub const PROTOCOL_FEE_BPS: u64 = 50;
pub const BPS_DENOMINATOR: u64  = 10_000;

/// Maximum project name length (UTF-8 bytes)
pub const MAX_NAME_LEN: usize = 64;

/// Tier constants (must match staking program)
pub const TIER_NONE:      u8 = 0;
pub const TIER_SOLDIER:   u8 = 1;
pub const TIER_GENERAL:   u8 = 2;
pub const TIER_DARK_LORD: u8 = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod dpino_ido {
    use super::*;

    // ──────────────────────────────────────────────────────────────────────────
    // Admin: Create an IDO
    // ──────────────────────────────────────────────────────────────────────────

    /// Initialize a new IDO pool. Called by the DPINO Launchpad admin.
    pub fn initialize_ido(
        ctx:    Context<InitializeIdo>,
        params: IdoParams,
    ) -> Result<()> {
        params.validate()?;

        let ido = &mut ctx.accounts.ido_pool;

        ido.authority          = ctx.accounts.authority.key();
        ido.project_name       = params.project_name;
        ido.token_price_lamports = params.token_price_lamports;
        ido.hard_cap_lamports  = params.hard_cap_lamports;
        ido.soft_cap_lamports  = params.soft_cap_lamports;
        ido.start_time         = params.start_time;
        ido.end_time           = params.end_time;
        ido.min_allocation_lamports = params.min_allocation_lamports;
        ido.max_allocation_lamports = params.max_allocation_lamports;
        ido.min_tier_required  = params.min_tier_required;
        ido.total_raised_lamports = 0;
        ido.participants       = 0;
        ido.token_mint         = None;
        ido.is_finalized       = false;
        ido.tokens_distributed = false;
        ido.bump               = ctx.bumps.ido_pool;

        msg!(
            "IDO '{}' created. Hard cap={}L Soft cap={}L Start={} End={}",
            ido.project_name,
            ido.hard_cap_lamports,
            ido.soft_cap_lamports,
            ido.start_time,
            ido.end_time,
        );
        Ok(())
    }

    /// Admin sets the token mint after TGE so users can claim.
    pub fn set_token_mint(ctx: Context<AdminIdo>) -> Result<()> {
        let ido = &mut ctx.accounts.ido_pool;
        require!(ido.is_finalized, IdoError::NotFinalized);
        ido.token_mint = Some(ctx.accounts.token_mint.key());
        msg!("Token mint set: {}", ctx.accounts.token_mint.key());
        Ok(())
    }

    /// Admin finalizes the IDO (locks it from new participants).
    pub fn finalize_ido(ctx: Context<AdminIdoNoMint>) -> Result<()> {
        let ido = &mut ctx.accounts.ido_pool;
        require!(!ido.is_finalized, IdoError::AlreadyFinalized);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= ido.end_time, IdoError::IdoStillActive);
        ido.is_finalized = true;
        msg!("IDO '{}' finalized. Raised {}L over {} participants.",
            ido.project_name, ido.total_raised_lamports, ido.participants);
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // User: Participate
    // ──────────────────────────────────────────────────────────────────────────

    /// Contribute SOL to an active IDO.
    /// The user's `staking_position` account is passed to verify tier gating.
    pub fn participate(ctx: Context<Participate>, amount_lamports: u64) -> Result<()> {
        let ido = &mut ctx.accounts.ido_pool;
        let now = Clock::get()?.unix_timestamp;

        // Timing checks
        require!(now >= ido.start_time, IdoError::IdoNotStarted);
        require!(now <= ido.end_time,   IdoError::IdoEnded);
        require!(!ido.is_finalized,     IdoError::AlreadyFinalized);

        // Hard cap check
        require!(
            ido.total_raised_lamports.saturating_add(amount_lamports) <= ido.hard_cap_lamports,
            IdoError::HardCapExceeded
        );

        // Allocation checks
        require!(amount_lamports >= ido.min_allocation_lamports, IdoError::BelowMinAllocation);
        require!(amount_lamports <= ido.max_allocation_lamports, IdoError::ExceedsMaxAllocation);

        // Tier gating: if IDO requires a minimum tier, verify on-chain staking position
        if ido.min_tier_required > TIER_NONE {
            let user_tier = ctx.accounts.staking_position.as_ref()
                .map(|p| p.tier)
                .unwrap_or(TIER_NONE);
            require!(user_tier >= ido.min_tier_required, IdoError::InsufficientTier);
        }

        // Idempotency: if user already has an allocation, add to it
        let allocation = &mut ctx.accounts.user_allocation;
        let new_total  = allocation.amount_paid_lamports.saturating_add(amount_lamports);
        require!(new_total <= ido.max_allocation_lamports, IdoError::ExceedsMaxAllocation);

        // Transfer SOL from user → IDO vault (PDA)
        let cpi_ctx = anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to:   ctx.accounts.ido_vault.to_account_info(),
        };
        anchor_lang::system_program::transfer(
            CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_ctx),
            amount_lamports,
        )?;

        // Collect protocol fee in a separate vault
        let fee = compute_fee(amount_lamports);
        if fee > 0 {
            let fee_cpi = anchor_lang::system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to:   ctx.accounts.protocol_fee_vault.to_account_info(),
            };
            anchor_lang::system_program::transfer(
                CpiContext::new(ctx.accounts.system_program.to_account_info(), fee_cpi),
                fee,
            )?;
        }

        // Update allocation state
        if allocation.ido == Pubkey::default() {
            allocation.owner  = ctx.accounts.user.key();
            allocation.ido    = ido.key();
            allocation.bump   = ctx.bumps.user_allocation;
            ido.participants  = ido.participants.saturating_add(1);
        }
        allocation.amount_paid_lamports = new_total;

        ido.total_raised_lamports = ido.total_raised_lamports.saturating_add(amount_lamports);

        msg!(
            "Participation: {} contributed {}L (+{}L fee). IDO total: {}L",
            ctx.accounts.user.key(),
            amount_lamports,
            fee,
            ido.total_raised_lamports,
        );
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // User: Claim tokens after TGE
    // ──────────────────────────────────────────────────────────────────────────

    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let ido        = &ctx.accounts.ido_pool;
        let allocation = &mut ctx.accounts.user_allocation;

        require!(ido.is_finalized,          IdoError::NotFinalized);
        require!(ido.token_mint.is_some(),   IdoError::TokenMintNotSet);
        require!(!allocation.tokens_claimed, IdoError::AlreadyClaimed);
        require!(
            ido.total_raised_lamports >= ido.soft_cap_lamports,
            IdoError::SoftCapNotMet
        );

        // Calculate tokens owed: paid_lamports / token_price_lamports
        let tokens_owed = (allocation.amount_paid_lamports as u128)
            .checked_mul(10u128.pow(ctx.accounts.token_mint.decimals as u32))
            .and_then(|n| n.checked_div(ido.token_price_lamports as u128))
            .ok_or(IdoError::MathOverflow)? as u64;

        require!(tokens_owed > 0, IdoError::NoTokensToClaim);

        // Transfer tokens from distribution vault → user via PDA signer
        let ido_key = ido.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"ido_pool",
            ido_key.as_ref(),
            &[ido.bump],
        ]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.distribution_vault.to_account_info(),
                to:        ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.ido_pool.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, tokens_owed)?;

        allocation.tokens_claimed = true;

        msg!("Claimed {} tokens for {}", tokens_owed, ctx.accounts.user.key());
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // User: Refund (if soft cap not met after end)
    // ──────────────────────────────────────────────────────────────────────────

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let ido        = &ctx.accounts.ido_pool;
        let allocation = &mut ctx.accounts.user_allocation;

        require!(ido.is_finalized,  IdoError::NotFinalized);
        require!(!allocation.refunded, IdoError::AlreadyRefunded);
        require!(
            ido.total_raised_lamports < ido.soft_cap_lamports,
            IdoError::SoftCapMet
        );

        let refund_amount = allocation.amount_paid_lamports;
        require!(refund_amount > 0, IdoError::NothingToRefund);

        // Return SOL from IDO vault → user via PDA signer
        **ctx.accounts.ido_vault.to_account_info().try_borrow_mut_lamports()? =
            ctx.accounts.ido_vault.to_account_info().lamports()
                .checked_sub(refund_amount)
                .ok_or(IdoError::MathOverflow)?;

        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? =
            ctx.accounts.user.to_account_info().lamports()
                .checked_add(refund_amount)
                .ok_or(IdoError::MathOverflow)?;

        allocation.refunded = true;

        msg!("Refunded {}L to {}", refund_amount, ctx.accounts.user.key());
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin: Withdraw raised SOL
    // ──────────────────────────────────────────────────────────────────────────

    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        let ido = &ctx.accounts.ido_pool;
        require!(ido.is_finalized, IdoError::NotFinalized);
        require!(
            ido.total_raised_lamports >= ido.soft_cap_lamports,
            IdoError::SoftCapNotMet
        );

        let vault_balance = ctx.accounts.ido_vault.to_account_info().lamports();

        **ctx.accounts.ido_vault.to_account_info().try_borrow_mut_lamports()? = 0;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? =
            ctx.accounts.authority.to_account_info().lamports()
                .checked_add(vault_balance)
                .ok_or(IdoError::MathOverflow)?;

        msg!("Withdrew {}L from IDO '{}'", vault_balance, ido.project_name);
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn compute_fee(amount: u64) -> u64 {
    amount.saturating_mul(PROTOCOL_FEE_BPS) / BPS_DENOMINATOR
}

// ─────────────────────────────────────────────────────────────────────────────
// Params
// ─────────────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct IdoParams {
    pub project_name:              String,
    pub token_price_lamports:      u64,  // SOL lamports per 1 token
    pub hard_cap_lamports:         u64,  // maximum total raise in lamports
    pub soft_cap_lamports:         u64,  // minimum to consider IDO successful
    pub start_time:                i64,  // unix timestamp
    pub end_time:                  i64,  // unix timestamp
    pub min_allocation_lamports:   u64,
    pub max_allocation_lamports:   u64,
    pub min_tier_required:         u8,   // 0=none 1=soldier 2=general 3=dark_lord
}

impl IdoParams {
    fn validate(&self) -> Result<()> {
        require!(!self.project_name.is_empty(),                   IdoError::InvalidParams);
        require!(self.project_name.len() <= MAX_NAME_LEN,         IdoError::InvalidParams);
        require!(self.token_price_lamports > 0,                   IdoError::InvalidParams);
        require!(self.hard_cap_lamports > 0,                      IdoError::InvalidParams);
        require!(self.soft_cap_lamports <= self.hard_cap_lamports, IdoError::InvalidParams);
        require!(self.end_time > self.start_time,                  IdoError::InvalidParams);
        require!(self.min_allocation_lamports > 0,                IdoError::InvalidParams);
        require!(self.max_allocation_lamports >= self.min_allocation_lamports, IdoError::InvalidParams);
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account Structs
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(params: IdoParams)]
pub struct InitializeIdo<'info> {
    #[account(
        init,
        payer = authority,
        space = IdoPool::LEN,
        seeds = [b"ido_pool", params.project_name.as_bytes()],
        bump
    )]
    pub ido_pool: Account<'info, IdoPool>,

    /// SOL vault — holds contributed funds
    #[account(
        init,
        payer = authority,
        space = 8,
        seeds = [b"ido_vault", params.project_name.as_bytes()],
        bump
    )]
    pub ido_vault: SystemAccount<'info>,

    /// Protocol fee vault — 0.5% goes here, flows to DPINO buyback/LP
    #[account(
        init,
        payer = authority,
        space = 8,
        seeds = [b"protocol_fee_vault"],
        bump
    )]
    pub protocol_fee_vault: SystemAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminIdo<'info> {
    #[account(
        mut,
        has_one = authority @ IdoError::Unauthorized
    )]
    pub ido_pool: Account<'info, IdoPool>,

    pub token_mint: Account<'info, Mint>,
    pub authority:  Signer<'info>,
}

#[derive(Accounts)]
pub struct AdminIdoNoMint<'info> {
    #[account(
        mut,
        has_one = authority @ IdoError::Unauthorized
    )]
    pub ido_pool:  Account<'info, IdoPool>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Participate<'info> {
    #[account(
        mut,
        seeds = [b"ido_pool", ido_pool.project_name.as_bytes()],
        bump  = ido_pool.bump
    )]
    pub ido_pool: Account<'info, IdoPool>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserAllocation::LEN,
        seeds = [b"allocation", ido_pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_allocation: Account<'info, UserAllocation>,

    /// IDO SOL vault
    #[account(
        mut,
        seeds = [b"ido_vault", ido_pool.project_name.as_bytes()],
        bump
    )]
    pub ido_vault: SystemAccount<'info>,

    /// Protocol fee vault
    #[account(
        mut,
        seeds = [b"protocol_fee_vault"],
        bump
    )]
    pub protocol_fee_vault: SystemAccount<'info>,

    /// Optional: user's DPINO staking position for tier gating.
    /// Pass a dummy account (or None via remaining_accounts) if no gating.
    pub staking_position: Option<Account<'info, StakingPositionExternal>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// We only need the `tier` field from the staking program's StakingPosition.
/// This is a zero-copy read — we deserialize just the fields we need.
#[account]
pub struct StakingPositionExternal {
    pub owner:                 Pubkey,
    pub pool:                  Pubkey,
    pub amount_staked:         u64,
    pub start_time:            i64,
    pub unstake_initiated_at:  i64,
    pub tier:                  u8,
    pub rewards_earned:        u64,
    pub last_claim_time:       i64,
    pub bump:                  u8,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(
        seeds = [b"ido_pool", ido_pool.project_name.as_bytes()],
        bump  = ido_pool.bump
    )]
    pub ido_pool: Account<'info, IdoPool>,

    #[account(
        mut,
        seeds = [b"allocation", ido_pool.key().as_ref(), user.key().as_ref()],
        bump  = user_allocation.bump,
        constraint = user_allocation.owner == user.key() @ IdoError::Unauthorized
    )]
    pub user_allocation: Account<'info, UserAllocation>,

    /// Token mint (must match ido_pool.token_mint)
    #[account(
        constraint = Some(token_mint.key()) == ido_pool.token_mint @ IdoError::TokenMintNotSet
    )]
    pub token_mint: Account<'info, Mint>,

    /// Distribution vault — project team deposits tokens here for claiming
    #[account(
        mut,
        seeds = [b"dist_vault", ido_pool.key().as_ref()],
        bump
    )]
    pub distribution_vault: Account<'info, TokenAccount>,

    /// User's token account to receive purchased tokens
    #[account(
        mut,
        constraint = user_token_account.mint  == token_mint.key() @ IdoError::InvalidMint,
        constraint = user_token_account.owner == user.key()        @ IdoError::Unauthorized
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user:          Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        seeds = [b"ido_pool", ido_pool.project_name.as_bytes()],
        bump  = ido_pool.bump
    )]
    pub ido_pool: Account<'info, IdoPool>,

    #[account(
        mut,
        seeds = [b"allocation", ido_pool.key().as_ref(), user.key().as_ref()],
        bump  = user_allocation.bump,
        constraint = user_allocation.owner == user.key() @ IdoError::Unauthorized
    )]
    pub user_allocation: Account<'info, UserAllocation>,

    #[account(
        mut,
        seeds = [b"ido_vault", ido_pool.project_name.as_bytes()],
        bump
    )]
    pub ido_vault: SystemAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(
        has_one = authority @ IdoError::Unauthorized,
        seeds   = [b"ido_pool", ido_pool.project_name.as_bytes()],
        bump    = ido_pool.bump
    )]
    pub ido_pool: Account<'info, IdoPool>,

    #[account(
        mut,
        seeds = [b"ido_vault", ido_pool.project_name.as_bytes()],
        bump
    )]
    pub ido_vault: SystemAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

#[account]
pub struct IdoPool {
    pub authority:                Pubkey,        // 32
    pub project_name:             String,        // 4 + 64
    pub token_price_lamports:     u64,           // 8
    pub hard_cap_lamports:        u64,           // 8
    pub soft_cap_lamports:        u64,           // 8
    pub start_time:               i64,           // 8
    pub end_time:                 i64,           // 8
    pub min_allocation_lamports:  u64,           // 8
    pub max_allocation_lamports:  u64,           // 8
    pub min_tier_required:        u8,            // 1
    pub total_raised_lamports:    u64,           // 8
    pub participants:             u32,           // 4
    pub token_mint:               Option<Pubkey>,// 1 + 32
    pub is_finalized:             bool,          // 1
    pub tokens_distributed:       bool,          // 1
    pub bump:                     u8,            // 1
}

impl IdoPool {
    pub const LEN: usize = 8   // discriminator
        + 32               // authority
        + 4 + 64           // project_name (String)
        + 8                // token_price_lamports
        + 8                // hard_cap_lamports
        + 8                // soft_cap_lamports
        + 8                // start_time
        + 8                // end_time
        + 8                // min_allocation_lamports
        + 8                // max_allocation_lamports
        + 1                // min_tier_required
        + 8                // total_raised_lamports
        + 4                // participants
        + 1 + 32           // token_mint (Option<Pubkey>)
        + 1                // is_finalized
        + 1                // tokens_distributed
        + 1                // bump
        + 64;              // headroom
}

#[account]
pub struct UserAllocation {
    pub owner:                  Pubkey,  // 32
    pub ido:                    Pubkey,  // 32
    pub amount_paid_lamports:   u64,     // 8
    pub tokens_claimed:         bool,    // 1
    pub refunded:               bool,    // 1
    pub bump:                   u8,      // 1
}

impl UserAllocation {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1 + 32; // +32 headroom
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum IdoError {
    #[msg("IDO has not started yet")]
    IdoNotStarted,
    #[msg("IDO has ended")]
    IdoEnded,
    #[msg("IDO is still active — cannot finalize yet")]
    IdoStillActive,
    #[msg("IDO has already been finalized")]
    AlreadyFinalized,
    #[msg("IDO is not yet finalized")]
    NotFinalized,
    #[msg("Hard cap would be exceeded")]
    HardCapExceeded,
    #[msg("Amount is below the minimum allocation")]
    BelowMinAllocation,
    #[msg("Amount exceeds the maximum allocation")]
    ExceedsMaxAllocation,
    #[msg("Your DPINO staking tier is too low to participate in this IDO")]
    InsufficientTier,
    #[msg("Soft cap has not been met — use refund instead")]
    SoftCapNotMet,
    #[msg("Soft cap was met — refunds are not available")]
    SoftCapMet,
    #[msg("Tokens have already been claimed")]
    AlreadyClaimed,
    #[msg("Refund has already been processed")]
    AlreadyRefunded,
    #[msg("Nothing to refund")]
    NothingToRefund,
    #[msg("Token mint has not been set yet")]
    TokenMintNotSet,
    #[msg("No tokens available to claim")]
    NoTokensToClaim,
    #[msg("Token mint mismatch")]
    InvalidMint,
    #[msg("Invalid IDO parameters")]
    InvalidParams,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Unauthorized")]
    Unauthorized,
}
