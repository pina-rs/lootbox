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
enum LootboxProgramAccount {
  lootboxState,
  vaultState,
  openingState,
  templateState,
  bundleState,
  templateOpeningState,
}

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
  createTemplate,
  addBundle,
  fundSolPrize,
  fundTokenPrize,
  sealTemplate,
  mintTemplateBoxes,
  requestTemplateOpen,
  fulfillTemplateOpen,
  allocateTemplateOpen,
  claimSolPrize,
  claimTokenPrize,
  retireTemplate,
  reclaimSolPrize,
  reclaimTokenPrize,
  closeTemplateOpening,
  activateBundle,
  cancelBundle,
  fundMetadataNftPrize,
  claimMetadataNftPrize,
  reclaimMetadataNftPrize,
  fundCoreAssetPrize,
  claimCoreAssetPrize,
  reclaimCoreAssetPrize,
  fundCompressedNftPrize,
  claimCompressedNftPrize,
  reclaimCompressedNftPrize,
  forfeitTemplateOpen,
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
  if (containsBytes(data, getU8Encoder().encode(10), 0)) {
    return LootboxProgramInstruction.createTemplate;
  }
  if (containsBytes(data, getU8Encoder().encode(11), 0)) {
    return LootboxProgramInstruction.addBundle;
  }
  if (containsBytes(data, getU8Encoder().encode(12), 0)) {
    return LootboxProgramInstruction.fundSolPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(13), 0)) {
    return LootboxProgramInstruction.fundTokenPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(14), 0)) {
    return LootboxProgramInstruction.sealTemplate;
  }
  if (containsBytes(data, getU8Encoder().encode(15), 0)) {
    return LootboxProgramInstruction.mintTemplateBoxes;
  }
  if (containsBytes(data, getU8Encoder().encode(16), 0)) {
    return LootboxProgramInstruction.requestTemplateOpen;
  }
  if (containsBytes(data, getU8Encoder().encode(17), 0)) {
    return LootboxProgramInstruction.fulfillTemplateOpen;
  }
  if (containsBytes(data, getU8Encoder().encode(18), 0)) {
    return LootboxProgramInstruction.allocateTemplateOpen;
  }
  if (containsBytes(data, getU8Encoder().encode(19), 0)) {
    return LootboxProgramInstruction.claimSolPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(20), 0)) {
    return LootboxProgramInstruction.claimTokenPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(21), 0)) {
    return LootboxProgramInstruction.retireTemplate;
  }
  if (containsBytes(data, getU8Encoder().encode(22), 0)) {
    return LootboxProgramInstruction.reclaimSolPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(23), 0)) {
    return LootboxProgramInstruction.reclaimTokenPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(24), 0)) {
    return LootboxProgramInstruction.closeTemplateOpening;
  }
  if (containsBytes(data, getU8Encoder().encode(25), 0)) {
    return LootboxProgramInstruction.activateBundle;
  }
  if (containsBytes(data, getU8Encoder().encode(26), 0)) {
    return LootboxProgramInstruction.cancelBundle;
  }
  if (containsBytes(data, getU8Encoder().encode(27), 0)) {
    return LootboxProgramInstruction.fundMetadataNftPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(28), 0)) {
    return LootboxProgramInstruction.claimMetadataNftPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(29), 0)) {
    return LootboxProgramInstruction.reclaimMetadataNftPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(30), 0)) {
    return LootboxProgramInstruction.fundCoreAssetPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(31), 0)) {
    return LootboxProgramInstruction.claimCoreAssetPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(32), 0)) {
    return LootboxProgramInstruction.reclaimCoreAssetPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(33), 0)) {
    return LootboxProgramInstruction.fundCompressedNftPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(34), 0)) {
    return LootboxProgramInstruction.claimCompressedNftPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(35), 0)) {
    return LootboxProgramInstruction.reclaimCompressedNftPrize;
  }
  if (containsBytes(data, getU8Encoder().encode(36), 0)) {
    return LootboxProgramInstruction.forfeitTemplateOpen;
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

/// A parsed CreateTemplate instruction.
final class ParsedCreateTemplate extends ParsedLootboxProgramInstruction {
  const ParsedCreateTemplate({required this.data})
    : super(LootboxProgramInstruction.createTemplate);

  final CreateTemplateInstructionData data;
}

/// A parsed AddBundle instruction.
final class ParsedAddBundle extends ParsedLootboxProgramInstruction {
  const ParsedAddBundle({required this.data})
    : super(LootboxProgramInstruction.addBundle);

  final AddBundleInstructionData data;
}

/// A parsed FundSolPrize instruction.
final class ParsedFundSolPrize extends ParsedLootboxProgramInstruction {
  const ParsedFundSolPrize({required this.data})
    : super(LootboxProgramInstruction.fundSolPrize);

  final FundSolPrizeInstructionData data;
}

/// A parsed FundTokenPrize instruction.
final class ParsedFundTokenPrize extends ParsedLootboxProgramInstruction {
  const ParsedFundTokenPrize({required this.data})
    : super(LootboxProgramInstruction.fundTokenPrize);

  final FundTokenPrizeInstructionData data;
}

/// A parsed SealTemplate instruction.
final class ParsedSealTemplate extends ParsedLootboxProgramInstruction {
  const ParsedSealTemplate({required this.data})
    : super(LootboxProgramInstruction.sealTemplate);

  final SealTemplateInstructionData data;
}

/// A parsed MintTemplateBoxes instruction.
final class ParsedMintTemplateBoxes extends ParsedLootboxProgramInstruction {
  const ParsedMintTemplateBoxes({required this.data})
    : super(LootboxProgramInstruction.mintTemplateBoxes);

  final MintTemplateBoxesInstructionData data;
}

/// A parsed RequestTemplateOpen instruction.
final class ParsedRequestTemplateOpen extends ParsedLootboxProgramInstruction {
  const ParsedRequestTemplateOpen({required this.data})
    : super(LootboxProgramInstruction.requestTemplateOpen);

  final RequestTemplateOpenInstructionData data;
}

/// A parsed FulfillTemplateOpen instruction.
final class ParsedFulfillTemplateOpen extends ParsedLootboxProgramInstruction {
  const ParsedFulfillTemplateOpen({required this.data})
    : super(LootboxProgramInstruction.fulfillTemplateOpen);

  final FulfillTemplateOpenInstructionData data;
}

/// A parsed AllocateTemplateOpen instruction.
final class ParsedAllocateTemplateOpen extends ParsedLootboxProgramInstruction {
  const ParsedAllocateTemplateOpen({required this.data})
    : super(LootboxProgramInstruction.allocateTemplateOpen);

  final AllocateTemplateOpenInstructionData data;
}

/// A parsed ClaimSolPrize instruction.
final class ParsedClaimSolPrize extends ParsedLootboxProgramInstruction {
  const ParsedClaimSolPrize({required this.data})
    : super(LootboxProgramInstruction.claimSolPrize);

  final ClaimSolPrizeInstructionData data;
}

/// A parsed ClaimTokenPrize instruction.
final class ParsedClaimTokenPrize extends ParsedLootboxProgramInstruction {
  const ParsedClaimTokenPrize({required this.data})
    : super(LootboxProgramInstruction.claimTokenPrize);

  final ClaimTokenPrizeInstructionData data;
}

/// A parsed RetireTemplate instruction.
final class ParsedRetireTemplate extends ParsedLootboxProgramInstruction {
  const ParsedRetireTemplate({required this.data})
    : super(LootboxProgramInstruction.retireTemplate);

  final RetireTemplateInstructionData data;
}

/// A parsed ReclaimSolPrize instruction.
final class ParsedReclaimSolPrize extends ParsedLootboxProgramInstruction {
  const ParsedReclaimSolPrize({required this.data})
    : super(LootboxProgramInstruction.reclaimSolPrize);

  final ReclaimSolPrizeInstructionData data;
}

/// A parsed ReclaimTokenPrize instruction.
final class ParsedReclaimTokenPrize extends ParsedLootboxProgramInstruction {
  const ParsedReclaimTokenPrize({required this.data})
    : super(LootboxProgramInstruction.reclaimTokenPrize);

  final ReclaimTokenPrizeInstructionData data;
}

/// A parsed CloseTemplateOpening instruction.
final class ParsedCloseTemplateOpening extends ParsedLootboxProgramInstruction {
  const ParsedCloseTemplateOpening({required this.data})
    : super(LootboxProgramInstruction.closeTemplateOpening);

  final CloseTemplateOpeningInstructionData data;
}

/// A parsed ActivateBundle instruction.
final class ParsedActivateBundle extends ParsedLootboxProgramInstruction {
  const ParsedActivateBundle({required this.data})
    : super(LootboxProgramInstruction.activateBundle);

  final ActivateBundleInstructionData data;
}

/// A parsed CancelBundle instruction.
final class ParsedCancelBundle extends ParsedLootboxProgramInstruction {
  const ParsedCancelBundle({required this.data})
    : super(LootboxProgramInstruction.cancelBundle);

  final CancelBundleInstructionData data;
}

/// A parsed FundMetadataNftPrize instruction.
final class ParsedFundMetadataNftPrize extends ParsedLootboxProgramInstruction {
  const ParsedFundMetadataNftPrize({required this.data})
    : super(LootboxProgramInstruction.fundMetadataNftPrize);

  final FundMetadataNftPrizeInstructionData data;
}

/// A parsed ClaimMetadataNftPrize instruction.
final class ParsedClaimMetadataNftPrize
    extends ParsedLootboxProgramInstruction {
  const ParsedClaimMetadataNftPrize({required this.data})
    : super(LootboxProgramInstruction.claimMetadataNftPrize);

  final ClaimMetadataNftPrizeInstructionData data;
}

/// A parsed ReclaimMetadataNftPrize instruction.
final class ParsedReclaimMetadataNftPrize
    extends ParsedLootboxProgramInstruction {
  const ParsedReclaimMetadataNftPrize({required this.data})
    : super(LootboxProgramInstruction.reclaimMetadataNftPrize);

  final ReclaimMetadataNftPrizeInstructionData data;
}

/// A parsed FundCoreAssetPrize instruction.
final class ParsedFundCoreAssetPrize extends ParsedLootboxProgramInstruction {
  const ParsedFundCoreAssetPrize({required this.data})
    : super(LootboxProgramInstruction.fundCoreAssetPrize);

  final FundCoreAssetPrizeInstructionData data;
}

/// A parsed ClaimCoreAssetPrize instruction.
final class ParsedClaimCoreAssetPrize extends ParsedLootboxProgramInstruction {
  const ParsedClaimCoreAssetPrize({required this.data})
    : super(LootboxProgramInstruction.claimCoreAssetPrize);

  final ClaimCoreAssetPrizeInstructionData data;
}

/// A parsed ReclaimCoreAssetPrize instruction.
final class ParsedReclaimCoreAssetPrize
    extends ParsedLootboxProgramInstruction {
  const ParsedReclaimCoreAssetPrize({required this.data})
    : super(LootboxProgramInstruction.reclaimCoreAssetPrize);

  final ReclaimCoreAssetPrizeInstructionData data;
}

/// A parsed FundCompressedNftPrize instruction.
final class ParsedFundCompressedNftPrize
    extends ParsedLootboxProgramInstruction {
  const ParsedFundCompressedNftPrize({required this.data})
    : super(LootboxProgramInstruction.fundCompressedNftPrize);

  final FundCompressedNftPrizeInstructionData data;
}

/// A parsed ClaimCompressedNftPrize instruction.
final class ParsedClaimCompressedNftPrize
    extends ParsedLootboxProgramInstruction {
  const ParsedClaimCompressedNftPrize({required this.data})
    : super(LootboxProgramInstruction.claimCompressedNftPrize);

  final ClaimCompressedNftPrizeInstructionData data;
}

/// A parsed ReclaimCompressedNftPrize instruction.
final class ParsedReclaimCompressedNftPrize
    extends ParsedLootboxProgramInstruction {
  const ParsedReclaimCompressedNftPrize({required this.data})
    : super(LootboxProgramInstruction.reclaimCompressedNftPrize);

  final ReclaimCompressedNftPrizeInstructionData data;
}

/// A parsed ForfeitTemplateOpen instruction.
final class ParsedForfeitTemplateOpen extends ParsedLootboxProgramInstruction {
  const ParsedForfeitTemplateOpen({required this.data})
    : super(LootboxProgramInstruction.forfeitTemplateOpen);

  final ForfeitTemplateOpenInstructionData data;
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
    LootboxProgramInstruction.createTemplate => ParsedCreateTemplate(
      data: parseCreateTemplateInstruction(instruction),
    ),
    LootboxProgramInstruction.addBundle => ParsedAddBundle(
      data: parseAddBundleInstruction(instruction),
    ),
    LootboxProgramInstruction.fundSolPrize => ParsedFundSolPrize(
      data: parseFundSolPrizeInstruction(instruction),
    ),
    LootboxProgramInstruction.fundTokenPrize => ParsedFundTokenPrize(
      data: parseFundTokenPrizeInstruction(instruction),
    ),
    LootboxProgramInstruction.sealTemplate => ParsedSealTemplate(
      data: parseSealTemplateInstruction(instruction),
    ),
    LootboxProgramInstruction.mintTemplateBoxes => ParsedMintTemplateBoxes(
      data: parseMintTemplateBoxesInstruction(instruction),
    ),
    LootboxProgramInstruction.requestTemplateOpen => ParsedRequestTemplateOpen(
      data: parseRequestTemplateOpenInstruction(instruction),
    ),
    LootboxProgramInstruction.fulfillTemplateOpen => ParsedFulfillTemplateOpen(
      data: parseFulfillTemplateOpenInstruction(instruction),
    ),
    LootboxProgramInstruction.allocateTemplateOpen =>
      ParsedAllocateTemplateOpen(
        data: parseAllocateTemplateOpenInstruction(instruction),
      ),
    LootboxProgramInstruction.claimSolPrize => ParsedClaimSolPrize(
      data: parseClaimSolPrizeInstruction(instruction),
    ),
    LootboxProgramInstruction.claimTokenPrize => ParsedClaimTokenPrize(
      data: parseClaimTokenPrizeInstruction(instruction),
    ),
    LootboxProgramInstruction.retireTemplate => ParsedRetireTemplate(
      data: parseRetireTemplateInstruction(instruction),
    ),
    LootboxProgramInstruction.reclaimSolPrize => ParsedReclaimSolPrize(
      data: parseReclaimSolPrizeInstruction(instruction),
    ),
    LootboxProgramInstruction.reclaimTokenPrize => ParsedReclaimTokenPrize(
      data: parseReclaimTokenPrizeInstruction(instruction),
    ),
    LootboxProgramInstruction.closeTemplateOpening =>
      ParsedCloseTemplateOpening(
        data: parseCloseTemplateOpeningInstruction(instruction),
      ),
    LootboxProgramInstruction.activateBundle => ParsedActivateBundle(
      data: parseActivateBundleInstruction(instruction),
    ),
    LootboxProgramInstruction.cancelBundle => ParsedCancelBundle(
      data: parseCancelBundleInstruction(instruction),
    ),
    LootboxProgramInstruction.fundMetadataNftPrize =>
      ParsedFundMetadataNftPrize(
        data: parseFundMetadataNftPrizeInstruction(instruction),
      ),
    LootboxProgramInstruction.claimMetadataNftPrize =>
      ParsedClaimMetadataNftPrize(
        data: parseClaimMetadataNftPrizeInstruction(instruction),
      ),
    LootboxProgramInstruction.reclaimMetadataNftPrize =>
      ParsedReclaimMetadataNftPrize(
        data: parseReclaimMetadataNftPrizeInstruction(instruction),
      ),
    LootboxProgramInstruction.fundCoreAssetPrize => ParsedFundCoreAssetPrize(
      data: parseFundCoreAssetPrizeInstruction(instruction),
    ),
    LootboxProgramInstruction.claimCoreAssetPrize => ParsedClaimCoreAssetPrize(
      data: parseClaimCoreAssetPrizeInstruction(instruction),
    ),
    LootboxProgramInstruction.reclaimCoreAssetPrize =>
      ParsedReclaimCoreAssetPrize(
        data: parseReclaimCoreAssetPrizeInstruction(instruction),
      ),
    LootboxProgramInstruction.fundCompressedNftPrize =>
      ParsedFundCompressedNftPrize(
        data: parseFundCompressedNftPrizeInstruction(instruction),
      ),
    LootboxProgramInstruction.claimCompressedNftPrize =>
      ParsedClaimCompressedNftPrize(
        data: parseClaimCompressedNftPrizeInstruction(instruction),
      ),
    LootboxProgramInstruction.reclaimCompressedNftPrize =>
      ParsedReclaimCompressedNftPrize(
        data: parseReclaimCompressedNftPrizeInstruction(instruction),
      ),
    LootboxProgramInstruction.forfeitTemplateOpen => ParsedForfeitTemplateOpen(
      data: parseForfeitTemplateOpenInstruction(instruction),
    ),
  };
}
