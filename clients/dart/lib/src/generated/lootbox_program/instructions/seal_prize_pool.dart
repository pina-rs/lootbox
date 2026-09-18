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
class SealPrizePoolInstructionData {
  const SealPrizePoolInstructionData()
    : discriminator = 46,
      migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
}

Encoder<SealPrizePoolInstructionData> getSealPrizePoolInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (SealPrizePoolInstructionData value) => <String, Object?>{
      'discriminator': 46,
      'migrationVersion': 0,
    },
  );
}

Decoder<SealPrizePoolInstructionData> getSealPrizePoolInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'sealPrizePool instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (SealPrizePoolInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(46)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (SealPrizePoolInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<SealPrizePoolInstructionData>(
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
      VariableSizeDecoder<SealPrizePoolInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<SealPrizePoolInstructionData, SealPrizePoolInstructionData>
getSealPrizePoolInstructionDataCodec() {
  return combineCodec(
    getSealPrizePoolInstructionDataEncoder(),
    getSealPrizePoolInstructionDataDecoder(),
  );
}

/// Creates a [SealPrizePool] instruction.
Instruction getSealPrizePoolInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address prizePool,
}) {
  final instructionData = SealPrizePoolInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.readonlySigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: prizePool, role: AccountRole.writable),
    ],
    data: getSealPrizePoolInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [SealPrizePool] instruction from raw instruction data.
SealPrizePoolInstructionData parseSealPrizePoolInstruction(
  Instruction instruction,
) {
  return getSealPrizePoolInstructionDataDecoder().decode(instruction.data!);
}
