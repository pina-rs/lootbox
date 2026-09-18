use super::*;

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn custody_entropy_and_bound_delivery_resist_adversarial_paths() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		deploy_bubblegum_fixture(&program);
		let (queue, oracle, cpi) = oracle_fixture(&mut program);
		let payer = program.payer();
		let recipient = Keypair::new();
		program
			.fund(&recipient.pubkey(), 100_000_000)
			.expect("recipient fee funds");
		let leaves = [mock_leaf(41, 7), mock_leaf(99, 2), mock_leaf(5, 31)];
		let tree = initialize_mock_tree(&program, &leaves);
		let tree_address = tree.pubkey();
		let (template, template_bump) = Pubkey::find_program_address(
			&[b"template", payer.as_ref(), &1u64.to_le_bytes()],
			&program.program_id,
		);
		let mint = mint_with_metadata(&program, &template);
		let creator_ata = box_ata(&program, &payer, &mint);
		let recipient_ata = box_ata(&program, &recipient.pubkey(), &mint);
		let opens_at = chain_timestamp(&program) + 3_600;
		program
			.send(
				&create_template_data(queue, template_bump, opens_at, true),
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("create PrizePool template");
		let bundle = add_bundle(&program, template, 0, 3, 1);
		let (pool, pool_bump) = Pubkey::find_program_address(
			&[b"prize-pool", bundle.as_ref(), &[0]],
			&program.program_id,
		);
		let mut create_pool = vec![0; CreatePrizePoolInstruction::SIZE];
		let create_args = CreatePrizePoolInstruction::initialize(&mut create_pool, |_| Ok(()))
			.expect("create pool data");
		create_args.asset_index = 0;
		create_args.bump = pool_bump;
		program
			.send(
				&create_pool,
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(bundle, false),
					AccountMeta::new(pool, false),
					AccountMeta::new_readonly(tree_address, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("create compact PrizePool");
		let custody = PrizePoolCustodyContext {
			template,
			bundle,
			pool,
			tree: tree_address,
		};
		assert!(
			fund_sol(&program, template, bundle, 1).is_err(),
			"a reserved PrizePool slot cannot be overwritten by ordinary funding",
		);
		assert!(
			program
				.send(
					&[LootboxInstruction::CancelBundle as u8, 0],
					vec![
						AccountMeta::new(payer, true),
						AccountMeta::new_readonly(template, false),
						AccountMeta::new(bundle, false),
					],
				)
				.is_err(),
			"a bundle cannot close while its pool owns or reserves inventory",
		);
		assert_eq!(
			program.account(&pool).expect("empty pool").data.len(),
			PrizePoolState::MIN_SIZE,
			"compact state starts without preallocated bitmap capacity",
		);

		let initial_root = mock_tree_root(&program, tree_address);
		let mutable_leaf = mock_leaf_with_mutability(leaves[0].nonce, leaves[0].index, true);
		assert!(
			prepare_prize_pool_item(
				&program,
				template,
				bundle,
				pool,
				0,
				mutable_leaf,
				&mock_metadata(mutable_leaf.nonce, true),
			)
			.is_err(),
			"mutable metadata is rejected on-chain before custody",
		);
		let mut mismatched = leaves[0];
		mismatched.data_hash[0] ^= 1;
		assert!(
			prepare_prize_pool_item(
				&program,
				template,
				bundle,
				pool,
				0,
				mismatched,
				&mock_metadata(mismatched.nonce, false),
			)
			.is_err(),
			"a metadata preimage that does not match the leaf hashes is rejected",
		);
		assert!(
			program
				.account(&prize_pool_item_address(&program, pool, 0).0)
				.is_err(),
			"failed admission leaves no item PDA behind",
		);
		prepare_prize_pool_item(
			&program,
			template,
			bundle,
			pool,
			0,
			leaves[0],
			&mock_metadata(leaves[0].nonce, false),
		)
		.expect("immutable metadata is admitted");
		assert!(
			program
				.send(
					&[LootboxInstruction::SealPrizePool as u8, 0],
					vec![
						AccountMeta::new(payer, true),
						AccountMeta::new_readonly(template, false),
						AccountMeta::new(bundle, false),
						AccountMeta::new(pool, false),
					],
				)
				.is_err(),
			"a prepared but untransferred item blocks sealing",
		);
		transfer_prepared_prize_pool_item(&program, &custody, 0, leaves[0], initial_root)
			.expect("first leaf enters PDA custody");
		prepare_prize_pool_item(
			&program,
			template,
			bundle,
			pool,
			1,
			leaves[1],
			&mock_metadata(leaves[1].nonce, false),
		)
		.expect("second immutable item is admitted");
		assert!(
			transfer_prepared_prize_pool_item(&program, &custody, 1, leaves[1], initial_root,)
				.is_err(),
			"a stale proof cannot be reused after the tree root changes",
		);
		transfer_prepared_prize_pool_item(
			&program,
			&custody,
			1,
			leaves[1],
			mock_tree_root(&program, tree_address),
		)
		.expect("prepared item resumes with a fresh proof");
		assert!(
			direct_mock_transfer(
				&program,
				tree_address,
				payer,
				Pubkey::new_unique(),
				leaves[0],
				mock_tree_root(&program, tree_address),
			)
			.is_err(),
			"the former tree owner cannot transfer a leaf after PDA custody",
		);
		for (pool_index, leaf) in leaves.iter().copied().enumerate().skip(2) {
			deposit_prize_pool_item(
				&program,
				&custody,
				u32::try_from(pool_index).expect("pool index"),
				leaf,
				mock_tree_root(&program, tree_address),
			)
			.expect("fresh proof deposits next leaf");
		}
		assert_eq!(
			program.account(&pool).expect("funded pool").data.len(),
			PrizePoolState::MIN_SIZE + 1,
			"three leaves rent exactly one bitmap byte",
		);
		program
			.send(
				&[LootboxInstruction::SealPrizePool as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(bundle, false),
					AccountMeta::new(pool, false),
				],
			)
			.expect("seal exact pool inventory");
		activate_bundle(&program, template, bundle);
		program
			.send(
				&[LootboxInstruction::SealTemplate as u8, 0],
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
				],
			)
			.expect("publish pool treasury");
		program
			.send(
				&template_mint_data(3),
				vec![
					AccountMeta::new_readonly(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new(mint, false),
					AccountMeta::new(creator_ata, false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("mint exactly three pool tickets");
		lock_treasury(&program, template, mint, 1);
		program
			.send_instruction(
				token_ix::transfer_checked(
					&token_2022(),
					&creator_ata,
					&mint,
					&recipient_ata,
					&payer,
					&[],
					3,
					0,
				)
				.expect("box transfer"),
			)
			.expect("gift pool-backed boxes");
		program
			.surfnet
			.cheatcodes()
			.time_travel_to_timestamp(u64::try_from(opens_at + 1).expect("time") * 1_000)
			.expect("unlock pool boxes");

		let mut openings = Vec::new();
		for entropy in 1..=3u8 {
			let randomness = Keypair::new();
			let (opening, opening_bump) = Pubkey::find_program_address(
				&[
					b"template-opening",
					template.as_ref(),
					randomness.pubkey().as_ref(),
				],
				&program.program_id,
			);
			program
				.send_with_signers(
					program.instruction(
						&template_request_data(opening_bump, recipient.pubkey()),
						template_request_accounts(&TemplateRequestContext {
							owner: recipient.pubkey(),
							template,
							mint,
							ata: recipient_ata,
							opening,
							randomness: randomness.pubkey(),
							queue,
							oracle,
							cpi: &cpi,
						}),
					),
					&[&recipient, &randomness],
				)
				.expect("burn and commit pool box");
			openings.push((opening, randomness.pubkey(), entropy));
		}
		program.advance_one_slot().expect("oracle reveal slot");
		for (opening, randomness, entropy) in &openings {
			fulfill(
				&FulfillContext {
					program: &program,
					payer: &recipient,
					template,
					opening: *opening,
					randomness: *randomness,
					queue,
					oracle,
					cpi: &cpi,
				},
				*entropy,
			)
			.expect("verify committed pool entropy");
		}

		let service_vault = Pubkey::find_program_address(
			&[b"service-vault", template.as_ref()],
			&program.program_id,
		)
		.0;
		let mut selected = [false; 3];
		for (position, (opening, ..)) in openings.iter().enumerate() {
			let (result_receipt, receipt_bump) =
				result_receipt_address(&program, *opening).expect("canonical result receipt");
			let mut ordinary = vec![0; AllocateTemplateOpenInstruction::SIZE];
			AllocateTemplateOpenInstruction::initialize(&mut ordinary, |_| Ok(()))
				.expect("ordinary allocation")
				.result_receipt_bump = receipt_bump;
			assert!(
				program
					.send(
						&ordinary,
						vec![
							AccountMeta::new(template, false),
							AccountMeta::new(*opening, false),
							AccountMeta::new_readonly(bundle, false),
							AccountMeta::new(service_vault, false),
							AccountMeta::new(result_receipt, false),
							AccountMeta::new_readonly(Pubkey::default(), false),
						],
					)
					.is_err(),
				"ordinary allocation cannot bypass PrizePool item reservation",
			);
			let mut allocation = vec![0; AllocatePrizePoolOpenInstruction::SIZE];
			AllocatePrizePoolOpenInstruction::initialize(&mut allocation, |_| Ok(()))
				.expect("pool allocation")
				.result_receipt_bump = receipt_bump;
			program
				.send(
					&allocation,
					vec![
						AccountMeta::new(template, false),
						AccountMeta::new(*opening, false),
						AccountMeta::new_readonly(bundle, false),
						AccountMeta::new(pool, false),
						AccountMeta::new(service_vault, false),
						AccountMeta::new(result_receipt, false),
						AccountMeta::new_readonly(Pubkey::default(), false),
					],
				)
				.expect("entropy reserves one available pool item");
			let opening_account = program.account(opening).expect("allocated opening");
			let state =
				TemplateOpeningState::try_from_bytes(&opening_account.data).expect("opening state");
			assert!(state.has_pool_assignment.get());
			assert_eq!(state.selected_pool_asset, 0);
			let pool_index =
				usize::try_from(state.selected_pool_item.get()).expect("selected pool index");
			assert!(!selected[pool_index], "pool item cannot be assigned twice");
			selected[pool_index] = true;
			let context = PrizePoolClaimContext {
				template,
				opening: *opening,
				bundle,
				pool,
				tree: tree_address,
				recipient: recipient.pubkey(),
				pool_index: u32::try_from(pool_index).expect("pool index"),
			};
			let claim_leaf = if position == 0 {
				let mut substituted_hash = leaves[pool_index];
				substituted_hash.data_hash[0] ^= 1;
				assert!(
					claim_prize_pool_item(
						&program,
						&context,
						substituted_hash,
						&mock_metadata(substituted_hash.nonce, false),
						mock_tree_root(&program, tree_address),
					)
					.is_err(),
					"uncommitted hash substitution fails in Bubblegum",
				);
				let changed_metadata =
					mock_metadata_with_creator_verification(leaves[pool_index].nonce, false, true);
				let changed = mock_leaf_from_metadata(
					leaves[pool_index].nonce,
					leaves[pool_index].index,
					&changed_metadata,
				);
				update_mock_leaf_hashes(&program, tree_address, changed)
					.expect("creator verification changes the current leaf hashes");
				let substituted = PrizePoolClaimContext {
					recipient: payer,
					..context
				};
				assert!(
					claim_prize_pool_item(
						&program,
						&substituted,
						changed,
						&changed_metadata,
						mock_tree_root(&program, tree_address),
					)
					.is_err(),
					"permissionless relayers cannot substitute the bound recipient",
				);
				(changed, changed_metadata)
			} else {
				(
					leaves[pool_index],
					mock_metadata(leaves[pool_index].nonce, false),
				)
			};
			claim_prize_pool_item(
				&program,
				&context,
				claim_leaf.0,
				&claim_leaf.1,
				mock_tree_root(&program, tree_address),
			)
			.expect("deliver the same asset despite verification-flag drift");
			assert!(
				program
					.account(
						&prize_pool_item_address(
							&program,
							pool,
							u32::try_from(pool_index).expect("pool index"),
						)
						.0,
					)
					.is_err(),
				"claimed per-item rent is closed to the fixed creator",
			);
		}
		assert_eq!(selected, [true; 3]);
		let tree_account = program.account(&tree_address).expect("delivered tree");
		for leaf_index in 0..3 {
			let owner_offset = 76 + leaf_index * 108;
			assert_eq!(
				&tree_account.data[owner_offset..owner_offset + 32],
				recipient.pubkey().as_ref(),
				"every leaf exits PDA custody only to the recorded recipient",
			);
		}
		program.stop().expect("stop Surfpool");
	});
}

#[test]
#[ignore = "run with `devenv shell -- test:surfpool`"]
fn staged_recovery_is_tail_only_atomic_and_required_before_cancellation() {
	pina_test::run(async {
		let mut program = Harness::start(Pubkey::new_from_array(ID.to_bytes()))
			.await
			.expect("Surfpool");
		deploy_bubblegum_fixture(&program);
		let payer = program.payer();
		let leaves = [mock_leaf(8, 3), mock_leaf(13, 4)];
		let tree = initialize_mock_tree(&program, &leaves);
		let tree_address = tree.pubkey();
		let (template, template_bump) = Pubkey::find_program_address(
			&[b"template", payer.as_ref(), &1_u64.to_le_bytes()],
			&program.program_id,
		);
		let mint = mint_with_metadata(&program, &template);
		program
			.send(
				&create_template_data(Pubkey::new_unique(), template_bump, 0, false),
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new(template, false),
					AccountMeta::new_readonly(mint, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
					AccountMeta::new_readonly(token_2022(), false),
				],
			)
			.expect("template");
		let bundle = add_bundle(&program, template, 0, 2, 1);
		let (pool, pool_bump) = Pubkey::find_program_address(
			&[b"prize-pool", bundle.as_ref(), &[0]],
			&program.program_id,
		);
		let mut create_pool = vec![0; CreatePrizePoolInstruction::SIZE];
		let create_args = CreatePrizePoolInstruction::initialize(&mut create_pool, |_| Ok(()))
			.expect("create pool");
		create_args.asset_index = 0;
		create_args.bump = pool_bump;
		program
			.send(
				&create_pool,
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(bundle, false),
					AccountMeta::new(pool, false),
					AccountMeta::new_readonly(tree_address, false),
					AccountMeta::new_readonly(Pubkey::default(), false),
				],
			)
			.expect("create pool");
		let custody = PrizePoolCustodyContext {
			template,
			bundle,
			pool,
			tree: tree_address,
		};
		prepare_prize_pool_item(
			&program,
			template,
			bundle,
			pool,
			0,
			leaves[0],
			&mock_metadata(leaves[0].nonce, false),
		)
		.expect("prepare resumable item");
		assert!(
			program
				.send(
					&[LootboxInstruction::ClosePrizePool as u8, 0],
					vec![
						AccountMeta::new(payer, true),
						AccountMeta::new_readonly(template, false),
						AccountMeta::new(bundle, false),
						AccountMeta::new(pool, false),
					],
				)
				.is_err(),
			"a prepared item blocks pool closure",
		);
		let (prepared_item, _) = prize_pool_item_address(&program, pool, 0);
		program
			.send(
				&[LootboxInstruction::CancelPrizePoolItem as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new_readonly(bundle, false),
					AccountMeta::new(pool, false),
					AccountMeta::new(prepared_item, false),
				],
			)
			.expect("cancel crashed admission cleanly");
		assert!(
			program.account(&prepared_item).is_err(),
			"cancel returns prepared item rent without touching the tree",
		);
		for (pool_index, leaf) in leaves.iter().copied().enumerate() {
			deposit_prize_pool_item(
				&program,
				&custody,
				u32::try_from(pool_index).expect("pool index"),
				leaf,
				mock_tree_root(&program, tree_address),
			)
			.expect("deposit staged item");
		}

		let pool_before = program.account(&pool).expect("pool before invalid reclaim");
		let bundle_before = program
			.account(&bundle)
			.expect("bundle before invalid reclaim");
		let tree_before = program
			.account(&tree_address)
			.expect("tree before invalid reclaim");
		assert!(
			reclaim_prize_pool_item(
				&program,
				&custody,
				mint,
				0,
				leaves[0],
				mock_tree_root(&program, tree_address),
			)
			.is_err(),
			"an unfinished pool can reclaim only its append-only tail",
		);
		assert_eq!(
			program.account(&pool).expect("pool rollback").data,
			pool_before.data
		);
		assert_eq!(
			program.account(&bundle).expect("bundle rollback").data,
			bundle_before.data,
		);
		assert_eq!(
			program.account(&tree_address).expect("tree rollback").data,
			tree_before.data,
		);

		reclaim_prize_pool_item(
			&program,
			&custody,
			mint,
			1,
			leaves[1],
			mock_tree_root(&program, tree_address),
		)
		.expect("reclaim tail");
		assert!(
			program
				.send(
					&[LootboxInstruction::ActivateBundle as u8, 0],
					vec![
						AccountMeta::new(payer, true),
						AccountMeta::new(template, false),
						AccountMeta::new(bundle, false),
						AccountMeta::new_readonly(Pubkey::default(), false),
					],
				)
				.is_err(),
			"partially recovered pools cannot activate",
		);
		reclaim_prize_pool_item(
			&program,
			&custody,
			mint,
			0,
			leaves[0],
			mock_tree_root(&program, tree_address),
		)
		.expect("reclaim final staged item");
		assert_eq!(
			program.account(&pool).expect("shrunk pool").data.len(),
			PrizePoolState::MIN_SIZE,
			"compact pool releases its bitmap rent as the tail unwinds",
		);
		program
			.send(
				&[LootboxInstruction::ClosePrizePool as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(bundle, false),
					AccountMeta::new(pool, false),
				],
			)
			.expect("close empty pool and clear manifest reservation");
		program
			.send(
				&[LootboxInstruction::CancelBundle as u8, 0],
				vec![
					AccountMeta::new(payer, true),
					AccountMeta::new_readonly(template, false),
					AccountMeta::new(bundle, false),
				],
			)
			.expect("cancel parent after custody is empty");
		assert!(program.account(&pool).is_err());
		assert!(program.account(&bundle).is_err());
		for pool_index in 0..2_u32 {
			assert!(
				program
					.account(&prize_pool_item_address(&program, pool, pool_index).0)
					.is_err(),
				"recovered item account is closed",
			);
		}
		program.stop().expect("stop Surfpool");
	});
}
