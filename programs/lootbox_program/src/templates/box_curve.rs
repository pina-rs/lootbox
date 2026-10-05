//! Bonding-curve sales of a locked lootbox's boxes.
//!
//! A curve holds boxes the creator deposited in its own Token-2022 account
//! and prices the box at sold position `k` at `start_price + price_step * k`.
//! Buying pays that price into the curve's reserve; selling back pays the
//! most recent position's price out of it. The reserve therefore always
//! equals the sum of the sold positions, so every sold box can be sold back
//! until the curve sells out or the lootbox's reveal time closes trading.
//! See `docs/box-curves.md`.

use pina::sysvars::Sysvar;
use pina::sysvars::rent::Rent;

use super::*;

const SEED_BOX_CURVE: &[u8] = b"box-curve";
/// Fewest boxes a curve may sell. Below this there is no price to discover,
/// only a short price list.
pub const MIN_CURVE_INVENTORY: u64 = 20;
/// Cheapest allowed first box, in lamports. A curve is a sale; a dust price
/// would let one wallet sweep the inventory for nothing.
pub const MIN_CURVE_START_PRICE: u64 = 100_000;
/// Highest creator fee on each buy and each sell, in basis points.
pub const MAX_CURVE_FEE_BPS: u16 = 500;
const BPS_DENOMINATOR: u128 = 10_000;
/// `BoxCurveTradedEvent::side` for a purchase from the curve.
pub const CURVE_TRADE_BUY: u8 = 0;
/// `BoxCurveTradedEvent::side` for a sale back to the curve.
pub const CURVE_TRADE_SELL: u8 = 1;

/// A bonding curve selling one locked lootbox's boxes.
#[account(discriminator = LootboxAccountType, migrations)]
#[pda(seeds = [SEED_BOX_CURVE, template: Address], bump = bump)]
pub struct BoxCurveState {
	pub template: Address,
	pub box_mint: Address,
	/// The creator. Receives every fee, the reserve at sell-out, and whatever
	/// is left when the curve closes.
	pub authority: Address,
	/// Boxes deposited. The curve sells out when `sold` reaches this.
	pub inventory: u64,
	/// Boxes currently sold, net of buybacks.
	pub sold: u64,
	/// Price of the first box, in lamports.
	pub start_price: u64,
	/// Price increase per sold box, in lamports.
	pub price_step: u64,
	/// Lamports that back buybacks: the sum of every sold position's price.
	/// Zero once the curve sells out and pays the creator.
	pub reserve: u64,
	/// Trading closes at the lootbox's reveal time.
	pub closes_at: i64,
	/// When the last box sold. Zero while any inventory remains.
	pub sold_out_at: i64,
	pub fee_bps: u16,
	pub bump: u8,
}

/// Emitted on every buy and sell, for trade feeds and price history.
#[event(discriminator = LootboxEventType::BoxCurveTraded, migrations)]
pub struct BoxCurveTradedEvent {
	pub curve: Address,
	pub trader: Address,
	pub count: u64,
	/// The curve price of the boxes moved, before the fee.
	pub lamports: u64,
	pub fee: u64,
	/// `sold` after the trade; the next box costs `price(sold_after)`.
	pub sold_after: u64,
	/// `CURVE_TRADE_BUY` or `CURVE_TRADE_SELL`.
	pub side: u8,
}

#[instruction(discriminator = LootboxInstruction::OpenBoxCurve, migrations)]
pub struct OpenBoxCurveInstruction {
	pub inventory: u64,
	pub start_price: u64,
	pub price_step: u64,
	pub fee_bps: u16,
	pub bump: u8,
}

#[instruction(discriminator = LootboxInstruction::BuyCurveBoxes, migrations)]
pub struct BuyCurveBoxesInstruction {
	pub count: u64,
	/// Most the buyer will pay, price and fee together.
	pub max_lamports: u64,
}

#[instruction(discriminator = LootboxInstruction::SellCurveBoxes, migrations)]
pub struct SellCurveBoxesInstruction {
	pub count: u64,
	/// Least the seller will accept after the fee.
	pub min_lamports: u64,
}

#[instruction(discriminator = LootboxInstruction::CloseBoxCurve, migrations)]
pub struct CloseBoxCurveInstruction {}

