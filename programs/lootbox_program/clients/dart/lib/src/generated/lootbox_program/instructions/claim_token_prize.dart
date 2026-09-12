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
class ClaimTokenPrizeInstructionData {
  const ClaimTokenPrizeInstructionData({required this.assetIndex})
    : discriminator = 20;

  final int discriminator;
  final int assetIndex;
}

Encoder<ClaimTokenPrizeInstructionData>
getClaimTokenPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ClaimTokenPrizeInstructionData value) => <String, Object?>{
      'discriminator': 20,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ClaimTokenPrizeInstructionData>
getClaimTokenPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'claimTokenPrize instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ClaimTokenPrizeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(20)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ClaimTokenPrizeInstructionData(assetIndex: map['assetIndex']! as int),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ClaimTokenPrizeInstructionData>(
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
      VariableSizeDecoder<ClaimTokenPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ClaimTokenPrizeInstructionData, ClaimTokenPrizeInstructionData>
getClaimTokenPrizeInstructionDataCodec() {
  return combineCodec(
    getClaimTokenPrizeInstructionDataEncoder(),
    getClaimTokenPrizeInstructionDataDecoder(),
  );
}

/// Creates a [ClaimTokenPrize] instruction.
Instruction getClaimTokenPrizeInstruction({
  required Address programAddress,
  required Address template,
  required Address opening,
  required Address bundle,
  required Address recipient,
  required Address mint,
  required Address escrow,
  required Address destination,
  required Address tokenProgram,
  required int assetIndex,
}) {
  final instructionData = ClaimTokenPrizeInstructionData(
    assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: recipient, role: AccountRole.readonly),
      AccountMeta(address: mint, role: AccountRole.readonly),
      AccountMeta(address: escrow, role: AccountRole.writable),
      AccountMeta(address: destination, role: AccountRole.writable),
      AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getClaimTokenPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ClaimTokenPrize] instruction from raw instruction data.
ClaimTokenPrizeInstructionData parseClaimTokenPrizeInstruction(
  Instruction instruction,
) {
  return getClaimTokenPrizeInstructionDataDecoder().decode(instruction.data!);
}
