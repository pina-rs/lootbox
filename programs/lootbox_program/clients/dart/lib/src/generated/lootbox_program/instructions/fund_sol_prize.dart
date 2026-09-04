// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'dart:typed_data';

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_core/solana_kit_codecs_core.dart';
import 'package:solana_kit_codecs_data_structures/solana_kit_codecs_data_structures.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';
import 'package:solana_kit_errors/solana_kit_errors.dart';
import 'package:solana_kit_instructions/solana_kit_instructions.dart';

@immutable
class FundSolPrizeInstructionData {
  const FundSolPrizeInstructionData({required this.lamportsPerWin})
    : discriminator = 12;

  final int discriminator;
  final BigInt lamportsPerWin;
}

Encoder<FundSolPrizeInstructionData> getFundSolPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('lamportsPerWin', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (FundSolPrizeInstructionData value) => <String, Object?>{
      'discriminator': 12,
      'lamportsPerWin': value.lamportsPerWin,
    },
  );
}

Decoder<FundSolPrizeInstructionData> getFundSolPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('lamportsPerWin', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'fundSolPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (FundSolPrizeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(12)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      FundSolPrizeInstructionData(
        lamportsPerWin: map['lamportsPerWin']! as BigInt,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<FundSolPrizeInstructionData>(
        fixedSize: structDecoder.fixedSize,
        read: (bytes, offset) {
          final bytesLength = bytes.length - offset;
          if (bytesLength != structDecoder.fixedSize) {
            throwInvalidByteLength(structDecoder.fixedSize, bytesLength);
          }
          return readTopLevel(bytes, offset);
        },
      ),
    VariableSizeDecoder<Map<String, Object?>>() =>
      VariableSizeDecoder<FundSolPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FundSolPrizeInstructionData, FundSolPrizeInstructionData>
getFundSolPrizeInstructionDataCodec() {
  return combineCodec(
    getFundSolPrizeInstructionDataEncoder(),
    getFundSolPrizeInstructionDataDecoder(),
  );
}

/// Creates a [FundSolPrize] instruction.
Instruction getFundSolPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address systemProgram,
  required BigInt lamportsPerWin,
}) {
  final instructionData = FundSolPrizeInstructionData(
    lamportsPerWin: lamportsPerWin,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writable),
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getFundSolPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [FundSolPrize] instruction from raw instruction data.
FundSolPrizeInstructionData parseFundSolPrizeInstruction(
  Instruction instruction,
) {
  return getFundSolPrizeInstructionDataDecoder().decode(instruction.data!);
}
