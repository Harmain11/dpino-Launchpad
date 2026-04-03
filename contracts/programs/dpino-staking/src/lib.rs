use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DPStak1ngXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// $DPINO token mint on mainnet
pub const DPINO_MINT: &str = "4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy";

/// Tier thresholds (in raw token units, 9 decimals — $DPINO has 9 decimals)
pub const SOLDIER_THRESHOLD:   u64 = 100_000_000_000_000;   // 100K  DPINO × 10^9
pub const GENERAL_THRESHOLD:   u64 = 500_000_000_000_000;   // 500K  DPINO × 10^9
pub const DARK_LORD_THRESHOLD: u64 = 1_000_000_000_000_000; // 1M    DPINO × 10^9

/// Default unstake cooldown: 7 days in seconds
pub const DEFAULT_COOLDOWN_SECONDS: i64 = 7 * 24 * 60 * 60;

/// Reward rate denominator (basis-point style: 10_000 = 100%)
pub const RATE_DENOMINATOR: u64 = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod dpino_staking {
    use super::*;

    /// Initialize the global staking pool (admin only, called once).
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        reward_rate_bps: u64,       // annual reward rate in basis points, e.g. 1000 = 10%
        cooldown_seconds: i64,      // seconds before unstake is finalized
    ) -> Result<()> {
        require!(reward_rate_bps <= 10_000, StakingError::InvalidRewardRate);
        let pool = &mut ctx.accounts.staking_pool;
        pool.authority        = ctx.accounts.authority.key();
        pool.dpino_mint       = ctx.accounts.dpino_mint.key();
        pool.vault            = ctx.accounts.vault.key();
        pool.reward_vault     = ctx.accounts.reward_vault.key();
        pool.total_staked     = 0;
        pool.reward_rate_bps  = reward_rate_bps;
        pool.cooldown_seconds = if cooldown_seconds > 0 { cooldown_seconds } else { DEFAULT_COOLDOWN_SECONDS };
        pool.bump             = ctx.bumps.staking_pool;
        msg!("StakingPool initialized. Rate={}bps Cooldown={}s", reward_rate_bps, pool.cooldown_seconds);
        Ok(())
    }

    /// User stakes `amount` DPINO tokens into the pool.
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        require!(amount >= SOLDIER_THRESHOLD, StakingError::BelowMinimumStake);

        let now = Clock::get()?.unix_timestamp;

        // Transfer tokens from user → vault
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.user_token_account.to_account_info(),
                to:        ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        let pool     = &mut ctx.accounts.staking_pool;
        let position = &mut ctx.accounts.staking_position;

        // If user already has an active position, accumulate rewards first
        if position.amount_staked > 0 {
            let pending = calculate_rewards(
                position.amount_staked,
                pool.reward_rate_bps,
                position.last_claim_time,
                now,
            );
            position.rewards_earned = position.rewards_earned.saturating_add(pending);
        }

        position.owner                 = ctx.accounts.user.key();
        position.pool                  = pool.key();
        position.amount_staked         = position.amount_staked.saturating_add(amount);
        position.start_time            = if position.start_time == 0 { now } else { position.start_time };
        position.unstake_initiated_at  = 0; // clear any pending cooldown
        position.tier                  = compute_tier(position.amount_staked);
        position.last_claim_time       = now;
        position.bump                  = ctx.bumps.staking_position;

        pool.total_staked = pool.total_staked.saturating_add(amount);

        msg!(
            "Staked {} DPINO. Total={} Tier={}",
            amount,
            position.amount_staked,
            position.tier
        );
        Ok(())
    }

    /// Begin the unstake cooldown. Tokens are NOT returned yet.
    pub fn initiate_unstake(ctx: Context<InitiateUnstake>) -> Result<()> {
        let position = &mut ctx.accounts.staking_position;
        require!(position.amount_staked > 0, StakingError::NoActiveStake);
        require!(position.unstake_initiated_at == 0, StakingError::CooldownAlreadyStarted);

        let now = Clock::get()?.unix_timestamp;

        // Snapshot pending rewards before starting cooldown
        let pool = &ctx.accounts.staking_pool;
        let pending = calculate_rewards(
            position.amount_staked,
            pool.reward_rate_bps,
            position.last_claim_time,
            now,
        );
        position.rewards_earned       = position.rewards_earned.saturating_add(pending);
        position.last_claim_time      = now;
        position.unstake_initiated_at = now;

        msg!("Unstake initiated at {}. Cooldown={}s", now, pool.cooldown_seconds);
        Ok(())
    }

    /// Complete unstake after cooldown has elapsed. Returns tokens to user.
    pub fn complete_unstake(ctx: Context<CompleteUnstake>) -> Result<()> {
        let pool     = &mut ctx.accounts.staking_pool;
        let position = &mut ctx.accounts.staking_position;

        require!(position.amount_staked > 0, StakingError::NoActiveStake);
        require!(position.unstake_initiated_at > 0, StakingError::CooldownNotStarted);

        let now = Clock::get()?.unix_timestamp;
        let elapsed = now.saturating_sub(position.unstake_initiated_at);
        require!(elapsed >= pool.cooldown_seconds, StakingError::CooldownNotElapsed);

        let amount = position.amount_staked;

        // Transfer tokens from vault → user via PDA signer
        let pool_key = pool.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"staking_pool",
            pool_key.as_ref(),
            &[pool.bump],
        ]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.vault.to_account_info(),
                to:        ctx.accounts.user_token_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        pool.total_staked             = pool.total_staked.saturating_sub(amount);
        position.amount_staked        = 0;
        position.unstake_initiated_at = 0;
        position.tier                 = 0;

        msg!("Unstake complete. Returned {} DPINO to user.", amount);
        Ok(())
    }

    /// Claim accumulated staking rewards.
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let pool     = &mut ctx.accounts.staking_pool;
        let position = &mut ctx.accounts.staking_position;

        require!(position.amount_staked > 0 || position.rewards_earned > 0, StakingError::NoRewardsToClaim);

        let now = Clock::get()?.unix_timestamp;
        let pending = calculate_rewards(
            position.amount_staked,
            pool.reward_rate_bps,
            position.last_claim_time,
            now,
        );
        let total_claimable = position.rewards_earned.saturating_add(pending);
        require!(total_claimable > 0, StakingError::NoRewardsToClaim);

        // Check reward vault has enough balance
        let available = ctx.accounts.reward_vault.amount;
        require!(available >= total_claimable, StakingError::InsufficientRewardVault);

        // Transfer rewards from reward_vault → user via PDA signer
        let pool_key = pool.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"staking_pool",
            pool_key.as_ref(),
            &[pool.bump],
        ]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.reward_vault.to_account_info(),
                to:        ctx.accounts.user_token_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi_ctx, total_claimable)?;

        position.rewards_earned  = 0;
        position.last_claim_time = now;

        msg!("Claimed {} DPINO rewards.", total_claimable);
        Ok(())
    }

    /// Admin deposits protocol-fee tokens into the reward vault.
    pub fn fund_reward_vault(ctx: Context<FundRewardVault>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.authority_token_account.to_account_info(),
                to:        ctx.accounts.reward_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        msg!("Funded reward vault with {} DPINO.", amount);
        Ok(())
    }

    /// Admin updates the reward rate.
    pub fn update_reward_rate(ctx: Context<AdminOnly>, new_rate_bps: u64) -> Result<()> {
        require!(new_rate_bps <= 10_000, StakingError::InvalidRewardRate);
        ctx.accounts.staking_pool.reward_rate_bps = new_rate_bps;
        msg!("Reward rate updated to {}bps", new_rate_bps);
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Returns 0=None, 1=SOLDIER, 2=GENERAL, 3=DARK_LORD
fn compute_tier(amount: u64) -> u8 {
    if amount >= DARK_LORD_THRESHOLD { 3 }
    else if amount >= GENERAL_THRESHOLD { 2 }
    else if amount >= SOLDIER_THRESHOLD { 1 }
    else { 0 }
}

/// Simple linear reward: amount * rate * seconds_elapsed / (365_days * RATE_DENOMINATOR)
fn calculate_rewards(staked: u64, rate_bps: u64, last_claim: i64, now: i64) -> u64 {
    if staked == 0 || rate_bps == 0 || now <= last_claim { return 0; }
    let elapsed_secs = (now - last_claim) as u64;
    let seconds_per_year: u64 = 365 * 24 * 60 * 60;
    // rewards = staked * rate_bps * elapsed / (year * RATE_DENOMINATOR)
    (staked as u128)
        .saturating_mul(rate_bps as u128)
        .saturating_mul(elapsed_secs as u128)
        / (seconds_per_year as u128 * RATE_DENOMINATOR as u128) as u128
        as u64
}

// ─────────────────────────────────────────────────────────────────────────────
// Accounts
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = StakingPool::LEN,
        seeds = [b"staking_pool", dpino_mint.key().as_ref()],
        bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// Token vault — holds staked DPINO (owned by the PDA)
    #[account(
        init,
        payer = authority,
        token::mint      = dpino_mint,
        token::authority = staking_pool,
        seeds = [b"vault", dpino_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Reward vault — holds protocol-fee DPINO distributed as rewards
    #[account(
        init,
        payer = authority,
        token::mint      = dpino_mint,
        token::authority = staking_pool,
        seeds = [b"reward_vault", dpino_mint.key().as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub dpino_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = StakingPosition::LEN,
        seeds = [b"position", staking_pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub staking_position: Account<'info, StakingPosition>,

    #[account(
        mut,
        seeds = [b"staking_pool", staking_pool.dpino_mint.as_ref()],
        bump  = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// Vault that receives staked tokens
    #[account(
        mut,
        seeds = [b"vault", staking_pool.dpino_mint.as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    /// User's DPINO token account (source)
    #[account(
        mut,
        constraint = user_token_account.mint == staking_pool.dpino_mint @ StakingError::InvalidMint,
        constraint = user_token_account.owner == user.key()             @ StakingError::InvalidOwner
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitiateUnstake<'info> {
    #[account(
        mut,
        seeds = [b"position", staking_pool.key().as_ref(), user.key().as_ref()],
        bump  = staking_position.bump,
        constraint = staking_position.owner == user.key() @ StakingError::Unauthorized
    )]
    pub staking_position: Account<'info, StakingPosition>,

    #[account(
        seeds = [b"staking_pool", staking_pool.dpino_mint.as_ref()],
        bump  = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteUnstake<'info> {
    #[account(
        mut,
        seeds = [b"position", staking_pool.key().as_ref(), user.key().as_ref()],
        bump  = staking_position.bump,
        constraint = staking_position.owner == user.key() @ StakingError::Unauthorized
    )]
    pub staking_position: Account<'info, StakingPosition>,

    #[account(
        mut,
        seeds = [b"staking_pool", staking_pool.dpino_mint.as_ref()],
        bump  = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [b"vault", staking_pool.dpino_mint.as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.mint  == staking_pool.dpino_mint @ StakingError::InvalidMint,
        constraint = user_token_account.owner == user.key()              @ StakingError::InvalidOwner
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        seeds = [b"position", staking_pool.key().as_ref(), user.key().as_ref()],
        bump  = staking_position.bump,
        constraint = staking_position.owner == user.key() @ StakingError::Unauthorized
    )]
    pub staking_position: Account<'info, StakingPosition>,

    #[account(
        mut,
        seeds = [b"staking_pool", staking_pool.dpino_mint.as_ref()],
        bump  = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [b"reward_vault", staking_pool.dpino_mint.as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.mint  == staking_pool.dpino_mint @ StakingError::InvalidMint,
        constraint = user_token_account.owner == user.key()              @ StakingError::InvalidOwner
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FundRewardVault<'info> {
    #[account(
        mut,
        seeds = [b"staking_pool", staking_pool.dpino_mint.as_ref()],
        bump  = staking_pool.bump,
        has_one = authority @ StakingError::Unauthorized
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [b"reward_vault", staking_pool.dpino_mint.as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,

    pub authority:     Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [b"staking_pool", staking_pool.dpino_mint.as_ref()],
        bump  = staking_pool.bump,
        has_one = authority @ StakingError::Unauthorized
    )]
    pub staking_pool: Account<'info, StakingPool>,

    pub authority: Signer<'info>,
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

