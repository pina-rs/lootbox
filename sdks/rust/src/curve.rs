//! `no_std` pricing for box curves, matching the program's `buyCurveBoxes`
//! and `sellCurveBoxes` to the lamport.
//!
//! The box at sold position `k` costs `start_price + price_step * k`. Every
//! function here is pinned by `tests/vectors/box-curve.json`, which the
//! program, the TypeScript SDK, and the Dart SDK share.

/// Fewest boxes a curve may sell.
pub const MIN_CURVE_INVENTORY: u64 = 20;
/// Cheapest allowed first box, in lamports.
pub const MIN_CURVE_START_PRICE: u64 = 100_000;
/// Highest creator fee on each buy and sell, in basis points.
pub const MAX_CURVE_FEE_BPS: u16 = 500;

/// Invalid curve terms or trade.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BoxCurveError {
	/// Terms outside the published bounds, an empty trade, a buy past the
	/// inventory, a sale larger than the sold count, or an amount beyond `u64`.
	InvalidBoxCurve,
}

impl core::fmt::Display for BoxCurveError {
	fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
		formatter.write_str(
			"the curve needs at least 20 boxes, a first price of at least 100,000 lamports, a \
			 non-decreasing price, a fee of at most 5%, and trades within its inventory",
		)
	}
}

impl core::error::Error for BoxCurveError {}

/// The terms and live position of a curve.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BoxCurve {
	/// Boxes the creator deposited into the curve.
	pub inventory: u64,
	/// Boxes the curve has sold and not bought back.
	pub sold: u64,
	/// Lamports for the first box.
	pub start_price: u64,
	/// Lamports each box costs more than the one before it.
	pub price_step: u64,
	/// Creator fee in basis points, charged on buys and sells.
	pub fee_bps: u16,
}

/// A priced buy or sell.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CurveQuote {
	/// The curve price of the boxes moved.
	pub lamports: u64,
	/// The creator fee on top of a buy, or taken from a sell.
	pub fee: u64,
	/// What the buyer pays (`lamports + fee`) or the seller receives
	/// (`lamports - fee`).
	pub total: u64,
	/// Boxes sold once the trade lands.
	pub sold_after: u64,
	/// The price of the next box after the trade, or `None` once sold out.
	pub next_price: Option<u64>,
}

/// Terms for a new curve, derived from a start and an end price.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BoxCurvePlan {
	/// Boxes to deposit into the curve.
	pub inventory: u64,
	/// Lamports for the first box.
	pub start_price: u64,
	/// Whole lamports per box; the end price floors to a whole step.
	pub price_step: u64,
	/// The last box's price after flooring.
	pub end_price: u64,
	/// Creator fee in basis points, charged on buys and sells.
	pub fee_bps: u16,
	/// What the creator receives when every box sells, before fees.
	pub sell_out_lamports: u64,
}

/// Price of the box at sold position `position`.
///
/// # Errors
/// Returns [`BoxCurveError::InvalidBoxCurve`] when the price exceeds `u64`.
pub fn curve_price(start_price: u64, price_step: u64, position: u64) -> Result<u64, BoxCurveError> {
	price_step
		.checked_mul(position)
		.and_then(|rise| rise.checked_add(start_price))
		.ok_or(BoxCurveError::InvalidBoxCurve)
}

/// Total price of `count` consecutive positions starting at `from`.
///
/// # Errors
/// Returns [`BoxCurveError::InvalidBoxCurve`] when the total exceeds `u64`.
pub fn curve_cost(
	start_price: u64,
	price_step: u64,
	from: u64,
	count: u64,
) -> Result<u64, BoxCurveError> {
	if count == 0 {
		return Ok(0);
	}

	let count = u128::from(count);
	let positions = u128::from(from)
		.checked_mul(2)
		.and_then(|twice| twice.checked_add(count - 1))
		.and_then(|span| span.checked_mul(count))
		.ok_or(BoxCurveError::InvalidBoxCurve)?
		/ 2;
	let total = count
		.checked_mul(u128::from(start_price))
		.and_then(|base| {
			u128::from(price_step)
				.checked_mul(positions)
				.and_then(|rise| rise.checked_add(base))
		})
		.ok_or(BoxCurveError::InvalidBoxCurve)?;

	u64::try_from(total).map_err(|_| BoxCurveError::InvalidBoxCurve)
}

/// Creator fee on a curve amount, rounded up to the next lamport.
#[must_use]
pub fn curve_fee(lamports: u64, fee_bps: u16) -> u64 {
	let fee = (u128::from(lamports) * u128::from(fee_bps)).div_ceil(10_000);

	// A fee of at most 100% never exceeds `lamports`.
	u64::try_from(fee).unwrap_or(u64::MAX)
}

fn next_price(curve: &BoxCurve, sold_after: u64) -> Result<Option<u64>, BoxCurveError> {
	if sold_after == curve.inventory {
		return Ok(None);
	}

	curve_price(curve.start_price, curve.price_step, sold_after).map(Some)
}

/// Prices a buy of `count` boxes.
///
/// # Errors
/// Returns [`BoxCurveError::InvalidBoxCurve`] for an empty buy or one past
/// the inventory.
pub fn quote_curve_buy(curve: &BoxCurve, count: u64) -> Result<CurveQuote, BoxCurveError> {
	let sold_after = curve
		.sold
		.checked_add(count)
		.filter(|after| count > 0 && *after <= curve.inventory)
		.ok_or(BoxCurveError::InvalidBoxCurve)?;
	let lamports = curve_cost(curve.start_price, curve.price_step, curve.sold, count)?;
	let fee = curve_fee(lamports, curve.fee_bps);

	Ok(CurveQuote {
		lamports,
		fee,
		total: lamports
			.checked_add(fee)
			.ok_or(BoxCurveError::InvalidBoxCurve)?,
		sold_after,
		next_price: next_price(curve, sold_after)?,
	})
}

