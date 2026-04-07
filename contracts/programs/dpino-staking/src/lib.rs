use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DPStak1ngXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

pub const DPINO_MINT: &str = "4fwCUiZ8qaddK3WFLXazXRtpYpHc39iYLnEfF7KjmoEy";

pub const SOLDIER_THRESHOLD:   u64 = 100_000_000_000_000;   // 100K  DPINO (9 decimals)
pub const GENERAL_THRESHOLD:   u64 = 500_000_000_000_000;   // 500K  DPINO
pub const DARK_LORD_THRESHOLD: u64 = 1_000_000_000_000_000; // 1M    DPINO

/// Flexible staking APYs (can withdraw after 7-day cooldown)
pub const SOLDIER_FLEX_APY_BPS:   u64 = 600;  //  6%
pub const GENERAL_FLEX_APY_BPS:   u64 = 900;  //  9%
pub const DARK_LORD_FLEX_APY_BPS: u64 = 1_200; // 12%

/// Fixed 30-day staking APYs (tokens locked for 30 days, higher reward)
pub const SOLDIER_FIXED30_APY_BPS:   u64 = 1_000; // 10%
pub const GENERAL_FIXED30_APY_BPS:   u64 = 1_400; // 14%
pub const DARK_LORD_FIXED30_APY_BPS: u64 = 1_800; // 18%

/// Fixed 90-day staking APYs (tokens locked for 90 days, highest reward)
pub const SOLDIER_FIXED90_APY_BPS:   u64 = 1_500; // 15%
pub const GENERAL_FIXED90_APY_BPS:   u64 = 2_000; // 20%
pub const DARK_LORD_FIXED90_APY_BPS: u64 = 2_500; // 25%

pub const DEFAULT_COOLDOWN_SECONDS: i64 = 7 * 24 * 60 * 60;
pub const RATE_DENOMINATOR:         u64 = 10_000;
pub const SECONDS_PER_YEAR:         u64 = 365 * 24 * 60 * 60;

