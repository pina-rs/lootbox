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
class FundQuoteSolPrizeInstructionData {
  const FundQuoteSolPrizeInstructionData({
    required this.lamportsPerWin,
  }) :
      discriminator = 39;

  final int discriminator;
  final BigInt lamportsPerWin;
}

Encoder<FundQuoteSolPrizeInstructionData> getFundQuoteSolPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('lamportsPerWin', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (FundQuoteSolPrizeInstructionData value) => <String, Object?>{
      'discriminator': 39,
      'lamportsPerWin': value.lamportsPerWin,
    },
  );
}

Decoder<FundQuoteSolPrizeInstructionData> getFundQuoteSolPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('lamportsPerWin', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'fundQuoteSolPrize instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (FundQuoteSolPrizeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(39),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      FundQuoteSolPrizeInstructionData(
      lamportsPerWin: map['lamportsPerWin']! as BigInt,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<FundQuoteSolPrizeInstructionData>(
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
      VariableSizeDecoder<FundQuoteSolPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FundQuoteSolPrizeInstructionData, FundQuoteSolPrizeInstructionData> getFundQuoteSolPrizeInstructionDataCodec() {
  return combineCodec(getFundQuoteSolPrizeInstructionDataEncoder(), getFundQuoteSolPrizeInstructionDataDecoder());
}

/// Creates a [FundQuoteSolPrize] instruction.
Instruction getFundQuoteSolPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address systemProgram,
  required BigInt lamportsPerWin,
}) {
  final instructionData = FundQuoteSolPrizeInstructionData(
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
    data: getFundQuoteSolPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [FundQuoteSolPrize] instruction from raw instruction data.
FundQuoteSolPrizeInstructionData parseFundQuoteSolPrizeInstruction(Instruction instruction) {
  return getFundQuoteSolPrizeInstructionDataDecoder().decode(instruction.data!);
}
