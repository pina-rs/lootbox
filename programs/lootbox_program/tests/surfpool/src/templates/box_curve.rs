//! Box-curve journeys: a locked lootbox sells boxes on a bonding curve,
//! buyers trade against it, and the creator is paid at sell-out or reveal.

use super::*;

const INVENTORY: u64 = 20;
const START_PRICE: u64 = 1_000_000;
const PRICE_STEP: u64 = 50_000;
const FEE_BPS: u16 = 100;

/// A locked lootbox whose creator holds every box.
struct LockedLootbox {
	template: Pubkey,
	mint: Pubkey,
	creator_boxes: Pubkey,
	opens_at: i64,
}

/// The curve PDA and its box account for a lootbox.
struct Curve {
	address: Pubkey,
	bump: u8,
	boxes: Pubkey,
}

fn locked_lootbox(program: &Harness, supply: u64) -> LockedLootbox {
	let lootbox = published_lootbox(program, supply);
	lock_treasury(program, lootbox.template, lootbox.mint, 1);

	lootbox
}

/// A live lootbox with every box minted to its creator, not yet locked.
fn published_lootbox(program: &Harness, supply: u64) -> LockedLootbox {
	let payer = program.payer();
	let (template, bump) = Pubkey::find_program_address(
		&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
		&program.program_id,
	);
	let mint = mint_with_metadata(program, &template);
	let creator_boxes = box_ata(program, &payer, &mint);
	let opens_at = chain_timestamp(program) + 3_600;
	program
		.send(
			&create_template_data(Pubkey::new_unique(), bump, opens_at, false),
			vec![
				AccountMeta::new(payer, true),
				AccountMeta::new(template, false),
				AccountMeta::new_readonly(mint, false),
				AccountMeta::new_readonly(Pubkey::default(), false),
				AccountMeta::new_readonly(token_2022(), false),
			],
		)
		.expect("create template");
	let bundle = add_bundle(program, template, 0, supply, 1);
	fund_sol(program, template, bundle, 100_000).expect("fund SOL prize");
	activate_bundle(program, template, bundle);
	program
		.send(
			&[LootboxInstruction::SealTemplate as u8, 0],
			vec![
				AccountMeta::new_readonly(payer, true),
				AccountMeta::new(template, false),
			],
		)
		.expect("seal template");
	program
		.send(
			&template_mint_data(supply),
			vec![
				AccountMeta::new_readonly(payer, true),
				AccountMeta::new(template, false),
				AccountMeta::new(mint, false),
				AccountMeta::new(creator_boxes, false),
				AccountMeta::new_readonly(token_2022(), false),
			],
		)
		.expect("mint every box");

	LockedLootbox {
		template,
		mint,
		creator_boxes,
		opens_at,
	}
}

fn curve_for(program: &Harness, lootbox: &LockedLootbox) -> Curve {
	let (address, bump) = Pubkey::find_program_address(
		&[b"box-curve", lootbox.template.as_ref()],
		&program.program_id,
	);
	let boxes = box_ata(program, &address, &lootbox.mint);

	Curve {
		address,
		bump,
		boxes,
	}
}

fn open_curve(
	program: &Harness,
	lootbox: &LockedLootbox,
	curve: &Curve,
	inventory: u64,
) -> Result<(), String> {
	let mut data = vec![0; OpenBoxCurveInstruction::SIZE];
	let args = OpenBoxCurveInstruction::initialize(&mut data, |_| Ok(())).expect("open data");
	args.inventory.set(inventory);
	args.start_price.set(START_PRICE);
	args.price_step.set(PRICE_STEP);
	args.fee_bps.set(FEE_BPS);
	args.bump = curve.bump;
	program.send(
		&data,
		vec![
			AccountMeta::new(program.payer(), true),
			AccountMeta::new_readonly(lootbox.template, false),
			AccountMeta::new_readonly(lootbox.mint, false),
			AccountMeta::new(lootbox.creator_boxes, false),
			AccountMeta::new(curve.address, false),
			AccountMeta::new(curve.boxes, false),
			AccountMeta::new_readonly(Pubkey::default(), false),
			AccountMeta::new_readonly(token_2022(), false),
		],
	)
}

