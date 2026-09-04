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
class ForfeitTemplateOpenInstructionData {
  const ForfeitTemplateOpenInstructionData() : discriminator = 36;

  final int discriminator;
}

Encoder<ForfeitTemplateOpenInstructionData>
getForfeitTemplateOpenInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ForfeitTemplateOpenInstructionData value) => <String, Object?>{
      'discriminator': 36,
    },
  );
}

Decoder<ForfeitTemplateOpenInstructionData>
getForfeitTemplateOpenInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'forfeitTemplateOpen instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ForfeitTemplateOpenInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(36)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (ForfeitTemplateOpenInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ForfeitTemplateOpenInstructionData>(
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
      VariableSizeDecoder<ForfeitTemplateOpenInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ForfeitTemplateOpenInstructionData, ForfeitTemplateOpenInstructionData>
getForfeitTemplateOpenInstructionDataCodec() {
  return combineCodec(
    getForfeitTemplateOpenInstructionDataEncoder(),
    getForfeitTemplateOpenInstructionDataDecoder(),
  );
}

/// Creates a [ForfeitTemplateOpen] instruction.
Instruction getForfeitTemplateOpenInstruction({
  required Address programAddress,
  required Address caller,
  required Address template,
  required Address opening,
  required Address randomness,
}) {
  final instructionData = ForfeitTemplateOpenInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: caller, role: AccountRole.readonlySigner),
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: randomness, role: AccountRole.readonly),
    ],
    data: getForfeitTemplateOpenInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [ForfeitTemplateOpen] instruction from raw instruction data.
ForfeitTemplateOpenInstructionData parseForfeitTemplateOpenInstruction(
  Instruction instruction,
) {
  return getForfeitTemplateOpenInstructionDataDecoder().decode(
    instruction.data!,
  );
}
