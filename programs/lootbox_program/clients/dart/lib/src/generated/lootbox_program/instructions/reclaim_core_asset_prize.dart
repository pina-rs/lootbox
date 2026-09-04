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
class ReclaimCoreAssetPrizeInstructionData {
  const ReclaimCoreAssetPrizeInstructionData({required this.assetIndex})
    : discriminator = 32;

  final int discriminator;
  final int assetIndex;
}

Encoder<ReclaimCoreAssetPrizeInstructionData>
getReclaimCoreAssetPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ReclaimCoreAssetPrizeInstructionData value) => <String, Object?>{
      'discriminator': 32,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ReclaimCoreAssetPrizeInstructionData>
getReclaimCoreAssetPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'reclaimCoreAssetPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ReclaimCoreAssetPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(32)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ReclaimCoreAssetPrizeInstructionData(
        assetIndex: map['assetIndex']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ReclaimCoreAssetPrizeInstructionData>(
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
      VariableSizeDecoder<ReclaimCoreAssetPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<
  ReclaimCoreAssetPrizeInstructionData,
  ReclaimCoreAssetPrizeInstructionData
>
getReclaimCoreAssetPrizeInstructionDataCodec() {
  return combineCodec(
    getReclaimCoreAssetPrizeInstructionDataEncoder(),
    getReclaimCoreAssetPrizeInstructionDataDecoder(),
  );
}

/// Creates a [ReclaimCoreAssetPrize] instruction.
Instruction getReclaimCoreAssetPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
  required Address asset,
  required Address collection,
  required Address coreProgram,
  required Address systemProgram,
  required Address logWrapper,
  required Address pluginAccounts,
  required int assetIndex,
}) {
  final instructionData = ReclaimCoreAssetPrizeInstructionData(
    assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: asset, role: AccountRole.writable),
      AccountMeta(address: collection, role: AccountRole.readonly),
      AccountMeta(address: coreProgram, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: logWrapper, role: AccountRole.readonly),
      AccountMeta(address: pluginAccounts, role: AccountRole.readonly),
    ],
    data: getReclaimCoreAssetPrizeInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [ReclaimCoreAssetPrize] instruction from raw instruction data.
ReclaimCoreAssetPrizeInstructionData parseReclaimCoreAssetPrizeInstruction(
  Instruction instruction,
) {
  return getReclaimCoreAssetPrizeInstructionDataDecoder().decode(
    instruction.data!,
  );
}