#[derive(Accounts, Debug)]
pub struct OpenBoxCurveAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	pub template: &'a AccountView,
	pub box_mint: &'a AccountView,
	/// Any creator-owned box account; the inventory comes from here.
	#[pina(validate(distinct_from = curve_box_account))]
	pub source_box_account: &'a mut AccountView,
	#[pina(validate(empty))]
	pub box_curve: &'a mut AccountView,
	/// The curve PDA's associated box account, created earlier in the
	/// transaction.
	pub curve_box_account: &'a mut AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	#[pina(validate(address = token_2022::ID))]
	pub box_token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct BuyCurveBoxesAccounts<'a> {
	#[pina(validate(signer))]
	pub buyer: &'a mut AccountView,
	/// The lootbox the curve sells; it derives the curve's address.
	pub template: &'a AccountView,
	pub box_curve: &'a mut AccountView,
	pub box_mint: &'a AccountView,
	pub curve_box_account: &'a mut AccountView,
	/// Any box account, so a box can be bought for someone else.
	#[pina(validate(distinct_from = curve_box_account))]
	pub destination_box_account: &'a mut AccountView,
	/// The curve's creator, who receives the fee and the sell-out reserve.
	pub authority: &'a mut AccountView,
	#[pina(validate(address = system::ID))]
	pub system_program: &'a AccountView,
	#[pina(validate(address = token_2022::ID))]
	pub box_token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct SellCurveBoxesAccounts<'a> {
	#[pina(validate(signer))]
	pub seller: &'a mut AccountView,
	/// The lootbox the curve sells; it derives the curve's address.
	pub template: &'a AccountView,
	pub box_curve: &'a mut AccountView,
	pub box_mint: &'a AccountView,
	#[pina(validate(distinct_from = curve_box_account))]
	pub source_box_account: &'a mut AccountView,
	pub curve_box_account: &'a mut AccountView,
	/// The curve's creator, who receives the fee.
	pub authority: &'a mut AccountView,
	#[pina(validate(address = token_2022::ID))]
	pub box_token_program: &'a AccountView,
}

#[derive(Accounts, Debug)]
pub struct CloseBoxCurveAccounts<'a> {
	#[pina(validate(signer))]
	pub authority: &'a mut AccountView,
	/// The lootbox the curve sells; it derives the curve's address.
	pub template: &'a AccountView,
	pub box_curve: &'a mut AccountView,
	pub box_mint: &'a AccountView,
	pub curve_box_account: &'a mut AccountView,
	/// Where unsold boxes go; any box account the creator chooses.
	#[pina(validate(distinct_from = curve_box_account))]
	pub destination_box_account: &'a mut AccountView,
	#[pina(validate(address = token_2022::ID))]
	pub box_token_program: &'a AccountView,
}

/// Price of the box at sold position `position`.
///
/// # Errors
/// Returns `ArithmeticOverflow` when the price exceeds `u64`.
pub fn curve_price(start_price: u64, price_step: u64, position: u64) -> Result<u64, ProgramError> {
	price_step
		.checked_mul(position)
		.and_then(|rise| rise.checked_add(start_price))
		.ok_or(ProgramError::ArithmeticOverflow)
}

/// Total price of `count` consecutive positions starting at `from`:
/// `count * start + step * count * (2 * from + count - 1) / 2`.
///
/// The product `count * (2 * from + count - 1)` is always even, so the closed
/// form is exact.
///
/// # Errors
/// Returns `ArithmeticOverflow` when the total exceeds `u64`.
pub fn curve_cost(
	start_price: u64,
	price_step: u64,
	from: u64,
	count: u64,
) -> Result<u64, ProgramError> {
	if count == 0 {
		return Ok(0);
	}

	let count = u128::from(count);
	let positions = u128::from(from)
		.checked_mul(2)
		.and_then(|twice| twice.checked_add(count - 1))
		.and_then(|span| span.checked_mul(count))
		.ok_or(ProgramError::ArithmeticOverflow)?
		/ 2;
	let total = count
		.checked_mul(u128::from(start_price))
		.and_then(|base| {
			u128::from(price_step)
				.checked_mul(positions)
				.and_then(|rise| rise.checked_add(base))
		})
		.ok_or(ProgramError::ArithmeticOverflow)?;

	u64::try_from(total).map_err(|_| ProgramError::ArithmeticOverflow)
}

