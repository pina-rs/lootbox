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
class ReclaimTokenPrizeInstructionData {
  const ReclaimTokenPrizeInstructionData({required this.assetIndex})
    : discriminator = 23;

  final int discriminator;
  final int assetIndex;
}

Encoder<ReclaimTokenPrizeInstructionData>
getReclaimTokenPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ReclaimTokenPrizeInstructionData value) => <String, Object?>{
      'discriminator': 23,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ReclaimTokenPrizeInstructionData>
getReclaimTokenPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'reclaimTokenPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ReclaimTokenPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(23)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ReclaimTokenPrizeInstructionData(assetIndex: map['assetIndex']! as int),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ReclaimTokenPrizeInstructionData>(
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
      VariableSizeDecoder<ReclaimTokenPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ReclaimTokenPrizeInstructionData, ReclaimTokenPrizeInstructionData>
getReclaimTokenPrizeInstructionDataCodec() {
  return combineCodec(
    getReclaimTokenPrizeInstructionDataEncoder(),
    getReclaimTokenPrizeInstructionDataDecoder(),
  );
}

/// Creates a [ReclaimTokenPrize] instruction.
Instruction getReclaimTokenPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
  required Address mint,
  required Address escrow,
  required Address destination,
  required Address tokenProgram,
  required int assetIndex,
}) {
  final instructionData = ReclaimTokenPrizeInstructionData(
    assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.readonly),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: mint, role: AccountRole.readonly),
      AccountMeta(address: escrow, role: AccountRole.writable),
      AccountMeta(address: destination, role: AccountRole.writable),
      AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getReclaimTokenPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ReclaimTokenPrize] instruction from raw instruction data.
ReclaimTokenPrizeInstructionData parseReclaimTokenPrizeInstruction(
  Instruction instruction,
) {
  return getReclaimTokenPrizeInstructionDataDecoder().decode(instruction.data!);
}
