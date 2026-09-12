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
class RetireTemplateInstructionData {
  const RetireTemplateInstructionData() : discriminator = 21;

  final int discriminator;
}

Encoder<RetireTemplateInstructionData>
getRetireTemplateInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (RetireTemplateInstructionData value) => <String, Object?>{
      'discriminator': 21,
    },
  );
}

Decoder<RetireTemplateInstructionData>
getRetireTemplateInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'retireTemplate instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (RetireTemplateInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(21)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (RetireTemplateInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<RetireTemplateInstructionData>(
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
      VariableSizeDecoder<RetireTemplateInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<RetireTemplateInstructionData, RetireTemplateInstructionData>
getRetireTemplateInstructionDataCodec() {
  return combineCodec(
    getRetireTemplateInstructionDataEncoder(),
    getRetireTemplateInstructionDataDecoder(),
  );
}

/// Creates a [RetireTemplate] instruction.
Instruction getRetireTemplateInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
}) {
  final instructionData = RetireTemplateInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.readonly),
      AccountMeta(address: template, role: AccountRole.writable),
    ],
    data: getRetireTemplateInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [RetireTemplate] instruction from raw instruction data.
RetireTemplateInstructionData parseRetireTemplateInstruction(
  Instruction instruction,
) {
  return getRetireTemplateInstructionDataDecoder().decode(instruction.data!);
}