/// Creator fee on a curve amount, rounded up to the next lamport.
///
/// # Errors
/// Returns `ArithmeticOverflow` only for a fee above 100%, which the program
/// never stores.
pub fn curve_fee(lamports: u64, fee_bps: u16) -> Result<u64, ProgramError> {
	let scaled = u128::from(lamports) * u128::from(fee_bps);
	let fee = scaled.div_ceil(BPS_DENOMINATOR);

	u64::try_from(fee).map_err(|_| ProgramError::ArithmeticOverflow)
}

/// Checks a new curve's terms, including that buying the whole inventory at
/// once, fee included, fits in `u64`.
///
/// # Errors
/// Returns `InvalidBoxCurve` for terms outside the published bounds.
pub fn validate_curve_terms(
	inventory: u64,
	start_price: u64,
	price_step: u64,
	fee_bps: u16,
) -> ProgramResult {
	if inventory < MIN_CURVE_INVENTORY
		|| start_price < MIN_CURVE_START_PRICE
		|| fee_bps > MAX_CURVE_FEE_BPS
	{
		return Err(lootbox_error(LootboxError::InvalidBoxCurve));
	}

	let cost = curve_cost(start_price, price_step, 0, inventory)
		.map_err(|_| lootbox_error(LootboxError::InvalidBoxCurve))?;
	cost.checked_add(curve_fee(cost, fee_bps)?)
		.ok_or_else(|| lootbox_error(LootboxError::InvalidBoxCurve))?;

	Ok(())
}

/// A buy or sell, priced against the curve's current `sold` count.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CurveTrade {
	/// The curve price of the boxes moved.
	pub lamports: u64,
	pub fee: u64,
	/// `sold` after the trade.
	pub sold_after: u64,
}

/// Prices a buy of `count` boxes.
///
/// # Errors
/// Returns `InvalidBoxCurve` for an empty buy or one past the inventory.
pub fn quote_curve_buy(curve: &BoxCurveStateZc, count: u64) -> Result<CurveTrade, ProgramError> {
	let sold = curve.sold.get();
	let sold_after = sold
		.checked_add(count)
		.filter(|after| count > 0 && *after <= curve.inventory.get())
		.ok_or_else(|| lootbox_error(LootboxError::InvalidBoxCurve))?;
	let lamports = curve_cost(curve.start_price.get(), curve.price_step.get(), sold, count)?;

	Ok(CurveTrade {
		lamports,
		fee: curve_fee(lamports, curve.fee_bps.get())?,
		sold_after,
	})
}

/// Prices a sale of `count` boxes back to the curve.
///
/// # Errors
/// Returns `InvalidBoxCurve` for an empty sale or one larger than `sold`.
pub fn quote_curve_sell(curve: &BoxCurveStateZc, count: u64) -> Result<CurveTrade, ProgramError> {
	let sold_after = curve
		.sold
		.get()
		.checked_sub(count)
		.filter(|_| count > 0)
		.ok_or_else(|| lootbox_error(LootboxError::InvalidBoxCurve))?;
	let lamports = curve_cost(
		curve.start_price.get(),
		curve.price_step.get(),
		sold_after,
		count,
	)?;

	Ok(CurveTrade {
		lamports,
		fee: curve_fee(lamports, curve.fee_bps.get())?,
		sold_after,
	})
}

/// Loads a curve and proves it is the one PDA for `template`.
fn as_curve(account: &AccountView, template: &Address) -> Result<BoxCurveStateZc, ProgramError> {
	let curve = *account.as_account::<BoxCurveState>(&ID)?;

	if curve.template != *template {
		return Err(lootbox_error(LootboxError::InvalidBoxCurve));
	}

	let seeds = BoxCurveState::seeds(template).with_bump(curve.bump);
	account.assert_seeds_with_bump(&seeds.as_slices(), &ID)?;

	Ok(curve)
}

fn assert_trading(curve: &BoxCurveStateZc, now: i64) -> ProgramResult {
	if curve.sold_out_at.get() != 0 || now >= curve.closes_at.get() {
		return Err(lootbox_error(LootboxError::BoxCurveClosed));
	}

	Ok(())
}

/// Requires the curve's own associated box account.
fn assert_curve_box_account(
	account: &AccountView,
	curve: &Address,
	mint: &Address,
) -> ProgramResult {
	drop(account.as_associated_token_account(curve, mint, &token_2022::ID)?);

	Ok(())
}

