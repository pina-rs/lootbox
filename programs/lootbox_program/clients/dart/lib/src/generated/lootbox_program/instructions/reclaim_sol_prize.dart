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
class ReclaimSolPrizeInstructionData {
  const ReclaimSolPrizeInstructionData({required this.assetIndex})
    : discriminator = 22;

  final int discriminator;
  final int assetIndex;
}

Encoder<ReclaimSolPrizeInstructionData>
getReclaimSolPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ReclaimSolPrizeInstructionData value) => <String, Object?>{
      'discriminator': 22,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ReclaimSolPrizeInstructionData>
getReclaimSolPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'reclaimSolPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ReclaimSolPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(22)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ReclaimSolPrizeInstructionData(assetIndex: map['assetIndex']! as int),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ReclaimSolPrizeInstructionData>(
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
      VariableSizeDecoder<ReclaimSolPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ReclaimSolPrizeInstructionData, ReclaimSolPrizeInstructionData>
getReclaimSolPrizeInstructionDataCodec() {
  return combineCodec(
    getReclaimSolPrizeInstructionDataEncoder(),
    getReclaimSolPrizeInstructionDataDecoder(),
  );
}

/// Creates a [ReclaimSolPrize] instruction.
Instruction getReclaimSolPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
  required int assetIndex,
}) {
  final instructionData = ReclaimSolPrizeInstructionData(
    assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writable),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
    ],
    data: getReclaimSolPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ReclaimSolPrize] instruction from raw instruction data.
ReclaimSolPrizeInstructionData parseReclaimSolPrizeInstruction(
  Instruction instruction,
) {
  return getReclaimSolPrizeInstructionDataDecoder().decode(instruction.data!);
}