fn buy(
	program: &Harness,
	lootbox: &LockedLootbox,
	curve: &Curve,
	buyer: &Keypair,
	destination: Pubkey,
	(count, max_lamports): (u64, u64),
) -> Result<(), String> {
	let mut data = vec![0; BuyCurveBoxesInstruction::SIZE];
	let args = BuyCurveBoxesInstruction::initialize(&mut data, |_| Ok(())).expect("buy data");
	args.count.set(count);
	args.max_lamports.set(max_lamports);
	program.send_with_signers(
		program.instruction(
			&data,
			vec![
				AccountMeta::new(buyer.pubkey(), true),
				AccountMeta::new_readonly(lootbox.template, false),
				AccountMeta::new(curve.address, false),
				AccountMeta::new_readonly(lootbox.mint, false),
				AccountMeta::new(curve.boxes, false),
				AccountMeta::new(destination, false),
				AccountMeta::new(program.payer(), false),
				AccountMeta::new_readonly(Pubkey::default(), false),
				AccountMeta::new_readonly(token_2022(), false),
			],
		),
		&[buyer],
	)
}

fn sell(
	program: &Harness,
	lootbox: &LockedLootbox,
	curve: &Curve,
	seller: &Keypair,
	(count, min_lamports): (u64, u64),
) -> Result<(), String> {
	let mut data = vec![0; SellCurveBoxesInstruction::SIZE];
	let args = SellCurveBoxesInstruction::initialize(&mut data, |_| Ok(())).expect("sell data");
	args.count.set(count);
	args.min_lamports.set(min_lamports);
	let source = Pubkey::find_program_address(
		&[
			seller.pubkey().as_ref(),
			token_2022().as_ref(),
			lootbox.mint.as_ref(),
		],
		&ata_program_id(),
	)
	.0;
	program.send_with_signers(
		program.instruction(
			&data,
			vec![
				AccountMeta::new(seller.pubkey(), true),
				AccountMeta::new_readonly(lootbox.template, false),
				AccountMeta::new(curve.address, false),
				AccountMeta::new_readonly(lootbox.mint, false),
				AccountMeta::new(source, false),
				AccountMeta::new(curve.boxes, false),
				AccountMeta::new(program.payer(), false),
				AccountMeta::new_readonly(token_2022(), false),
			],
		),
		&[seller],
	)
}

fn close_curve(program: &Harness, lootbox: &LockedLootbox, curve: &Curve) -> Result<(), String> {
	program.send(
		&[LootboxInstruction::CloseBoxCurve as u8, 0],
		vec![
			AccountMeta::new(program.payer(), true),
			AccountMeta::new_readonly(lootbox.template, false),
			AccountMeta::new(curve.address, false),
			AccountMeta::new_readonly(lootbox.mint, false),
			AccountMeta::new(curve.boxes, false),
			AccountMeta::new(lootbox.creator_boxes, false),
			AccountMeta::new_readonly(token_2022(), false),
		],
	)
}

fn curve_state(program: &Harness, curve: &Curve) -> BoxCurveStateZc {
	let account = program.account(&curve.address).expect("curve account");

	*BoxCurveState::try_from_bytes(&account.data).expect("curve state")
}

fn funded_trader(program: &Harness, mint: &Pubkey) -> (Keypair, Pubkey) {
	let trader = Keypair::new();
	program
		.fund(&trader.pubkey(), 1_000_000_000)
		.expect("fund trader");
	let boxes = box_ata(program, &trader.pubkey(), mint);

	(trader, boxes)
}

fn assert_error(result: Result<(), String>, error: LootboxError, reason: &str) {
	let message = result.expect_err(reason);
	assert!(
		message.contains(&format!("custom program error: {:#x}", error as u32)),
		"{reason}: {message}",
	);
}

fn cost(from: u64, count: u64) -> u64 {
	(from..from + count)
		.map(|position| START_PRICE + PRICE_STEP * position)
		.sum()
}