/// Requires a Token-2022 account for the curve's box mint.
fn assert_box_account(account: &AccountView, mint: &Address) -> ProgramResult {
	let token_account = account.as_token_account_for_program(&token_2022::ID)?;

	if token_account.mint() != mint {
		return Err(lootbox_error(LootboxError::InvalidMint));
	}

	Ok(())
}

/// The curve account must always hold its rent minimum plus the reserve.
fn assert_curve_solvent(account: &AccountView, reserve: u64) -> ProgramResult {
	let floor = Rent::get()?
		.try_minimum_balance(account.data_len())?
		.checked_add(reserve)
		.ok_or(ProgramError::ArithmeticOverflow)?;

	if account.lamports() < floor {
		return Err(lootbox_error(LootboxError::Insolvent));
	}

	Ok(())
}

impl<'a> ProcessAccountInfos<'a> for OpenBoxCurveAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = OpenBoxCurveInstruction::try_from_bytes(data)?;
		let template_address = *self.template.address();
		let state = as_template(self.template)?;
		assert_template(&template_address, &state)?;
		assert_template_authority(self.authority, &state)?;

		if state.locked_at.get() == 0 {
			return Err(lootbox_error(LootboxError::TreasuryUnlocked));
		}

		if state.status != TEMPLATE_LIVE {
			return Err(lootbox_error(LootboxError::InvalidState));
		}

		if sysvars::clock::Clock::get()?.unix_timestamp >= state.opens_at.get() {
			return Err(lootbox_error(LootboxError::BoxCurveClosed));
		}

		assert_template_mint(self.box_mint, &template_address, &state.box_mint, true)?;
		validate_curve_terms(
			args.inventory.get(),
			args.start_price.get(),
			args.price_step.get(),
			args.fee_bps.get(),
		)?;
		assert_box_account(self.source_box_account, &state.box_mint)?;

		let seeds = BoxCurveState::seeds(&template_address);
		CreateProgramAccountWithBump {
			account: self.box_curve,
			payer: self.authority,
			owner: &ID,
			seeds: &seeds.as_slices(),
			bump: args.bump,
		}
		.invoke::<BoxCurveState>()?;
		assert_curve_box_account(
			self.curve_box_account,
			self.box_curve.address(),
			&state.box_mint,
		)?;

		let mut curve = self.box_curve.as_account_mut::<BoxCurveState>(&ID)?;
		curve.template = template_address;
		curve.box_mint = state.box_mint;
		curve.authority = state.authority;
		curve.inventory.set(args.inventory.get());
		curve.start_price.set(args.start_price.get());
		curve.price_step.set(args.price_step.get());
		curve.closes_at.set(state.opens_at.get());

		curve.fee_bps.set(args.fee_bps.get());
		curve.bump = args.bump;
		drop(curve);

		token_2022::instructions::TransferChecked::new(
			self.source_box_account,
			self.box_mint,
			self.curve_box_account,
			self.authority,
			args.inventory.get(),
			0,
		)
		.invoke()
	}
}