/// Prices a sale of `count` boxes back to the curve.
///
/// # Errors
/// Returns [`BoxCurveError::InvalidBoxCurve`] for an empty sale or one larger
/// than the sold count.
pub fn quote_curve_sell(curve: &BoxCurve, count: u64) -> Result<CurveQuote, BoxCurveError> {
	let sold_after = curve
		.sold
		.checked_sub(count)
		.filter(|_| count > 0)
		.ok_or(BoxCurveError::InvalidBoxCurve)?;
	let lamports = curve_cost(curve.start_price, curve.price_step, sold_after, count)?;
	let fee = curve_fee(lamports, curve.fee_bps);

	Ok(CurveQuote {
		lamports,
		fee,
		total: lamports - fee,
		sold_after,
		next_price: next_price(curve, sold_after)?,
	})
}

/// Plans a curve from the first and last box prices, mirroring the checks in
/// `openBoxCurve`.
///
/// # Errors
/// Returns [`BoxCurveError::InvalidBoxCurve`] for terms the program would
/// reject, or a falling price.
pub fn plan_box_curve(
	inventory: u64,
	start_price: u64,
	end_price: u64,
	fee_bps: u16,
) -> Result<BoxCurvePlan, BoxCurveError> {
	if inventory < MIN_CURVE_INVENTORY
		|| start_price < MIN_CURVE_START_PRICE
		|| end_price < start_price
		|| fee_bps > MAX_CURVE_FEE_BPS
	{
		return Err(BoxCurveError::InvalidBoxCurve);
	}

	let price_step = (end_price - start_price) / (inventory - 1);
	let sell_out_lamports = curve_cost(start_price, price_step, 0, inventory)?;
	sell_out_lamports
		.checked_add(curve_fee(sell_out_lamports, fee_bps))
		.ok_or(BoxCurveError::InvalidBoxCurve)?;

	Ok(BoxCurvePlan {
		inventory,
		start_price,
		price_step,
		end_price: curve_price(start_price, price_step, inventory - 1)?,
		fee_bps,
		sell_out_lamports,
	})
}

#[cfg(test)]
mod tests {
	use serde_json::Value;

	use super::*;

	fn number(value: &Value) -> u64 {
		value
			.as_str()
			.map_or_else(|| value.as_u64(), |text| text.parse().ok())
			.expect("u64")
	}

	fn vectors() -> Value {
		serde_json::from_str(include_str!("../../../tests/vectors/box-curve.json"))
			.expect("box curve vectors")
	}

	#[test]
	fn constants_match_the_program() {
		let vectors = vectors();

		assert_eq!(number(&vectors["minInventory"]), MIN_CURVE_INVENTORY);
		assert_eq!(number(&vectors["minStartPrice"]), MIN_CURVE_START_PRICE);
		assert_eq!(number(&vectors["maxFeeBps"]), u64::from(MAX_CURVE_FEE_BPS));
	}

	#[test]
	fn quotes_match_the_shared_vectors() {
		for case in vectors()["quotes"].as_array().expect("quotes") {
			let terms = &case["curve"];
			let curve = BoxCurve {
				inventory: number(&terms["inventory"]),
				sold: number(&terms["sold"]),
				start_price: number(&terms["startPrice"]),
				price_step: number(&terms["priceStep"]),
				fee_bps: u16::try_from(number(&terms["feeBps"])).expect("fee"),
			};
			let count = number(&case["count"]);
			let quote = if case["side"] == "buy" {
				quote_curve_buy(&curve, count)
			} else {
				quote_curve_sell(&curve, count)
			};
			let expected = &case["expected"];
			let wanted = if expected.get("error").is_some() {
				Err(BoxCurveError::InvalidBoxCurve)
			} else {
				Ok(CurveQuote {
					lamports: number(&expected["lamports"]),
					fee: number(&expected["fee"]),
					total: number(&expected["total"]),
					sold_after: number(&expected["soldAfter"]),
					next_price: (!expected["nextPrice"].is_null())
						.then(|| number(&expected["nextPrice"])),
				})
			};

			assert_eq!(quote, wanted, "{}", case["name"]);
		}
	}

	#[test]
	fn plans_match_the_shared_vectors() {
		for case in vectors()["plans"].as_array().expect("plans") {
			let input = &case["input"];
			let plan = plan_box_curve(
				number(&input["inventory"]),
				number(&input["startPrice"]),
				number(&input["endPrice"]),
				u16::try_from(number(&input["feeBps"])).expect("fee"),
			);
			let expected = &case["expected"];

			if expected.get("error").is_some() {
				assert_eq!(
					plan,
					Err(BoxCurveError::InvalidBoxCurve),
					"{}",
					case["name"]
				);
				continue;
			}

			let plan = plan.expect("plan");
			assert_eq!(
				plan.price_step,
				number(&expected["priceStep"]),
				"{}",
				case["name"]
			);
			assert_eq!(
				plan.end_price,
				number(&expected["endPrice"]),
				"{}",
				case["name"]
			);
			assert_eq!(
				plan.sell_out_lamports,
				number(&expected["sellOutLamports"]),
				"{}",
				case["name"]
			);
		}
	}
}