#[account]
pub struct StakingPool {
    pub authority:        Pubkey,  // 32
    pub dpino_mint:       Pubkey,  // 32
    pub vault:            Pubkey,  // 32
    pub reward_vault:     Pubkey,  // 32
    pub total_staked:     u64,     // 8
    pub reward_rate_bps:  u64,     // 8
    pub cooldown_seconds: i64,     // 8
    pub bump:             u8,      // 1
}

impl StakingPool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 64; // +64 headroom
}

#[account]
pub struct StakingPosition {
    pub owner:                 Pubkey,  // 32
    pub pool:                  Pubkey,  // 32
    pub amount_staked:         u64,     // 8
    pub start_time:            i64,     // 8
    pub unstake_initiated_at:  i64,     // 8  (0 = no cooldown active)
    pub tier:                  u8,      // 1  (0=none 1=soldier 2=general 3=dark_lord)
    pub rewards_earned:        u64,     // 8
    pub last_claim_time:       i64,     // 8
    pub bump:                  u8,      // 1
}

impl StakingPosition {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 8 + 8 + 1 + 64; // +64 headroom
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum StakingError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Minimum stake is 100,000 DPINO (SOLDIER tier)")]
    BelowMinimumStake,
    #[msg("No active staking position found")]
    NoActiveStake,
    #[msg("Cooldown has not been initiated — call initiate_unstake first")]
    CooldownNotStarted,
    #[msg("Cooldown is already active — wait for it to elapse")]
    CooldownAlreadyStarted,
    #[msg("Cooldown period has not elapsed yet")]
    CooldownNotElapsed,
    #[msg("No rewards available to claim")]
    NoRewardsToClaim,
    #[msg("Reward vault has insufficient funds")]
    InsufficientRewardVault,
    #[msg("Invalid reward rate (must be <= 10000 bps)")]
    InvalidRewardRate,
    #[msg("Token mint does not match the pool")]
    InvalidMint,
    #[msg("Token account owner mismatch")]
    InvalidOwner,
    #[msg("Unauthorized")]
    Unauthorized,
}
