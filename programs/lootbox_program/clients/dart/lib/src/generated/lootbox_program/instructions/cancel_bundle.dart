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
class CancelBundleInstructionData {
  const CancelBundleInstructionData() : discriminator = 26;

  final int discriminator;
}

Encoder<CancelBundleInstructionData> getCancelBundleInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (CancelBundleInstructionData value) => <String, Object?>{
      'discriminator': 26,
    },
  );
}

Decoder<CancelBundleInstructionData> getCancelBundleInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'cancelBundle instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (CancelBundleInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(26)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (CancelBundleInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CancelBundleInstructionData>(
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
      VariableSizeDecoder<CancelBundleInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<CancelBundleInstructionData, CancelBundleInstructionData>
getCancelBundleInstructionDataCodec() {
  return combineCodec(
    getCancelBundleInstructionDataEncoder(),
    getCancelBundleInstructionDataDecoder(),
  );
}

/// Creates a [CancelBundle] instruction.
Instruction getCancelBundleInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
}) {
  final instructionData = CancelBundleInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writable),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
    ],
    data: getCancelBundleInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [CancelBundle] instruction from raw instruction data.
CancelBundleInstructionData parseCancelBundleInstruction(
  Instruction instruction,
) {
  return getCancelBundleInstructionDataDecoder().decode(instruction.data!);
}
