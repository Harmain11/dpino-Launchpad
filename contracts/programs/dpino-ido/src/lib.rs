use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DPIdo1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// $DPINO token mint (mainnet)
pub const DPINO_MINT: &str = "4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy";

/// Protocol fee to DPINO/SOL LP on Raydium: 50 bps = 0.5%
pub const PROTOCOL_FEE_BPS: u64 = 50;
pub const BPS_DENOMINATOR:  u64 = 10_000;

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
    /// All caps and allocations are denominated in $DPINO (base units, 9 decimals).
    /// Users pay with $DPINO; fees go to the DPINO/SOL LP on Raydium.
    pub fn initialize_ido(
        ctx:    Context<InitializeIdo>,
        params: IdoParams,
    ) -> Result<()> {
        params.validate()?;

        let ido = &mut ctx.accounts.ido_pool;

        ido.authority             = ctx.accounts.authority.key();
        ido.dpino_mint            = ctx.accounts.dpino_mint.key();
        ido.project_name          = params.project_name;
        ido.token_price_dpino     = params.token_price_dpino;     // DPINO per 1 project token
        ido.hard_cap_dpino        = params.hard_cap_dpino;         // max DPINO to raise
        ido.soft_cap_dpino        = params.soft_cap_dpino;         // min DPINO for success
        ido.start_time            = params.start_time;
        ido.end_time              = params.end_time;
        ido.min_allocation_dpino  = params.min_allocation_dpino;  // min per user
        ido.max_allocation_dpino  = params.max_allocation_dpino;  // max per user
        ido.min_tier_required     = params.min_tier_required;
        ido.total_raised_dpino    = 0;
        ido.participants          = 0;
        ido.token_mint            = None;
        ido.is_finalized          = false;
        ido.tokens_distributed    = false;
        ido.bump                  = ctx.bumps.ido_pool;

        msg!(
            "IDO '{}' created. Hard cap={} DPINO Soft cap={} DPINO Start={} End={}",
            ido.project_name,
            ido.hard_cap_dpino,
            ido.soft_cap_dpino,
            ido.start_time,
            ido.end_time,
        );
        Ok(())
    }

    /// Admin sets the project token mint after TGE so users can claim.
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
        msg!(
            "IDO '{}' finalized. Raised {} DPINO over {} participants.",
            ido.project_name,
            ido.total_raised_dpino,
            ido.participants
        );
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // User: Participate — Pay with $DPINO
    // ──────────────────────────────────────────────────────────────────────────

    /// Contribute $DPINO to an active IDO.
    /// amount_dpino is in raw DPINO base units (divide by 10^9 for UI amount).
    ///
    /// Flow:
    ///   user's DPINO ATA → IDO vault (DPINO token account)
    ///   fee portion       → protocol fee vault (DPINO token account)
    ///   Both feed the DPINO/SOL LP on Raydium after IDO ends.
    pub fn participate(ctx: Context<Participate>, amount_dpino: u64) -> Result<()> {
        let ido = &mut ctx.accounts.ido_pool;
        let now = Clock::get()?.unix_timestamp;

        // Timing checks
        require!(now >= ido.start_time, IdoError::IdoNotStarted);
        require!(now <= ido.end_time,   IdoError::IdoEnded);
        require!(!ido.is_finalized,     IdoError::AlreadyFinalized);

        // Hard cap check
        require!(
            ido.total_raised_dpino.saturating_add(amount_dpino) <= ido.hard_cap_dpino,
            IdoError::HardCapExceeded
        );

        // Allocation checks
        require!(amount_dpino >= ido.min_allocation_dpino, IdoError::BelowMinAllocation);
        require!(amount_dpino <= ido.max_allocation_dpino, IdoError::ExceedsMaxAllocation);

        // Tier gating: if IDO requires a minimum tier, verify on-chain staking position
        if ido.min_tier_required > TIER_NONE {
            let user_tier = ctx.accounts.staking_position.as_ref()
                .map(|p| p.tier)
                .unwrap_or(TIER_NONE);
            require!(user_tier >= ido.min_tier_required, IdoError::InsufficientTier);
        }

        // Idempotency: if user already has an allocation, add to it
        let allocation  = &mut ctx.accounts.user_allocation;
        let new_total   = allocation.amount_paid_dpino.saturating_add(amount_dpino);
        require!(new_total <= ido.max_allocation_dpino, IdoError::ExceedsMaxAllocation);

        // Compute fee: 0.5% in DPINO → goes to protocol fee vault → Raydium LP
        let fee        = compute_fee(amount_dpino);
        let net_amount = amount_dpino.checked_sub(fee).ok_or(IdoError::MathOverflow)?;

        // Transfer net DPINO: user → IDO vault
        let cpi_net = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.user_dpino_ata.to_account_info(),
                to:        ctx.accounts.ido_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_net, net_amount)?;

        // Transfer fee DPINO: user → protocol fee vault (feeds DPINO/SOL LP)
        if fee > 0 {
            let cpi_fee = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.user_dpino_ata.to_account_info(),
                    to:        ctx.accounts.protocol_fee_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            );
            token::transfer(cpi_fee, fee)?;
        }

        // Update allocation state
        if allocation.ido == Pubkey::default() {
            allocation.owner  = ctx.accounts.user.key();
            allocation.ido    = ido.key();
            allocation.bump   = ctx.bumps.user_allocation;
            ido.participants  = ido.participants.saturating_add(1);
        }
        allocation.amount_paid_dpino = new_total;

        // Track net raised (excluding fee)
        ido.total_raised_dpino = ido.total_raised_dpino.saturating_add(net_amount);

        msg!(
            "IDO Participation: {} contributed {} DPINO (fee={} DPINO → LP). IDO total: {} DPINO",
            ctx.accounts.user.key(),
            amount_dpino,
            fee,
            ido.total_raised_dpino,
        );
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // User: Claim project tokens after TGE
    // ──────────────────────────────────────────────────────────────────────────

    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let ido        = &ctx.accounts.ido_pool;
        let allocation = &mut ctx.accounts.user_allocation;

        require!(ido.is_finalized,          IdoError::NotFinalized);
        require!(ido.token_mint.is_some(),   IdoError::TokenMintNotSet);
        require!(!allocation.tokens_claimed, IdoError::AlreadyClaimed);
        require!(
            ido.total_raised_dpino >= ido.soft_cap_dpino,
            IdoError::SoftCapNotMet
        );

        // Tokens owed: paid_dpino / token_price_dpino × project_token_decimals
        let tokens_owed = (allocation.amount_paid_dpino as u128)
            .checked_mul(10u128.pow(ctx.accounts.token_mint.decimals as u32))
            .and_then(|n| n.checked_div(ido.token_price_dpino as u128))
            .ok_or(IdoError::MathOverflow)? as u64;

        require!(tokens_owed > 0, IdoError::NoTokensToClaim);

        // Transfer project tokens from distribution vault → user via PDA signer
        let project_name_bytes = ido.project_name.as_bytes().to_vec();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"ido_pool",
            project_name_bytes.as_ref(),
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

        msg!("Claimed {} project tokens for {}", tokens_owed, ctx.accounts.user.key());
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // User: Refund $DPINO if soft cap not met
    // ──────────────────────────────────────────────────────────────────────────

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let ido        = &ctx.accounts.ido_pool;
        let allocation = &mut ctx.accounts.user_allocation;

        require!(ido.is_finalized,   IdoError::NotFinalized);
        require!(!allocation.refunded, IdoError::AlreadyRefunded);
        require!(
            ido.total_raised_dpino < ido.soft_cap_dpino,
            IdoError::SoftCapMet
        );

        // The 0.5% protocol fee is non-refundable (it was routed to the LP fee vault).
        // Refund = gross paid − fee = the exact net that sits in the IDO vault.
        let gross         = allocation.amount_paid_dpino;
        let fee           = compute_fee(gross);
        let refund_amount = gross.saturating_sub(fee);
        require!(refund_amount > 0, IdoError::NothingToRefund);

        // Transfer DPINO from IDO vault → user; sign as ido_pool PDA (vault authority)
        let project_name_bytes = ido.project_name.as_bytes().to_vec();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"ido_pool",
            project_name_bytes.as_ref(),
            &[ido.bump],
        ]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.ido_vault.to_account_info(),
                to:        ctx.accounts.user_dpino_ata.to_account_info(),
                authority: ctx.accounts.ido_pool.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, refund_amount)?;

        allocation.refunded = true;

        msg!(
            "Refunded {} DPINO to {} (gross={} fee={})",
            refund_amount,
            ctx.accounts.user.key(),
            gross,
            fee
        );
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin: Withdraw raised $DPINO (routes to DPINO/SOL LP on Raydium)
    // ──────────────────────────────────────────────────────────────────────────

    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        let ido = &ctx.accounts.ido_pool;
        require!(ido.is_finalized, IdoError::NotFinalized);
        require!(
            ido.total_raised_dpino >= ido.soft_cap_dpino,
            IdoError::SoftCapNotMet
        );

        let vault_balance = ctx.accounts.ido_vault.amount;

        // Transfer all DPINO from vault → authority; sign as ido_pool PDA (vault authority)
        let project_name_bytes = ido.project_name.as_bytes().to_vec();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"ido_pool",
            project_name_bytes.as_ref(),
            &[ido.bump],
        ]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.ido_vault.to_account_info(),
                to:        ctx.accounts.authority_dpino_ata.to_account_info(),
                authority: ctx.accounts.ido_pool.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, vault_balance)?;

        msg!(
            "Withdrew {} DPINO from IDO '{}'. Route to DPINO/SOL LP on Raydium.",
            vault_balance,
            ido.project_name
        );
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
    pub project_name:            String,
    pub token_price_dpino:       u64,  // DPINO base units per 1 project token
    pub hard_cap_dpino:          u64,  // max total DPINO to raise
    pub soft_cap_dpino:          u64,  // min DPINO for successful IDO
    pub start_time:              i64,  // unix timestamp
    pub end_time:                i64,  // unix timestamp
    pub min_allocation_dpino:    u64,  // min DPINO per participant
    pub max_allocation_dpino:    u64,  // max DPINO per participant
    pub min_tier_required:       u8,   // 0=none 1=soldier 2=general 3=dark_lord
}

