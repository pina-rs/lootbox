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
class AllocateTemplateOpenInstructionData {
  const AllocateTemplateOpenInstructionData() : discriminator = 18;

  final int discriminator;
}

Encoder<AllocateTemplateOpenInstructionData>
getAllocateTemplateOpenInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (AllocateTemplateOpenInstructionData value) => <String, Object?>{
      'discriminator': 18,
    },
  );
}

Decoder<AllocateTemplateOpenInstructionData>
getAllocateTemplateOpenInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'allocateTemplateOpen instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (AllocateTemplateOpenInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(18)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (AllocateTemplateOpenInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<AllocateTemplateOpenInstructionData>(
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
      VariableSizeDecoder<AllocateTemplateOpenInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<AllocateTemplateOpenInstructionData, AllocateTemplateOpenInstructionData>
getAllocateTemplateOpenInstructionDataCodec() {
  return combineCodec(
    getAllocateTemplateOpenInstructionDataEncoder(),
    getAllocateTemplateOpenInstructionDataDecoder(),
  );
}

/// Creates a [AllocateTemplateOpen] instruction.
Instruction getAllocateTemplateOpenInstruction({
  required Address programAddress,
  required Address template,
  required Address opening,
  required Address bundle,
}) {
  final instructionData = AllocateTemplateOpenInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.readonly),
    ],
    data: getAllocateTemplateOpenInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [AllocateTemplateOpen] instruction from raw instruction data.
AllocateTemplateOpenInstructionData parseAllocateTemplateOpenInstruction(
  Instruction instruction,
) {
  return getAllocateTemplateOpenInstructionDataDecoder().decode(
    instruction.data!,
  );
}