impl<'a> ProcessAccountInfos<'a> for BuyCurveBoxesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = BuyCurveBoxesInstruction::try_from_bytes(data)?;
		let curve_address = *self.box_curve.address();
		let template_address = *self.template.address();
		let curve = as_curve(self.box_curve, &template_address)?;
		let now = sysvars::clock::Clock::get()?.unix_timestamp;
		assert_trading(&curve, now)?;
		self.box_mint.assert_address(&curve.box_mint)?;
		assert_authority_address(self.authority, &curve.authority)?;

		assert_curve_box_account(self.curve_box_account, &curve_address, &curve.box_mint)?;
		assert_box_account(self.destination_box_account, &curve.box_mint)?;

		let trade = quote_curve_buy(&curve, args.count.get())?;
		let total = trade
			.lamports
			.checked_add(trade.fee)
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if total > args.max_lamports.get() {
			return Err(lootbox_error(LootboxError::BoxCurveSlippage));
		}

		system::instructions::Transfer {
			from: self.buyer,
			to: self.box_curve,
			lamports: trade.lamports,
		}
		.invoke()?;

		if trade.fee > 0 {
			system::instructions::Transfer {
				from: self.buyer,
				to: self.authority,
				lamports: trade.fee,
			}
			.invoke()?;
		}

		let sold_out = trade.sold_after == curve.inventory.get();
		let reserve = curve
			.reserve
			.get()
			.checked_add(trade.lamports)
			.ok_or(ProgramError::ArithmeticOverflow)?;
		let mut state = self.box_curve.as_account_mut::<BoxCurveState>(&ID)?;
		state.sold.set(trade.sold_after);

		if sold_out {
			state.reserve.set(0);
			state.sold_out_at.set(now);
		} else {
			state.reserve.set(reserve);
		}

		drop(state);

		let seeds = BoxCurveState::seeds(&template_address).with_bump(curve.bump);
		let signer = seeds.to_signer();
		token_2022::instructions::TransferChecked::new(
			self.curve_box_account,
			self.box_mint,
			self.destination_box_account,
			self.box_curve,
			args.count.get(),
			0,
		)
		.invoke_signed(&[signer.as_signer()])?;

		// Selling out ends buybacks, so the whole reserve is the creator's.
		if sold_out {
			self.box_curve.send_owned(&ID, reserve, self.authority)?;
		}

		assert_curve_solvent(self.box_curve, if sold_out { 0 } else { reserve })?;

		BoxCurveTradedEvent::emit(|event| {
			event.curve = curve_address;
			event.trader = *self.buyer.address();
			event.count.set(args.count.get());
			event.lamports.set(trade.lamports);
			event.fee.set(trade.fee);
			event.sold_after.set(trade.sold_after);
			event.side = CURVE_TRADE_BUY;
			Ok(())
		})
	}
}

impl<'a> ProcessAccountInfos<'a> for SellCurveBoxesAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		let args = SellCurveBoxesInstruction::try_from_bytes(data)?;
		let curve_address = *self.box_curve.address();
		let template_address = *self.template.address();
		let curve = as_curve(self.box_curve, &template_address)?;
		assert_trading(&curve, sysvars::clock::Clock::get()?.unix_timestamp)?;
		self.box_mint.assert_address(&curve.box_mint)?;
		assert_authority_address(self.authority, &curve.authority)?;
		assert_curve_box_account(self.curve_box_account, &curve_address, &curve.box_mint)?;

		assert_box_account(self.source_box_account, &curve.box_mint)?;

		let trade = quote_curve_sell(&curve, args.count.get())?;
		let payout = trade
			.lamports
			.checked_sub(trade.fee)
			.ok_or(ProgramError::ArithmeticOverflow)?;

		if payout < args.min_lamports.get() {
			return Err(lootbox_error(LootboxError::BoxCurveSlippage));
		}

		let reserve = curve
			.reserve
			.get()
			.checked_sub(trade.lamports)
			.ok_or_else(|| lootbox_error(LootboxError::Insolvent))?;

		token_2022::instructions::TransferChecked::new(
			self.source_box_account,
			self.box_mint,
			self.curve_box_account,
			self.seller,
			args.count.get(),
			0,
		)
		.invoke()?;

		let mut state = self.box_curve.as_account_mut::<BoxCurveState>(&ID)?;
		state.sold.set(trade.sold_after);
		state.reserve.set(reserve);
		drop(state);

		self.box_curve.send_owned(&ID, payout, self.seller)?;

		if trade.fee > 0 {
			self.box_curve.send_owned(&ID, trade.fee, self.authority)?;
		}

		assert_curve_solvent(self.box_curve, reserve)?;

		BoxCurveTradedEvent::emit(|event| {
			event.curve = curve_address;
			event.trader = *self.seller.address();
			event.count.set(args.count.get());
			event.lamports.set(trade.lamports);
			event.fee.set(trade.fee);
			event.sold_after.set(trade.sold_after);
			event.side = CURVE_TRADE_SELL;
			Ok(())
		})
	}
}

