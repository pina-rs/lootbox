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
class FundTokenPrizeInstructionData {
  const FundTokenPrizeInstructionData({
    required this.amountPerWin,
    required this.isNft,
  }) : discriminator = 13;

  final int discriminator;
  final BigInt amountPerWin;
  final bool isNft;
}

Encoder<FundTokenPrizeInstructionData>
getFundTokenPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('amountPerWin', getU64Encoder()),
    ('isNft', getBooleanEncoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (FundTokenPrizeInstructionData value) => <String, Object?>{
      'discriminator': 13,
      'amountPerWin': value.amountPerWin,
      'isNft': value.isNft,
    },
  );
}

Decoder<FundTokenPrizeInstructionData>
getFundTokenPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('amountPerWin', getU64Decoder()),
    ('isNft', getBooleanDecoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'fundTokenPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (FundTokenPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(13)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      FundTokenPrizeInstructionData(
        amountPerWin: map['amountPerWin']! as BigInt,
        isNft: map['isNft']! as bool,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<FundTokenPrizeInstructionData>(
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
      VariableSizeDecoder<FundTokenPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FundTokenPrizeInstructionData, FundTokenPrizeInstructionData>
getFundTokenPrizeInstructionDataCodec() {
  return combineCodec(
    getFundTokenPrizeInstructionDataEncoder(),
    getFundTokenPrizeInstructionDataDecoder(),
  );
}

/// Creates a [FundTokenPrize] instruction.
Instruction getFundTokenPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address mint,
  required Address source,
  required Address escrow,
  required Address tokenProgram,
  required BigInt amountPerWin,
  required bool isNft,
}) {
  final instructionData = FundTokenPrizeInstructionData(
    amountPerWin: amountPerWin,
    isNft: isNft,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.readonly),
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: mint, role: AccountRole.readonly),
      AccountMeta(address: source, role: AccountRole.writable),
      AccountMeta(address: escrow, role: AccountRole.writable),
      AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getFundTokenPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [FundTokenPrize] instruction from raw instruction data.
FundTokenPrizeInstructionData parseFundTokenPrizeInstruction(
  Instruction instruction,
) {
  return getFundTokenPrizeInstructionDataDecoder().decode(instruction.data!);
}
