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
class CloseOpeningInstructionData {
  const CloseOpeningInstructionData() : discriminator = 8;

  final int discriminator;
}

Encoder<CloseOpeningInstructionData> getCloseOpeningInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (CloseOpeningInstructionData value) => <String, Object?>{
      'discriminator': 8,
    },
  );
}

Decoder<CloseOpeningInstructionData> getCloseOpeningInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'closeOpening instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (CloseOpeningInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(8)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (CloseOpeningInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CloseOpeningInstructionData>(
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
      VariableSizeDecoder<CloseOpeningInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<CloseOpeningInstructionData, CloseOpeningInstructionData>
getCloseOpeningInstructionDataCodec() {
  return combineCodec(
    getCloseOpeningInstructionDataEncoder(),
    getCloseOpeningInstructionDataDecoder(),
  );
}

/// Creates a [CloseOpening] instruction.
Instruction getCloseOpeningInstruction({
  required Address programAddress,
  required Address recipient,
  required Address opening,
}) {
  final instructionData = CloseOpeningInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: recipient, role: AccountRole.writable),
      AccountMeta(address: opening, role: AccountRole.writable),
    ],
    data: getCloseOpeningInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [CloseOpening] instruction from raw instruction data.
CloseOpeningInstructionData parseCloseOpeningInstruction(
  Instruction instruction,
) {
  return getCloseOpeningInstructionDataDecoder().decode(instruction.data!);
}
