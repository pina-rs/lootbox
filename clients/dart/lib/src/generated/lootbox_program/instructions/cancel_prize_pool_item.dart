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
class CancelPrizePoolItemInstructionData {
  const CancelPrizePoolItemInstructionData()
    : discriminator = 52,
      migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
}

Encoder<CancelPrizePoolItemInstructionData>
getCancelPrizePoolItemInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (CancelPrizePoolItemInstructionData value) => <String, Object?>{
      'discriminator': 52,
      'migrationVersion': 0,
    },
  );
}

Decoder<CancelPrizePoolItemInstructionData>
getCancelPrizePoolItemInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'cancelPrizePoolItem instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (CancelPrizePoolItemInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(52)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (CancelPrizePoolItemInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CancelPrizePoolItemInstructionData>(
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
      VariableSizeDecoder<CancelPrizePoolItemInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<CancelPrizePoolItemInstructionData, CancelPrizePoolItemInstructionData>
getCancelPrizePoolItemInstructionDataCodec() {
  return combineCodec(
    getCancelPrizePoolItemInstructionDataEncoder(),
    getCancelPrizePoolItemInstructionDataDecoder(),
  );
}

/// Creates a [CancelPrizePoolItem] instruction.
Instruction getCancelPrizePoolItemInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address prizePool,
  required Address prizePoolItem,
}) {
  final instructionData = CancelPrizePoolItemInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.readonly),
      AccountMeta(address: prizePool, role: AccountRole.writable),
      AccountMeta(address: prizePoolItem, role: AccountRole.writable),
    ],
    data: getCancelPrizePoolItemInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [CancelPrizePoolItem] instruction from raw instruction data.
CancelPrizePoolItemInstructionData parseCancelPrizePoolItemInstruction(
  Instruction instruction,
) {
  return getCancelPrizePoolItemInstructionDataDecoder().decode(
    instruction.data!,
  );
}