impl<'a> ProcessAccountInfos<'a> for CloseBoxCurveAccounts<'a> {
	fn process(self, data: &[u8]) -> ProgramResult {
		CloseBoxCurveInstruction::try_from_bytes(data)?;
		let curve_address = *self.box_curve.address();
		let template_address = *self.template.address();
		let curve = as_curve(self.box_curve, &template_address)?;
		self.authority.assert_signer()?;
		assert_authority_address(self.authority, &curve.authority)?;
		self.box_mint.assert_address(&curve.box_mint)?;
		assert_curve_box_account(self.curve_box_account, &curve_address, &curve.box_mint)?;

		assert_box_account(self.destination_box_account, &curve.box_mint)?;

		let now = sysvars::clock::Clock::get()?.unix_timestamp;
		let finished = curve.sold_out_at.get() != 0 || now >= curve.closes_at.get();

		if !finished && curve.sold.get() != 0 {
			return Err(lootbox_error(LootboxError::BoxCurveTrading));
		}

		let leftover = self
			.curve_box_account
			.as_token_account_for_program(&token_2022::ID)?
			.amount();
		let seeds = BoxCurveState::seeds(&template_address).with_bump(curve.bump);
		let signer = seeds.to_signer();

		if leftover > 0 {
			token_2022::instructions::TransferChecked::new(
				self.curve_box_account,
				self.box_mint,
				self.destination_box_account,
				self.box_curve,
				leftover,
				0,
			)
			.invoke_signed(&[signer.as_signer()])?;
		}

		token_2022::instructions::CloseAccount::new(
			self.curve_box_account,
			self.authority,
			self.box_curve,
		)
		.invoke_signed(&[signer.as_signer()])?;

		// Closing moves every lamport, so any reserve reaches the creator here.
		self.box_curve.close_account_zeroed(&ID, self.authority)
	}
}

#[cfg(test)]
mod tests {
	use proptest::prelude::*;

	use super::*;

	fn curve(inventory: u64, sold: u64, start: u64, step: u64, fee_bps: u16) -> BoxCurveStateZc {
		let mut bytes = [0u8; BoxCurveState::SIZE];
		let state = BoxCurveState::initialize(&mut bytes, |state| {
			state.inventory.set(inventory);
			state.sold.set(sold);
			state.start_price.set(start);
			state.price_step.set(step);
			state.fee_bps.set(fee_bps);
			Ok(())
		})
		.expect("curve");

		*state
	}

	fn looped_cost(start: u64, step: u64, from: u64, count: u64) -> u128 {
		(from..from + count)
			.map(|position| u128::from(start) + u128::from(step) * u128::from(position))
			.sum()
	}

	#[test]
	fn cost_is_the_sum_of_position_prices() {
		assert_eq!(curve_cost(1_000_000, 50_000, 0, 1), Ok(1_000_000));
		assert_eq!(curve_cost(1_000_000, 50_000, 3, 2), Ok(2_350_000));
		assert_eq!(curve_cost(1_000_000, 50_000, 7, 0), Ok(0));
		assert_eq!(curve_price(1_000_000, 50_000, 19), Ok(1_950_000));
	}

	#[test]
	fn fee_rounds_up_and_is_zero_without_bps() {
		assert_eq!(curve_fee(1_000_000, 100), Ok(10_000));
		assert_eq!(curve_fee(1_000_001, 100), Ok(10_001));
		assert_eq!(curve_fee(999, 0), Ok(0));
		assert_eq!(curve_fee(1, 1), Ok(1));
	}

	#[test]
	fn terms_enforce_the_published_minimums() {
		assert_eq!(validate_curve_terms(20, 100_000, 0, 500), Ok(()));
		assert!(validate_curve_terms(19, 100_000, 0, 0).is_err());
		assert!(validate_curve_terms(20, 99_999, 0, 0).is_err());
		assert!(validate_curve_terms(20, 100_000, 0, 501).is_err());
		assert!(validate_curve_terms(u64::MAX, 100_000, u64::MAX, 0).is_err());
	}

	#[test]
	fn buys_stop_at_the_inventory_and_sells_at_zero() {
		let state = curve(20, 18, 1_000_000, 50_000, 100);

		assert!(quote_curve_buy(&state, 0).is_err());
		assert!(quote_curve_buy(&state, 3).is_err());
		assert_eq!(
			quote_curve_buy(&state, 2),
			Ok(CurveTrade {
				lamports: 3_850_000,
				fee: 38_500,
				sold_after: 20
			})
		);
		assert!(quote_curve_sell(&state, 19).is_err());
		assert!(quote_curve_sell(&state, 0).is_err());
		assert_eq!(
			quote_curve_sell(&state, 18).map(|trade| trade.sold_after),
			Ok(0)
		);
	}

	fn vector_u64(value: &serde_json::Value) -> u64 {
		value
			.as_str()
			.map_or_else(|| value.as_u64(), |text| text.parse().ok())
			.expect("u64")
	}

