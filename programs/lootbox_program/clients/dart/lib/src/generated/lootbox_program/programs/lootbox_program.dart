// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'dart:typed_data';

import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_core/solana_kit_codecs_core.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';
import 'package:solana_kit_errors/solana_kit_errors.dart';
import 'package:solana_kit_instructions/solana_kit_instructions.dart';

import '../instructions/instructions.dart';

/// The address of the LootboxProgram program.
const lootboxProgramProgramAddress = Address(
  'Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op',
);

/// Known accounts for the LootboxProgram program.
enum LootboxProgramAccount { lootboxState, vaultState, openingState }

/// Known instructions for the LootboxProgram program.
enum LootboxProgramInstruction {
  createLootbox,
  addOutcome,
  deposit,
  seal,
  mintBoxes,
  requestOpen,
  settleOpen,
  refundOpen,
  closeOpening,
  withdrawSurplus,
}

/// Identifies the type of a LootboxProgram instruction.
LootboxProgramInstruction identifyLootboxProgramInstruction(Uint8List data) {
  if (containsBytes(data, getU8Encoder().encode(0), 0)) {
    return LootboxProgramInstruction.createLootbox;
  }
  if (containsBytes(data, getU8Encoder().encode(1), 0)) {
    return LootboxProgramInstruction.addOutcome;
  }
  if (containsBytes(data, getU8Encoder().encode(2), 0)) {
    return LootboxProgramInstruction.deposit;
  }
  if (containsBytes(data, getU8Encoder().encode(3), 0)) {
    return LootboxProgramInstruction.seal;
  }
  if (containsBytes(data, getU8Encoder().encode(4), 0)) {
    return LootboxProgramInstruction.mintBoxes;
  }
  if (containsBytes(data, getU8Encoder().encode(5), 0)) {
    return LootboxProgramInstruction.requestOpen;
  }
  if (containsBytes(data, getU8Encoder().encode(6), 0)) {
    return LootboxProgramInstruction.settleOpen;
  }
  if (containsBytes(data, getU8Encoder().encode(7), 0)) {
    return LootboxProgramInstruction.refundOpen;
  }
  if (containsBytes(data, getU8Encoder().encode(8), 0)) {
    return LootboxProgramInstruction.closeOpening;
  }
  if (containsBytes(data, getU8Encoder().encode(9), 0)) {
    return LootboxProgramInstruction.withdrawSurplus;
  }

  throw SolanaError(SolanaErrorCode.programClientsFailedToIdentifyInstruction, {
    'instructionData': data,
    'programName': 'lootboxProgram',
  });
}

/// A parsed instruction from the LootboxProgram program.
sealed class ParsedLootboxProgramInstruction {
  const ParsedLootboxProgramInstruction(this.instructionType);

  final LootboxProgramInstruction instructionType;
}

/// A parsed CreateLootbox instruction.
final class ParsedCreateLootbox extends ParsedLootboxProgramInstruction {
  const ParsedCreateLootbox({required this.data})
    : super(LootboxProgramInstruction.createLootbox);

  final CreateLootboxInstructionData data;
}

/// A parsed AddOutcome instruction.
final class ParsedAddOutcome extends ParsedLootboxProgramInstruction {
  const ParsedAddOutcome({required this.data})
    : super(LootboxProgramInstruction.addOutcome);

  final AddOutcomeInstructionData data;
}

/// A parsed Deposit instruction.
final class ParsedDeposit extends ParsedLootboxProgramInstruction {
  const ParsedDeposit({required this.data})
    : super(LootboxProgramInstruction.deposit);

  final DepositInstructionData data;
}

/// A parsed Seal instruction.
final class ParsedSeal extends ParsedLootboxProgramInstruction {
  const ParsedSeal({required this.data})
    : super(LootboxProgramInstruction.seal);

  final SealInstructionData data;
}

/// A parsed MintBoxes instruction.
final class ParsedMintBoxes extends ParsedLootboxProgramInstruction {
  const ParsedMintBoxes({required this.data})
    : super(LootboxProgramInstruction.mintBoxes);

  final MintBoxesInstructionData data;
}

/// A parsed RequestOpen instruction.
final class ParsedRequestOpen extends ParsedLootboxProgramInstruction {
  const ParsedRequestOpen({required this.data})
    : super(LootboxProgramInstruction.requestOpen);

  final RequestOpenInstructionData data;
}

/// A parsed SettleOpen instruction.
final class ParsedSettleOpen extends ParsedLootboxProgramInstruction {
  const ParsedSettleOpen({required this.data})
    : super(LootboxProgramInstruction.settleOpen);

  final SettleOpenInstructionData data;
}

/// A parsed RefundOpen instruction.
final class ParsedRefundOpen extends ParsedLootboxProgramInstruction {
  const ParsedRefundOpen({required this.data})
    : super(LootboxProgramInstruction.refundOpen);

  final RefundOpenInstructionData data;
}

/// A parsed CloseOpening instruction.
final class ParsedCloseOpening extends ParsedLootboxProgramInstruction {
  const ParsedCloseOpening({required this.data})
    : super(LootboxProgramInstruction.closeOpening);

  final CloseOpeningInstructionData data;
}

/// A parsed WithdrawSurplus instruction.
final class ParsedWithdrawSurplus extends ParsedLootboxProgramInstruction {
  const ParsedWithdrawSurplus({required this.data})
    : super(LootboxProgramInstruction.withdrawSurplus);

  final WithdrawSurplusInstructionData data;
}

/// Parses a LootboxProgram instruction.
ParsedLootboxProgramInstruction parseLootboxProgramInstruction(
  Instruction instruction,
) {
  return switch (identifyLootboxProgramInstruction(
    instruction.data ?? Uint8List(0),
  )) {
    LootboxProgramInstruction.createLootbox => ParsedCreateLootbox(
      data: parseCreateLootboxInstruction(instruction),
    ),
    LootboxProgramInstruction.addOutcome => ParsedAddOutcome(
      data: parseAddOutcomeInstruction(instruction),
    ),
    LootboxProgramInstruction.deposit => ParsedDeposit(
      data: parseDepositInstruction(instruction),
    ),
    LootboxProgramInstruction.seal => ParsedSeal(
      data: parseSealInstruction(instruction),
    ),
    LootboxProgramInstruction.mintBoxes => ParsedMintBoxes(
      data: parseMintBoxesInstruction(instruction),
    ),
    LootboxProgramInstruction.requestOpen => ParsedRequestOpen(
      data: parseRequestOpenInstruction(instruction),
    ),
    LootboxProgramInstruction.settleOpen => ParsedSettleOpen(
      data: parseSettleOpenInstruction(instruction),
    ),
    LootboxProgramInstruction.refundOpen => ParsedRefundOpen(
      data: parseRefundOpenInstruction(instruction),
    ),
    LootboxProgramInstruction.closeOpening => ParsedCloseOpening(
      data: parseCloseOpeningInstruction(instruction),
    ),
    LootboxProgramInstruction.withdrawSurplus => ParsedWithdrawSurplus(
      data: parseWithdrawSurplusInstruction(instruction),
    ),
  };
}