impl IdoParams {
    fn validate(&self) -> Result<()> {
        require!(!self.project_name.is_empty(),                    IdoError::InvalidParams);
        require!(self.project_name.len() <= MAX_NAME_LEN,          IdoError::InvalidParams);
        require!(self.token_price_dpino > 0,                       IdoError::InvalidParams);
        require!(self.hard_cap_dpino > 0,                          IdoError::InvalidParams);
        require!(self.soft_cap_dpino <= self.hard_cap_dpino,       IdoError::InvalidParams);
        require!(self.end_time > self.start_time,                  IdoError::InvalidParams);
        require!(self.min_allocation_dpino > 0,                    IdoError::InvalidParams);
        require!(
            self.max_allocation_dpino >= self.min_allocation_dpino,
            IdoError::InvalidParams
        );
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

    /// The $DPINO mint — caller (authority signer) is responsible for passing
    /// the correct mint. On mainnet this must be DPINO_MINT; trustworthiness
    /// derives from the fact that only the launchpad admin calls initialize_ido.
    pub dpino_mint: Account<'info, Mint>,

    /// DPINO vault — holds contributed DPINO tokens
    #[account(
        init,
        payer = authority,
        token::mint = dpino_mint,
        token::authority = ido_pool,
        seeds = [b"ido_vault", params.project_name.as_bytes()],
        bump
    )]
    pub ido_vault: Account<'info, TokenAccount>,

    /// Protocol fee vault — 0.5% DPINO goes here, routed to DPINO/SOL LP.
    /// Uses init_if_needed so this shared vault survives across multiple IDOs.
    #[account(
        init_if_needed,
        payer = authority,
        token::mint = dpino_mint,
        token::authority = ido_pool,
        seeds = [b"protocol_fee_vault"],
        bump
    )]
    pub protocol_fee_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program:  Program<'info, Token>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminIdo<'info> {
    #[account(
        mut,
        has_one = authority @ IdoError::Unauthorized
    )]
    pub ido_pool:  Account<'info, IdoPool>,
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

    /// User's $DPINO associated token account (source of funds)
    #[account(
        mut,
        constraint = user_dpino_ata.mint == ido_pool.dpino_mint @ IdoError::InvalidMint,
        constraint = user_dpino_ata.owner == user.key()          @ IdoError::Unauthorized
    )]
    pub user_dpino_ata: Account<'info, TokenAccount>,

    /// IDO DPINO vault — receives net contribution
    #[account(
        mut,
        seeds = [b"ido_vault", ido_pool.project_name.as_bytes()],
        bump
    )]
    pub ido_vault: Account<'info, TokenAccount>,

    /// Protocol fee vault — receives 0.5% in DPINO (→ Raydium LP)
    #[account(
        mut,
        seeds = [b"protocol_fee_vault"],
        bump
    )]
    pub protocol_fee_vault: Account<'info, TokenAccount>,

    /// Optional: user's DPINO staking position for tier gating.
    pub staking_position: Option<Account<'info, StakingPositionExternal>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program:  Program<'info, Token>,
}