	/// The program is the canonical implementation of the quotes the Rust,
	/// TypeScript, and Dart SDKs replay.
	#[test]
	fn shared_vectors_match_the_program_quotes() {
		let vectors: serde_json::Value =
			serde_json::from_str(include_str!("../../../../tests/vectors/box-curve.json"))
				.expect("box curve vectors");
		assert_eq!(vector_u64(&vectors["minInventory"]), MIN_CURVE_INVENTORY);
		assert_eq!(vector_u64(&vectors["minStartPrice"]), MIN_CURVE_START_PRICE);
		assert_eq!(
			vector_u64(&vectors["maxFeeBps"]),
			u64::from(MAX_CURVE_FEE_BPS)
		);

		for case in vectors["quotes"].as_array().expect("quotes") {
			let terms = &case["curve"];
			let state = curve(
				vector_u64(&terms["inventory"]),
				vector_u64(&terms["sold"]),
				vector_u64(&terms["startPrice"]),
				vector_u64(&terms["priceStep"]),
				u16::try_from(vector_u64(&terms["feeBps"])).expect("fee"),
			);
			let count = vector_u64(&case["count"]);
			let quote = if case["side"] == "buy" {
				quote_curve_buy(&state, count)
			} else {
				quote_curve_sell(&state, count)
			};

			let expected = &case["expected"];

			if expected.get("error").is_some() {
				assert_eq!(
					quote,
					Err(lootbox_error(LootboxError::InvalidBoxCurve)),
					"{}",
					case["name"]
				);
				continue;
			}

			assert_eq!(
				quote,
				Ok(CurveTrade {
					lamports: vector_u64(&expected["lamports"]),
					fee: vector_u64(&expected["fee"]),
					sold_after: vector_u64(&expected["soldAfter"]),
				}),
				"{}",
				case["name"]
			);
		}

		for case in vectors["plans"].as_array().expect("plans") {
			let input = &case["input"];
			let inventory = vector_u64(&input["inventory"]);
			let start = vector_u64(&input["startPrice"]);
			let end = vector_u64(&input["endPrice"]);
			let step = end
				.saturating_sub(start)
				.checked_div(inventory.saturating_sub(1))
				.unwrap_or(0);
			let fee_bps = u16::try_from(vector_u64(&input["feeBps"])).expect("fee");
			let accepted =
				end >= start && validate_curve_terms(inventory, start, step, fee_bps).is_ok();

			assert_eq!(
				accepted,
				case["expected"].get("error").is_none(),
				"{}",
				case["name"]
			);

			if accepted {
				assert_eq!(step, vector_u64(&case["expected"]["priceStep"]));
				assert_eq!(
					curve_cost(start, step, 0, inventory),
					Ok(vector_u64(&case["expected"]["sellOutLamports"]))
				);
			}
		}
	}

	proptest! {
		#[test]
		fn closed_form_matches_the_loop(
			start in 0u64..=1_000_000_000_000,
			step in 0u64..=1_000_000_000,
			from in 0u64..=100_000,
			count in 0u64..=2_000,
		) {
			prop_assert_eq!(
				curve_cost(start, step, from, count).map(u128::from),
				Ok(looped_cost(start, step, from, count)),
			);
		}

		#[test]
		fn selling_back_returns_exactly_what_buying_paid(
			start in MIN_CURVE_START_PRICE..=10_000_000_000,
			step in 0u64..=100_000_000,
			inventory in MIN_CURVE_INVENTORY..=5_000,
			first in 1u64..=5_000,
			second in 1u64..=5_000,
		) {
			let first = first.min(inventory);
			let second = second.min(inventory - first).max(1);
			prop_assume!(first + second <= inventory);
			let mut state = curve(inventory, 0, start, step, 0);
			let mut reserve = 0u64;

			for count in [first, second] {
				let trade = quote_curve_buy(&state, count).unwrap();
				reserve += trade.lamports;
				state.sold.set(trade.sold_after);
			}

			prop_assert_eq!(u128::from(reserve), looped_cost(start, step, 0, first + second));

			for count in [second, first] {
				let trade = quote_curve_sell(&state, count).unwrap();
				reserve -= trade.lamports;
				state.sold.set(trade.sold_after);
			}

			prop_assert_eq!(reserve, 0);
			prop_assert_eq!(state.sold.get(), 0);
		}
	}
}
