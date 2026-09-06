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
class FundQuoteTokenPrizeInstructionData {
  const FundQuoteTokenPrizeInstructionData({required this.amountPerWin})
    : discriminator = 39;

  final int discriminator;
  final BigInt amountPerWin;
}

Encoder<FundQuoteTokenPrizeInstructionData>
getFundQuoteTokenPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('amountPerWin', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (FundQuoteTokenPrizeInstructionData value) => <String, Object?>{
      'discriminator': 39,
      'amountPerWin': value.amountPerWin,
    },
  );
}

Decoder<FundQuoteTokenPrizeInstructionData>
getFundQuoteTokenPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('amountPerWin', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'fundQuoteTokenPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (FundQuoteTokenPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(39)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      FundQuoteTokenPrizeInstructionData(
        amountPerWin: map['amountPerWin']! as BigInt,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<FundQuoteTokenPrizeInstructionData>(
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
      VariableSizeDecoder<FundQuoteTokenPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FundQuoteTokenPrizeInstructionData, FundQuoteTokenPrizeInstructionData>
getFundQuoteTokenPrizeInstructionDataCodec() {
  return combineCodec(
    getFundQuoteTokenPrizeInstructionDataEncoder(),
    getFundQuoteTokenPrizeInstructionDataDecoder(),
  );
}

/// Creates a [FundQuoteTokenPrize] instruction.
Instruction getFundQuoteTokenPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address mint,
  required Address source,
  required Address escrow,
  required Address tokenProgram,
  required BigInt amountPerWin,
}) {
  final instructionData = FundQuoteTokenPrizeInstructionData(
    amountPerWin: amountPerWin,
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
    data: getFundQuoteTokenPrizeInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [FundQuoteTokenPrize] instruction from raw instruction data.
FundQuoteTokenPrizeInstructionData parseFundQuoteTokenPrizeInstruction(
  Instruction instruction,
) {
  return getFundQuoteTokenPrizeInstructionDataDecoder().decode(
    instruction.data!,
  );
}