// ─────────────────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod dpino_staking {
    use super::*;

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// Initialize the global staking pool (admin only, called once).
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        cooldown_seconds: i64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.staking_pool;
        pool.authority                  = ctx.accounts.authority.key();
        pool.dpino_mint                 = ctx.accounts.dpino_mint.key();
        pool.vault                      = ctx.accounts.vault.key();
        pool.reward_vault               = ctx.accounts.reward_vault.key();
        pool.total_staked               = 0;
        // Flexible APYs
        pool.soldier_apy_bps            = SOLDIER_FLEX_APY_BPS;
        pool.general_apy_bps            = GENERAL_FLEX_APY_BPS;
        pool.dark_lord_apy_bps          = DARK_LORD_FLEX_APY_BPS;
        // Fixed 30-day APYs
        pool.soldier_fixed30_apy_bps    = SOLDIER_FIXED30_APY_BPS;
        pool.general_fixed30_apy_bps    = GENERAL_FIXED30_APY_BPS;
        pool.dark_lord_fixed30_apy_bps  = DARK_LORD_FIXED30_APY_BPS;
        // Fixed 90-day APYs
        pool.soldier_fixed90_apy_bps    = SOLDIER_FIXED90_APY_BPS;
        pool.general_fixed90_apy_bps    = GENERAL_FIXED90_APY_BPS;
        pool.dark_lord_fixed90_apy_bps  = DARK_LORD_FIXED90_APY_BPS;
        pool.sol_reward_lamports        = 0;
        pool.cooldown_seconds           = if cooldown_seconds > 0 { cooldown_seconds } else { DEFAULT_COOLDOWN_SECONDS };
        pool.bump                       = ctx.bumps.staking_pool;
        msg!(
            "StakingPool initialized. Flex APYs={}%/{}%/{}% Fixed30={}%/{}%/{}% Fixed90={}%/{}%/{}%",
            SOLDIER_FLEX_APY_BPS/100, GENERAL_FLEX_APY_BPS/100, DARK_LORD_FLEX_APY_BPS/100,
            SOLDIER_FIXED30_APY_BPS/100, GENERAL_FIXED30_APY_BPS/100, DARK_LORD_FIXED30_APY_BPS/100,
            SOLDIER_FIXED90_APY_BPS/100, GENERAL_FIXED90_APY_BPS/100, DARK_LORD_FIXED90_APY_BPS/100,
        );
        Ok(())
    }

    /// Admin deposits DPINO protocol fees into the reward vault.
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
        msg!("DPINO reward vault funded with {} lamports of DPINO.", amount);
        Ok(())
    }

    /// Admin deposits SOL into the pool so stakers can claim SOL rewards.
    pub fn fund_sol_rewards(ctx: Context<FundSolRewards>, lamports: u64) -> Result<()> {
        require!(lamports > 0, StakingError::ZeroAmount);
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to:   ctx.accounts.staking_pool.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, lamports)?;
        ctx.accounts.staking_pool.sol_reward_lamports =
            ctx.accounts.staking_pool.sol_reward_lamports.saturating_add(lamports);
        msg!("SOL reward pool funded with {} lamports.", lamports);
        Ok(())
    }

    /// Admin updates flexible-staking APY rates (basis points).
    pub fn update_apy_rates(
        ctx: Context<AdminOnly>,
        soldier_bps:   u64,
        general_bps:   u64,
        dark_lord_bps: u64,
    ) -> Result<()> {
        require!(soldier_bps   <= 10_000, StakingError::InvalidRewardRate);
        require!(general_bps   <= 10_000, StakingError::InvalidRewardRate);
        require!(dark_lord_bps <= 10_000, StakingError::InvalidRewardRate);
        let pool = &mut ctx.accounts.staking_pool;
        pool.soldier_apy_bps   = soldier_bps;
        pool.general_apy_bps   = general_bps;
        pool.dark_lord_apy_bps = dark_lord_bps;
        msg!(
            "Flex APYs updated: SOLDIER={}bps GENERAL={}bps DARK_LORD={}bps",
            soldier_bps, general_bps, dark_lord_bps
        );
        Ok(())
    }

    /// Admin updates fixed-30-day APY rates (basis points).
    pub fn update_fixed30_apy_rates(
        ctx: Context<AdminOnly>,
        soldier_bps:   u64,
        general_bps:   u64,
        dark_lord_bps: u64,
    ) -> Result<()> {
        require!(soldier_bps   <= 10_000, StakingError::InvalidRewardRate);
        require!(general_bps   <= 10_000, StakingError::InvalidRewardRate);
        require!(dark_lord_bps <= 10_000, StakingError::InvalidRewardRate);
        let pool = &mut ctx.accounts.staking_pool;
        pool.soldier_fixed30_apy_bps   = soldier_bps;
        pool.general_fixed30_apy_bps   = general_bps;
        pool.dark_lord_fixed30_apy_bps = dark_lord_bps;
        msg!(
            "Fixed-30d APYs updated: SOLDIER={}bps GENERAL={}bps DARK_LORD={}bps",
            soldier_bps, general_bps, dark_lord_bps
        );
        Ok(())
    }

    /// Admin updates fixed-90-day APY rates (basis points).
    pub fn update_fixed90_apy_rates(
        ctx: Context<AdminOnly>,
        soldier_bps:   u64,
        general_bps:   u64,
        dark_lord_bps: u64,
    ) -> Result<()> {
        require!(soldier_bps   <= 10_000, StakingError::InvalidRewardRate);
        require!(general_bps   <= 10_000, StakingError::InvalidRewardRate);
        require!(dark_lord_bps <= 10_000, StakingError::InvalidRewardRate);
        let pool = &mut ctx.accounts.staking_pool;
        pool.soldier_fixed90_apy_bps   = soldier_bps;
        pool.general_fixed90_apy_bps   = general_bps;
        pool.dark_lord_fixed90_apy_bps = dark_lord_bps;
        msg!(
            "Fixed-90d APYs updated: SOLDIER={}bps GENERAL={}bps DARK_LORD={}bps",
            soldier_bps, general_bps, dark_lord_bps
        );
        Ok(())
    }

    // ─── User instructions ───────────────────────────────────────────────────

    /// User stakes `amount` DPINO flexibly (can withdraw after 7-day cooldown).
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        require!(amount >= SOLDIER_THRESHOLD, StakingError::BelowMinimumStake);

        let now  = Clock::get()?.unix_timestamp;
        let pool = &mut ctx.accounts.staking_pool;
        let pos  = &mut ctx.accounts.staking_position;

        // Accumulate pending rewards before changing staked amount
        if pos.amount_staked > 0 {
            let pending = calculate_rewards(pos.amount_staked, pos.position_apy_bps, pos.last_claim_time, now);
            pos.dpino_rewards_pending = pos.dpino_rewards_pending.saturating_add(pending);
        }

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.user_token_account.to_account_info(),
                to:        ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        pos.owner                = ctx.accounts.user.key();
        pos.pool                 = pool.key();
        pos.amount_staked        = pos.amount_staked.saturating_add(amount);
        pos.start_time           = if pos.start_time == 0 { now } else { pos.start_time };
        pos.unstake_initiated_at = 0;
        pos.lock_until           = 0;  // flexible — no lock
        pos.staking_mode         = MODE_FLEXIBLE;
        pos.tier                 = compute_tier(pos.amount_staked);
        pos.position_apy_bps     = tier_apy_bps(pos.tier, pool); // flexible rate
        pos.last_claim_time      = now;
        pos.bump                 = ctx.bumps.staking_position;

        pool.total_staked = pool.total_staked.saturating_add(amount);

        msg!("Flexible stake: {} DPINO, Tier={}, APY={}bps", amount, pos.tier, pos.position_apy_bps);
        Ok(())
    }

    /// User stakes `amount` DPINO in FIXED mode for `lock_days` days.
    /// `lock_days` must be 30 or 90. Tokens cannot be withdrawn until lock expires.
    pub fn stake_fixed(ctx: Context<Stake>, amount: u64, lock_days: u16) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        require!(amount >= SOLDIER_THRESHOLD, StakingError::BelowMinimumStake);
        require!(lock_days == 30 || lock_days == 90, StakingError::InvalidLockDuration);

        let now  = Clock::get()?.unix_timestamp;
        let pool = &mut ctx.accounts.staking_pool;
        let pos  = &mut ctx.accounts.staking_position;

        // Accumulate pending rewards first
        if pos.amount_staked > 0 {
            let pending = calculate_rewards(pos.amount_staked, pos.position_apy_bps, pos.last_claim_time, now);
            pos.dpino_rewards_pending = pos.dpino_rewards_pending.saturating_add(pending);
        }

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.user_token_account.to_account_info(),
                to:        ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        let new_tier  = compute_tier(pos.amount_staked.saturating_add(amount));
        let fixed_apy = fixed_tier_apy_bps(new_tier, lock_days, pool);
        let lock_until = now + (lock_days as i64) * 24 * 60 * 60;

        pos.owner                = ctx.accounts.user.key();
        pos.pool                 = pool.key();
        pos.amount_staked        = pos.amount_staked.saturating_add(amount);
        pos.start_time           = if pos.start_time == 0 { now } else { pos.start_time };
        pos.unstake_initiated_at = 0;
        pos.lock_until           = lock_until;
        pos.staking_mode         = MODE_FIXED;
        pos.tier                 = new_tier;
        pos.position_apy_bps     = fixed_apy;
        pos.last_claim_time      = now;
        pos.bump                 = ctx.bumps.staking_position;

        pool.total_staked = pool.total_staked.saturating_add(amount);

        msg!(
            "Fixed stake: {} DPINO, {}days, Tier={}, APY={}bps, unlock={}",
            amount, lock_days, new_tier, fixed_apy, lock_until
        );
        Ok(())
    }

    /// Begin the 7-day unstake cooldown (flexible only).
    /// For fixed staking, call this only after the lock period has expired.
    pub fn initiate_unstake(ctx: Context<InitiateUnstake>) -> Result<()> {
        let pool = &ctx.accounts.staking_pool;
        let pos  = &mut ctx.accounts.staking_position;
        require!(pos.amount_staked > 0, StakingError::NoActiveStake);
        require!(pos.unstake_initiated_at == 0, StakingError::CooldownAlreadyStarted);

        let now = Clock::get()?.unix_timestamp;

        // For fixed staking, the lock period must have expired first
        if pos.staking_mode == MODE_FIXED {
            require!(now >= pos.lock_until, StakingError::LockPeriodNotElapsed);
        }

        let pending = calculate_rewards(pos.amount_staked, pos.position_apy_bps, pos.last_claim_time, now);
        pos.dpino_rewards_pending = pos.dpino_rewards_pending.saturating_add(pending);
        pos.last_claim_time       = now;
        pos.unstake_initiated_at  = now;

        msg!("Unstake initiated at {}. Cooldown={}s", now, pool.cooldown_seconds);
        Ok(())
    }

    /// Complete unstake after cooldown has elapsed. Returns tokens to user.
    pub fn complete_unstake(ctx: Context<CompleteUnstake>) -> Result<()> {
        let pool = &mut ctx.accounts.staking_pool;
        let pos  = &mut ctx.accounts.staking_position;

        require!(pos.amount_staked > 0, StakingError::NoActiveStake);
        require!(pos.unstake_initiated_at > 0, StakingError::CooldownNotStarted);

        let now     = Clock::get()?.unix_timestamp;
        let elapsed = now.saturating_sub(pos.unstake_initiated_at);
        require!(elapsed >= pool.cooldown_seconds, StakingError::CooldownNotElapsed);

        let amount        = pos.amount_staked;
        let dpino_mint    = pool.dpino_mint;
        let seeds: &[&[&[u8]]] = &[&[b"staking_pool", dpino_mint.as_ref(), &[pool.bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.vault.to_account_info(),
                to:        ctx.accounts.user_token_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            seeds,
        );
        token::transfer(cpi_ctx, amount)?;

        pool.total_staked        = pool.total_staked.saturating_sub(amount);
        pos.amount_staked        = 0;
        pos.unstake_initiated_at = 0;
        pos.tier                 = 0;

        msg!("Unstake complete. Returned {} DPINO to user.", amount);
        Ok(())
    }

    /// Claim all accumulated DPINO rewards. Paid from the protocol reward vault.
    pub fn claim_dpino_rewards(ctx: Context<ClaimDpinoRewards>) -> Result<()> {
        let pool = &mut ctx.accounts.staking_pool;
        let pos  = &mut ctx.accounts.staking_position;

        require!(
            pos.amount_staked > 0 || pos.dpino_rewards_pending > 0,
            StakingError::NoRewardsToClaim
        );

        let now     = Clock::get()?.unix_timestamp;
        // Use the APY rate locked in at stake time (differs for flexible vs fixed)
        let rate    = pos.position_apy_bps;
        let pending = calculate_rewards(pos.amount_staked, rate, pos.last_claim_time, now);
        let total   = pos.dpino_rewards_pending.saturating_add(pending);

        require!(total > 0, StakingError::NoRewardsToClaim);
        require!(
            ctx.accounts.reward_vault.amount >= total,
            StakingError::InsufficientRewardVault
        );

        let dpino_mint = pool.dpino_mint;
        let seeds: &[&[&[u8]]] = &[&[b"staking_pool", dpino_mint.as_ref(), &[pool.bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.reward_vault.to_account_info(),
                to:        ctx.accounts.user_token_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            seeds,
        );
        token::transfer(cpi_ctx, total)?;

        pos.dpino_rewards_pending = 0;
        pos.last_claim_time       = now;

        msg!("Claimed {} DPINO rewards (tier={})", total, pos.tier);
        Ok(())
    }

    /// Claim a proportional share of the SOL reward pool.
    /// Share = (user_staked / total_staked) × sol_reward_lamports  
    pub fn claim_sol_rewards(ctx: Context<ClaimSolRewards>) -> Result<()> {
        let pool = &mut ctx.accounts.staking_pool;
        let pos  = &ctx.accounts.staking_position;

        require!(pos.amount_staked > 0, StakingError::NoActiveStake);
        require!(pool.total_staked > 0, StakingError::NoRewardsToClaim);
        require!(pool.sol_reward_lamports > 0, StakingError::InsufficientSolVault);

        // Proportional SOL share (integer math, truncated)
        let share = (pos.amount_staked as u128)
            .saturating_mul(pool.sol_reward_lamports as u128)
            / pool.total_staked as u128;
        let share = share as u64;
        require!(share > 0, StakingError::NoRewardsToClaim);

        // Transfer SOL from pool PDA lamports to user
        **pool.to_account_info().try_borrow_mut_lamports()? =
            pool.to_account_info().lamports().checked_sub(share)
                .ok_or(StakingError::InsufficientSolVault)?;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? =
            ctx.accounts.user.lamports().saturating_add(share);

        pool.sol_reward_lamports = pool.sol_reward_lamports.saturating_sub(share);

        msg!("Claimed {} lamports SOL rewards ({}% of pool)", share, pos.amount_staked * 100 / pool.total_staked);
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn compute_tier(amount: u64) -> u8 {
    if amount >= DARK_LORD_THRESHOLD { 3 }
    else if amount >= GENERAL_THRESHOLD { 2 }
    else if amount >= SOLDIER_THRESHOLD { 1 }
    else { 0 }
}

/// Returns the flexible APY rate for a tier
fn tier_apy_bps(tier: u8, pool: &StakingPool) -> u64 {
    match tier {
        3 => pool.dark_lord_apy_bps,
        2 => pool.general_apy_bps,
        1 => pool.soldier_apy_bps,
        _ => 0,
    }
}

/// Returns the fixed APY rate for a tier and lock duration (30 or 90 days)
fn fixed_tier_apy_bps(tier: u8, lock_days: u16, pool: &StakingPool) -> u64 {
    if lock_days == 90 {
        match tier {
            3 => pool.dark_lord_fixed90_apy_bps,
            2 => pool.general_fixed90_apy_bps,
            1 => pool.soldier_fixed90_apy_bps,
            _ => 0,
        }
    } else {
        match tier {
            3 => pool.dark_lord_fixed30_apy_bps,
            2 => pool.general_fixed30_apy_bps,
            1 => pool.soldier_fixed30_apy_bps,
            _ => 0,
        }
    }
}

/// Linear APY reward: staked × rate_bps × elapsed_secs / (365_days × RATE_DENOMINATOR)
fn calculate_rewards(staked: u64, rate_bps: u64, last_claim: i64, now: i64) -> u64 {
    if staked == 0 || rate_bps == 0 || now <= last_claim { return 0; }
    let elapsed = (now - last_claim) as u64;
    ((staked as u128)
        .saturating_mul(rate_bps as u128)
        .saturating_mul(elapsed as u128)
        / (SECONDS_PER_YEAR as u128 * RATE_DENOMINATOR as u128)) as u64
}

// ─────────────────────────────────────────────────────────────────────────────
// Account contexts
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

    #[account(
        init, payer = authority,
        token::mint = dpino_mint, token::authority = staking_pool,
        seeds = [b"vault", dpino_mint.key().as_ref()], bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init, payer = authority,
        token::mint = dpino_mint, token::authority = staking_pool,
        seeds = [b"reward_vault", dpino_mint.key().as_ref()], bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub dpino_mint:     Account<'info, Mint>,
    #[account(mut)]
    pub authority:      Signer<'info>,
    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        init_if_needed, payer = user,
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

    pub user:          Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimDpinoRewards<'info> {
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

    pub user:          Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimSolRewards<'info> {
    #[account(
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

    #[account(mut)]
    pub user: Signer<'info>,
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
pub struct FundSolRewards<'info> {
    #[account(
        mut,
        seeds = [b"staking_pool", staking_pool.dpino_mint.as_ref()],
        bump  = staking_pool.bump,
        has_one = authority @ StakingError::Unauthorized
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(mut)]
    pub authority:      Signer<'info>,
    pub system_program: Program<'info, System>,
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
    pub authority:                 Pubkey,  // 32
    pub dpino_mint:                Pubkey,  // 32
    pub vault:                     Pubkey,  // 32
    pub reward_vault:              Pubkey,  // 32
    pub total_staked:              u64,     // 8
    // Flexible APYs
    pub soldier_apy_bps:           u64,     // 8    6%
    pub general_apy_bps:           u64,     // 8    9%
    pub dark_lord_apy_bps:         u64,     // 8   12%
    // Fixed 30-day APYs
    pub soldier_fixed30_apy_bps:   u64,     // 8   10%
    pub general_fixed30_apy_bps:   u64,     // 8   14%
    pub dark_lord_fixed30_apy_bps: u64,     // 8   18%
    // Fixed 90-day APYs
    pub soldier_fixed90_apy_bps:   u64,     // 8   15%
    pub general_fixed90_apy_bps:   u64,     // 8   20%
    pub dark_lord_fixed90_apy_bps: u64,     // 8   25%
    pub sol_reward_lamports:       u64,     // 8
    pub cooldown_seconds:          i64,     // 8
    pub bump:                      u8,      // 1
}

impl StakingPool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + (8 * 9) + 8 + 8 + 1 + 128;
}

/// Staking mode stored on the position
pub const MODE_FLEXIBLE: u8 = 0;
pub const MODE_FIXED:    u8 = 1;

#[account]
pub struct StakingPosition {
    pub owner:                 Pubkey,  // 32
    pub pool:                  Pubkey,  // 32
    pub amount_staked:         u64,     // 8
    pub start_time:            i64,     // 8
    pub unstake_initiated_at:  i64,     // 8  (0 = none, flexible only)
    pub lock_until:            i64,     // 8  (0 = flexible, else Unix timestamp)
    pub tier:                  u8,      // 1  (0=none 1=soldier 2=general 3=dark_lord)
    pub staking_mode:          u8,      // 1  (0=flexible 1=fixed)
    pub dpino_rewards_pending: u64,     // 8
    pub position_apy_bps:      u64,     // 8  — actual APY rate locked in at stake time
    pub last_claim_time:       i64,     // 8
    pub bump:                  u8,      // 1
}

impl StakingPosition {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 8 + 8 + 1 + 64;
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
    #[msg("Cooldown is already active")]
    CooldownAlreadyStarted,
    #[msg("Cooldown period has not elapsed yet")]
    CooldownNotElapsed,
    #[msg("No rewards available to claim")]
    NoRewardsToClaim,
    #[msg("DPINO reward vault has insufficient funds")]
    InsufficientRewardVault,
    #[msg("SOL reward pool has insufficient funds")]
    InsufficientSolVault,
    #[msg("Invalid APY rate (must be <= 10000 bps)")]
    InvalidRewardRate,
    #[msg("Lock duration must be 30 or 90 days")]
    InvalidLockDuration,
    #[msg("Fixed lock period has not elapsed yet — tokens are locked")]
    LockPeriodNotElapsed,
    #[msg("Token mint does not match the pool")]
    InvalidMint,
    #[msg("Token account owner mismatch")]
    InvalidOwner,
    #[msg("Unauthorized")]
    Unauthorized,
}
