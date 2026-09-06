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
class FundMintPrizeInstructionData {
  const FundMintPrizeInstructionData() : discriminator = 40;

  final int discriminator;
}

Encoder<FundMintPrizeInstructionData> getFundMintPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (FundMintPrizeInstructionData value) => <String, Object?>{
      'discriminator': 40,
    },
  );
}

Decoder<FundMintPrizeInstructionData> getFundMintPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'fundMintPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (FundMintPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(40)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (FundMintPrizeInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<FundMintPrizeInstructionData>(
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
      VariableSizeDecoder<FundMintPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FundMintPrizeInstructionData, FundMintPrizeInstructionData>
getFundMintPrizeInstructionDataCodec() {
  return combineCodec(
    getFundMintPrizeInstructionDataEncoder(),
    getFundMintPrizeInstructionDataDecoder(),
  );
}

/// Creates a [FundMintPrize] instruction.
Instruction getFundMintPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address mint,
  required Address tokenProgram,
}) {
  final instructionData = FundMintPrizeInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.readonly),
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: mint, role: AccountRole.writable),
      AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getFundMintPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [FundMintPrize] instruction from raw instruction data.
FundMintPrizeInstructionData parseFundMintPrizeInstruction(
  Instruction instruction,
) {
  return getFundMintPrizeInstructionDataDecoder().decode(instruction.data!);
}