fn fee(lamports: u64) -> u64 {
	(lamports * u64::from(FEE_BPS)).div_ceil(10_000)
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn a_curve_prices_trades_and_pays_the_creator_at_sell_out() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		let payer = program.payer();
		let lootbox = locked_lootbox(&program, 25);
		let curve = curve_for(&program, &lootbox);

		assert_error(
			open_curve(&program, &lootbox, &curve, INVENTORY - 1),
			LootboxError::InvalidBoxCurve,
			"a curve needs the minimum inventory",
		);
		open_curve(&program, &lootbox, &curve, INVENTORY).expect("open curve");
		assert!(
			open_curve(&program, &lootbox, &curve, INVENTORY).is_err(),
			"one curve per lootbox at a time"
		);
		let state = curve_state(&program, &curve);
		assert_eq!(state.inventory.get(), INVENTORY);
		assert_eq!(state.closes_at.get(), lootbox.opens_at);
		assert_eq!(state.authority.as_ref(), payer.as_ref());
		assert_eq!(token_balance(&program, &curve.boxes), INVENTORY);
		assert_eq!(token_balance(&program, &lootbox.creator_boxes), 5);

		// A buyer takes three boxes; a limit one lamport short is refused.
		let (buyer, buyer_boxes) = funded_trader(&program, &lootbox.mint);
		let three = cost(0, 3);
		assert_error(
			buy(
				&program,
				&lootbox,
				&curve,
				&buyer,
				buyer_boxes,
				(3, three + fee(three) - 1),
			),
			LootboxError::BoxCurveSlippage,
			"a buy above the limit fails",
		);
		let creator_before = program.balance(&payer).expect("creator balance");
		let curve_before = program.balance(&curve.address).expect("curve balance");
		buy(
			&program,
			&lootbox,
			&curve,
			&buyer,
			buyer_boxes,
			(3, three + fee(three)),
		)
		.expect("buy three");
		assert_eq!(token_balance(&program, &buyer_boxes), 3);
		assert_eq!(
			program.balance(&curve.address).expect("curve balance"),
			curve_before + three,
			"the price goes into the reserve",
		);
		assert!(
			program.balance(&payer).expect("creator balance")
				>= creator_before + fee(three) - 10_000,
			"the fee reaches the creator (less the harness payer's own transaction fee)",
		);
		assert_eq!(curve_state(&program, &curve).reserve.get(), three);

		// A box bought for a friend lands in the friend's account.
		let friend = Keypair::new();
		let friend_boxes = box_ata(&program, &friend.pubkey(), &lootbox.mint);
		let one = cost(3, 1);
		buy(
			&program,
			&lootbox,
			&curve,
			&buyer,
			friend_boxes,
			(1, one + fee(one)),
		)
		.expect("buy for a friend");
		assert_eq!(token_balance(&program, &friend_boxes), 1);
		assert!(
			buy(
				&program,
				&lootbox,
				&curve,
				&buyer,
				curve.boxes,
				(1, u64::MAX)
			)
			.is_err(),
			"the curve cannot sell to itself",
		);

		// Selling back returns the latest positions' prices, less the fee.
		let back = cost(2, 2);
		assert_error(
			sell(
				&program,
				&lootbox,
				&curve,
				&buyer,
				(2, back - fee(back) + 1),
			),
			LootboxError::BoxCurveSlippage,
			"a sale below the limit fails",
		);
		let buyer_before = program.balance(&buyer.pubkey()).expect("buyer balance");
		sell(&program, &lootbox, &curve, &buyer, (2, back - fee(back))).expect("sell two back");
		assert_eq!(
			program.balance(&buyer.pubkey()).expect("buyer balance"),
			buyer_before + back - fee(back),
		);
		let state = curve_state(&program, &curve);
		assert_eq!(state.sold.get(), 2);
		assert_eq!(state.reserve.get(), cost(0, 2));
		assert_eq!(token_balance(&program, &curve.boxes), INVENTORY - 2);

		// Boxes from outside the curve sell in only up to the sold count.
		let (holder, holder_boxes) = funded_trader(&program, &lootbox.mint);
		program
			.send_instruction(
				token_ix::transfer_checked(
					&token_2022(),
					&lootbox.creator_boxes,
					&lootbox.mint,
					&holder_boxes,
					&payer,
					&[],
					3,
					0,
				)
				.expect("airdrop"),
			)
			.expect("airdrop three boxes");
		assert_error(
			sell(&program, &lootbox, &curve, &holder, (3, 0)),
			LootboxError::InvalidBoxCurve,
			"no sale past the sold count",
		);
		assert_error(
			close_curve(&program, &lootbox, &curve),
			LootboxError::BoxCurveTrading,
			"a curve with holders cannot close while trading",
		);

		// Selling out pays the whole reserve to the creator and ends trading.
		let rest = INVENTORY - 2;
		let total = cost(2, rest);
		let creator_before = program.balance(&payer).expect("creator balance");
		buy(
			&program,
			&lootbox,
			&curve,
			&buyer,
			buyer_boxes,
			(rest, total + fee(total)),
		)
		.expect("buy the rest");
		let state = curve_state(&program, &curve);
		assert_eq!(state.sold.get(), INVENTORY);
		assert_eq!(state.reserve.get(), 0);
		assert_ne!(state.sold_out_at.get(), 0);
		assert!(
			program.balance(&payer).expect("creator balance")
				>= creator_before + cost(0, INVENTORY) + fee(total) - 10_000,
			"sell-out pays the reserve and the fee to the creator",
		);
		assert_eq!(
			program.balance(&curve.address).expect("curve balance"),
			rent_minimum(BoxCurveState::SIZE as u64),
			"only rent remains in the curve",
		);
		assert_error(
			buy(
				&program,
				&lootbox,
				&curve,
				&buyer,
				buyer_boxes,
				(1, u64::MAX),
			),
			LootboxError::BoxCurveClosed,
			"nothing to buy after sell-out",
		);
		assert_error(
			sell(&program, &lootbox, &curve, &buyer, (1, 0)),
			LootboxError::BoxCurveClosed,
			"buybacks end at sell-out",
		);

		close_curve(&program, &lootbox, &curve).expect("close sold-out curve");
		assert!(program.account(&curve.address).is_err(), "curve closed");
		assert!(
			program.account(&curve.boxes).is_err(),
			"curve box account closed"
		);

		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn reveal_closes_trading_and_close_returns_reserve_and_boxes() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		let payer = program.payer();
		let lootbox = locked_lootbox(&program, INVENTORY);
		let curve = curve_for(&program, &lootbox);
		open_curve(&program, &lootbox, &curve, INVENTORY).expect("open curve");
		let (buyer, buyer_boxes) = funded_trader(&program, &lootbox.mint);
		let five = cost(0, 5);
		buy(
			&program,
			&lootbox,
			&curve,
			&buyer,
			buyer_boxes,
			(5, five + fee(five)),
		)
		.expect("buy five");

		program
			.surfnet
			.cheatcodes()
			.time_travel_to_timestamp(
				u64::try_from(lootbox.opens_at + 1).expect("timestamp") * 1000,
			)
			.expect("reach the reveal");
		assert_error(
			buy(
				&program,
				&lootbox,
				&curve,
				&buyer,
				buyer_boxes,
				(1, u64::MAX),
			),
			LootboxError::BoxCurveClosed,
			"trading closes at reveal",
		);
		assert_error(
			sell(&program, &lootbox, &curve, &buyer, (1, 0)),
			LootboxError::BoxCurveClosed,
			"buybacks close at reveal",
		);

		let creator_before = program.balance(&payer).expect("creator balance");
		close_curve(&program, &lootbox, &curve).expect("close after reveal");
		assert_eq!(
			token_balance(&program, &lootbox.creator_boxes),
			INVENTORY - 5,
			"unsold boxes return to the creator",
		);
		assert_eq!(
			token_balance(&program, &buyer_boxes),
			5,
			"buyers keep their boxes"
		);
		assert!(
			program.balance(&payer).expect("creator balance") >= creator_before + five,
			"the reserve reaches the creator at close",
		);
		assert!(program.account(&curve.address).is_err(), "curve closed");

		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn a_curve_needs_a_locked_lootbox_and_can_close_before_any_sale() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		let lootbox = published_lootbox(&program, INVENTORY);
		let curve = curve_for(&program, &lootbox);
		assert_error(
			open_curve(&program, &lootbox, &curve, INVENTORY),
			LootboxError::TreasuryUnlocked,
			"odds must be final before anyone pays",
		);
		lock_treasury(&program, lootbox.template, lootbox.mint, 1);
		open_curve(&program, &lootbox, &curve, INVENTORY).expect("open curve");
		close_curve(&program, &lootbox, &curve).expect("a curve with nothing sold closes");
		assert_eq!(token_balance(&program, &lootbox.creator_boxes), INVENTORY);
		assert!(
			program.account(&curve.boxes).is_err(),
			"close also closes the box account"
		);
		// Clients recreate the curve's box account idempotently, as on first open.
		box_ata(&program, &curve.address, &lootbox.mint);
		open_curve(&program, &lootbox, &curve, INVENTORY).expect("a closed curve can reopen");

		program.stop().expect("stop Surfpool");
	});
}