/// Cross-program read of the staking position (must mirror StakingPosition byte-for-byte).
/// Field order and types MUST exactly match dpino-staking's StakingPosition struct
/// so that Anchor deserializes the correct byte offsets when reading tier.
#[account]
pub struct StakingPositionExternal {
    pub owner:                 Pubkey,  // 32
    pub pool:                  Pubkey,  // 32
    pub amount_staked:         u64,     // 8
    pub start_time:            i64,     // 8
    pub unstake_initiated_at:  i64,     // 8
    pub lock_until:            i64,     // 8  — fixed-stake unlock timestamp (0 = flexible)
    pub tier:                  u8,      // 1  — 0=none 1=soldier 2=general 3=dark_lord
    pub staking_mode:          u8,      // 1  — 0=flexible 1=fixed
    pub dpino_rewards_pending: u64,     // 8
    pub position_apy_bps:      u64,     // 8
    pub last_claim_time:       i64,     // 8
    pub bump:                  u8,      // 1
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

    /// Project token mint (must match ido_pool.token_mint)
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

    /// User's project token account to receive purchased tokens
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

    /// IDO vault (sends DPINO back to user)
    #[account(
        mut,
        seeds = [b"ido_vault", ido_pool.project_name.as_bytes()],
        bump
    )]
    pub ido_vault: Account<'info, TokenAccount>,

    /// User's DPINO ATA to receive refund
    #[account(
        mut,
        constraint = user_dpino_ata.mint == ido_pool.dpino_mint @ IdoError::InvalidMint,
        constraint = user_dpino_ata.owner == user.key()          @ IdoError::Unauthorized
    )]
    pub user_dpino_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(
        has_one = authority @ IdoError::Unauthorized,
        seeds   = [b"ido_pool", ido_pool.project_name.as_bytes()],
        bump    = ido_pool.bump
    )]
    pub ido_pool: Account<'info, IdoPool>,

    /// IDO vault (sends DPINO to authority → Raydium LP)
    #[account(
        mut,
        seeds = [b"ido_vault", ido_pool.project_name.as_bytes()],
        bump
    )]
    pub ido_vault: Account<'info, TokenAccount>,

    /// Authority's DPINO ATA to receive raised funds
    #[account(
        mut,
        constraint = authority_dpino_ata.mint == ido_pool.dpino_mint @ IdoError::InvalidMint,
        constraint = authority_dpino_ata.owner == authority.key()     @ IdoError::Unauthorized
    )]
    pub authority_dpino_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

