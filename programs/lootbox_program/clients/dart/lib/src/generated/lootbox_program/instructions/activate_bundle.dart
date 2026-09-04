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
class ActivateBundleInstructionData {
  const ActivateBundleInstructionData() : discriminator = 25;

  final int discriminator;
}

Encoder<ActivateBundleInstructionData>
getActivateBundleInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ActivateBundleInstructionData value) => <String, Object?>{
      'discriminator': 25,
    },
  );
}

Decoder<ActivateBundleInstructionData>
getActivateBundleInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'activateBundle instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ActivateBundleInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(25)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (ActivateBundleInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ActivateBundleInstructionData>(
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
      VariableSizeDecoder<ActivateBundleInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ActivateBundleInstructionData, ActivateBundleInstructionData>
getActivateBundleInstructionDataCodec() {
  return combineCodec(
    getActivateBundleInstructionDataEncoder(),
    getActivateBundleInstructionDataDecoder(),
  );
}

/// Creates a [ActivateBundle] instruction.
Instruction getActivateBundleInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
}) {
  final instructionData = ActivateBundleInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.readonly),
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
    ],
    data: getActivateBundleInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ActivateBundle] instruction from raw instruction data.
ActivateBundleInstructionData parseActivateBundleInstruction(
  Instruction instruction,
) {
  return getActivateBundleInstructionDataDecoder().decode(instruction.data!);
}
