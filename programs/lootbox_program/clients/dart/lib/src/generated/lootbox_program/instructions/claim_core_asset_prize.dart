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
class ClaimCoreAssetPrizeInstructionData {
  const ClaimCoreAssetPrizeInstructionData({required this.assetIndex})
    : discriminator = 31;

  final int discriminator;
  final int assetIndex;
}

Encoder<ClaimCoreAssetPrizeInstructionData>
getClaimCoreAssetPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ClaimCoreAssetPrizeInstructionData value) => <String, Object?>{
      'discriminator': 31,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ClaimCoreAssetPrizeInstructionData>
getClaimCoreAssetPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'claimCoreAssetPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ClaimCoreAssetPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(31)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ClaimCoreAssetPrizeInstructionData(assetIndex: map['assetIndex']! as int),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ClaimCoreAssetPrizeInstructionData>(
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
      VariableSizeDecoder<ClaimCoreAssetPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ClaimCoreAssetPrizeInstructionData, ClaimCoreAssetPrizeInstructionData>
getClaimCoreAssetPrizeInstructionDataCodec() {
  return combineCodec(
    getClaimCoreAssetPrizeInstructionDataEncoder(),
    getClaimCoreAssetPrizeInstructionDataDecoder(),
  );
}

/// Creates a [ClaimCoreAssetPrize] instruction.
Instruction getClaimCoreAssetPrizeInstruction({
  required Address programAddress,
  required Address payer,
  required Address template,
  required Address opening,
  required Address bundle,
  required Address recipient,
  required Address asset,
  required Address collection,
  required Address coreProgram,
  required Address systemProgram,
  required Address logWrapper,
  required Address pluginAccounts,
  required int assetIndex,
}) {
  final instructionData = ClaimCoreAssetPrizeInstructionData(
    assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: payer, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: recipient, role: AccountRole.readonly),
      AccountMeta(address: asset, role: AccountRole.writable),
      AccountMeta(address: collection, role: AccountRole.readonly),
      AccountMeta(address: coreProgram, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: logWrapper, role: AccountRole.readonly),
      AccountMeta(address: pluginAccounts, role: AccountRole.readonly),
    ],
    data: getClaimCoreAssetPrizeInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [ClaimCoreAssetPrize] instruction from raw instruction data.
ClaimCoreAssetPrizeInstructionData parseClaimCoreAssetPrizeInstruction(
  Instruction instruction,
) {
  return getClaimCoreAssetPrizeInstructionDataDecoder().decode(
    instruction.data!,
  );
}
