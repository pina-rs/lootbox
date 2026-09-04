use lootbox_program::*;
use pina::Address;
use pina::ProgramError;

#[test]
fn instruction_discriminators_are_stable() {
	assert_eq!(LootboxInstruction::CreateLootbox as u8, 0);
	assert_eq!(LootboxInstruction::RequestOpen as u8, 5);
	assert_eq!(LootboxInstruction::WithdrawSurplus as u8, 9);
	assert_eq!(LootboxInstruction::LockTreasury as u8, 37);
}

#[test]
fn parse_instruction_rejects_wrong_program_id() {
	let wrong_id = Address::new_from_array([9u8; 32]);
	let data = [LootboxInstruction::CreateLootbox as u8];
	let result = pina::parse_instruction::<LootboxInstruction>(&wrong_id, &ID, &data);

	assert!(matches!(result, Err(ProgramError::IncorrectProgramId)));
}

#[test]
fn add_outcome_instruction_roundtrips() {
	let mut data = [0u8; AddOutcomeInstruction::SIZE];
	let args = AddOutcomeInstruction::initialize(&mut data).expect("instruction storage");
	args.weight.set(25);
	args.reward_lamports.set(1_000_000);

	let decoded = AddOutcomeInstruction::try_from_bytes(&data).expect("decode instruction");

	assert_eq!(decoded.weight.get(), 25);
	assert_eq!(decoded.reward_lamports.get(), 1_000_000);
}