#[account]
pub struct IdoPool {
    pub authority:              Pubkey,   // 32
    pub dpino_mint:             Pubkey,   // 32  — $DPINO token mint
    pub project_name:           String,   // 4 + 64
    pub token_price_dpino:      u64,      // 8   — DPINO per 1 project token (base units)
    pub hard_cap_dpino:         u64,      // 8   — max DPINO to raise
    pub soft_cap_dpino:         u64,      // 8   — min DPINO for success
    pub start_time:             i64,      // 8
    pub end_time:               i64,      // 8
    pub min_allocation_dpino:   u64,      // 8
    pub max_allocation_dpino:   u64,      // 8
    pub min_tier_required:      u8,       // 1   — 0=none 1=soldier 2=general 3=dark_lord
    pub total_raised_dpino:     u64,      // 8   — running total (net of fees)
    pub participants:           u32,      // 4
    pub token_mint:             Option<Pubkey>, // 33  — project token mint (set after TGE)
    pub is_finalized:           bool,     // 1
    pub tokens_distributed:     bool,     // 1
    pub bump:                   u8,       // 1
}

impl IdoPool {
    pub const LEN: usize = 8   // discriminator
        + 32               // authority
        + 32               // dpino_mint
        + 4 + 64           // project_name
        + 8                // token_price_dpino
        + 8                // hard_cap_dpino
        + 8                // soft_cap_dpino
        + 8                // start_time
        + 8                // end_time
        + 8                // min_allocation_dpino
        + 8                // max_allocation_dpino
        + 1                // min_tier_required
        + 8                // total_raised_dpino
        + 4                // participants
        + 1 + 32           // token_mint (Option<Pubkey>)
        + 1                // is_finalized
        + 1                // tokens_distributed
        + 1                // bump
        + 64;              // padding
}

