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
class AllocatePrizePoolOpenInstructionData {
  const AllocatePrizePoolOpenInstructionData({required this.resultReceiptBump})
    : discriminator = 47,
      migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int resultReceiptBump;
}

Encoder<AllocatePrizePoolOpenInstructionData>
getAllocatePrizePoolOpenInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('resultReceiptBump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (AllocatePrizePoolOpenInstructionData value) => <String, Object?>{
      'discriminator': 47,
      'migrationVersion': 0,
      'resultReceiptBump': value.resultReceiptBump,
    },
  );
}

Decoder<AllocatePrizePoolOpenInstructionData>
getAllocatePrizePoolOpenInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('resultReceiptBump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'allocatePrizePoolOpen instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (AllocatePrizePoolOpenInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(47)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      AllocatePrizePoolOpenInstructionData(
        resultReceiptBump: map['resultReceiptBump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<AllocatePrizePoolOpenInstructionData>(
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
      VariableSizeDecoder<AllocatePrizePoolOpenInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<
  AllocatePrizePoolOpenInstructionData,
  AllocatePrizePoolOpenInstructionData
>
getAllocatePrizePoolOpenInstructionDataCodec() {
  return combineCodec(
    getAllocatePrizePoolOpenInstructionDataEncoder(),
    getAllocatePrizePoolOpenInstructionDataDecoder(),
  );
}

/// Creates a [AllocatePrizePoolOpen] instruction.
Instruction getAllocatePrizePoolOpenInstruction({
  required Address programAddress,
  required Address template,
  required Address opening,
  required Address bundle,
  required Address prizePool,
  required Address serviceVault,
  required Address resultReceipt,
  required Address systemProgram,
  required int resultReceiptBump,
}) {
  final instructionData = AllocatePrizePoolOpenInstructionData(
    resultReceiptBump: resultReceiptBump,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.readonly),
      AccountMeta(address: prizePool, role: AccountRole.writable),
      AccountMeta(address: serviceVault, role: AccountRole.writable),
      AccountMeta(address: resultReceipt, role: AccountRole.writable),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getAllocatePrizePoolOpenInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [AllocatePrizePoolOpen] instruction from raw instruction data.
AllocatePrizePoolOpenInstructionData parseAllocatePrizePoolOpenInstruction(
  Instruction instruction,
) {
  return getAllocatePrizePoolOpenInstructionDataDecoder().decode(
    instruction.data!,
  );
}
