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
class ClaimSolPrizeInstructionData {
  const ClaimSolPrizeInstructionData({required this.assetIndex})
    : discriminator = 19;

  final int discriminator;
  final int assetIndex;
}

Encoder<ClaimSolPrizeInstructionData> getClaimSolPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ClaimSolPrizeInstructionData value) => <String, Object?>{
      'discriminator': 19,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ClaimSolPrizeInstructionData> getClaimSolPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'claimSolPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ClaimSolPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(19)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ClaimSolPrizeInstructionData(assetIndex: map['assetIndex']! as int),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ClaimSolPrizeInstructionData>(
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
      VariableSizeDecoder<ClaimSolPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ClaimSolPrizeInstructionData, ClaimSolPrizeInstructionData>
getClaimSolPrizeInstructionDataCodec() {
  return combineCodec(
    getClaimSolPrizeInstructionDataEncoder(),
    getClaimSolPrizeInstructionDataDecoder(),
  );
}

/// Creates a [ClaimSolPrize] instruction.
Instruction getClaimSolPrizeInstruction({
  required Address programAddress,
  required Address template,
  required Address opening,
  required Address bundle,
  required Address recipient,
  required int assetIndex,
}) {
  final instructionData = ClaimSolPrizeInstructionData(assetIndex: assetIndex);

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: recipient, role: AccountRole.writable),
    ],
    data: getClaimSolPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ClaimSolPrize] instruction from raw instruction data.
ClaimSolPrizeInstructionData parseClaimSolPrizeInstruction(
  Instruction instruction,
) {
  return getClaimSolPrizeInstructionDataDecoder().decode(instruction.data!);
}
