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
class FundCoreAssetPrizeInstructionData {
  const FundCoreAssetPrizeInstructionData() : discriminator = 30;

  final int discriminator;
}

Encoder<FundCoreAssetPrizeInstructionData>
getFundCoreAssetPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (FundCoreAssetPrizeInstructionData value) => <String, Object?>{
      'discriminator': 30,
    },
  );
}

Decoder<FundCoreAssetPrizeInstructionData>
getFundCoreAssetPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'fundCoreAssetPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (FundCoreAssetPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(30)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (FundCoreAssetPrizeInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<FundCoreAssetPrizeInstructionData>(
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
      VariableSizeDecoder<FundCoreAssetPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FundCoreAssetPrizeInstructionData, FundCoreAssetPrizeInstructionData>
getFundCoreAssetPrizeInstructionDataCodec() {
  return combineCodec(
    getFundCoreAssetPrizeInstructionDataEncoder(),
    getFundCoreAssetPrizeInstructionDataDecoder(),
  );
}

/// Creates a [FundCoreAssetPrize] instruction.
Instruction getFundCoreAssetPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address asset,
  required Address collection,
  required Address coreProgram,
  required Address systemProgram,
  required Address logWrapper,
  required Address pluginAccounts,
}) {
  final instructionData = FundCoreAssetPrizeInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: asset, role: AccountRole.writable),
      AccountMeta(address: collection, role: AccountRole.readonly),
      AccountMeta(address: coreProgram, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: logWrapper, role: AccountRole.readonly),
      AccountMeta(address: pluginAccounts, role: AccountRole.readonly),
    ],
    data: getFundCoreAssetPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [FundCoreAssetPrize] instruction from raw instruction data.
FundCoreAssetPrizeInstructionData parseFundCoreAssetPrizeInstruction(
  Instruction instruction,
) {
  return getFundCoreAssetPrizeInstructionDataDecoder().decode(
    instruction.data!,
  );
}