#[account]
pub struct UserAllocation {
    pub owner:               Pubkey,  // 32
    pub ido:                 Pubkey,  // 32
    pub amount_paid_dpino:   u64,     // 8   — DPINO contributed (net of fee)
    pub tokens_claimed:      bool,    // 1
    pub refunded:            bool,    // 1
    pub bump:                u8,      // 1
}

impl UserAllocation {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1 + 32; // +32 padding
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum IdoError {
    #[msg("IDO has not started yet")]
    IdoNotStarted,
    #[msg("IDO has already ended")]
    IdoEnded,
    #[msg("IDO is still active — cannot finalize yet")]
    IdoStillActive,
    #[msg("IDO has already been finalized")]
    AlreadyFinalized,
    #[msg("IDO has not been finalized yet")]
    NotFinalized,
    #[msg("Hard cap exceeded")]
    HardCapExceeded,
    #[msg("Amount below minimum allocation")]
    BelowMinAllocation,
    #[msg("Amount exceeds maximum allocation")]
    ExceedsMaxAllocation,
    #[msg("Insufficient staking tier for this IDO")]
    InsufficientTier,
    #[msg("Tokens have already been claimed")]
    AlreadyClaimed,
    #[msg("Already refunded")]
    AlreadyRefunded,
    #[msg("Soft cap was met — no refund available")]
    SoftCapMet,
    #[msg("Soft cap not met — cannot finalize or claim")]
    SoftCapNotMet,
    #[msg("No tokens to claim")]
    NoTokensToClaim,
    #[msg("Nothing to refund")]
    NothingToRefund,
    #[msg("Token mint not set yet")]
    TokenMintNotSet,
    #[msg("Invalid mint — expected $DPINO")]
    InvalidMint,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid parameters")]
    InvalidParams,
}
