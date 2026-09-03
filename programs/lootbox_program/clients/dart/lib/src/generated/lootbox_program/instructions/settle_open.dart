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
class SettleOpenInstructionData {
  const SettleOpenInstructionData() : discriminator = 6;

  final int discriminator;
}

Encoder<SettleOpenInstructionData> getSettleOpenInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (SettleOpenInstructionData value) => <String, Object?>{'discriminator': 6},
  );
}

Decoder<SettleOpenInstructionData> getSettleOpenInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'settleOpen instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (SettleOpenInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(6)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (SettleOpenInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<SettleOpenInstructionData>(
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
      VariableSizeDecoder<SettleOpenInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<SettleOpenInstructionData, SettleOpenInstructionData>
getSettleOpenInstructionDataCodec() {
  return combineCodec(
    getSettleOpenInstructionDataEncoder(),
    getSettleOpenInstructionDataDecoder(),
  );
}

/// Creates a [SettleOpen] instruction.
Instruction getSettleOpenInstruction({
  required Address programAddress,
  required Address recipient,
  required Address lootbox,
  required Address vault,
  required Address boxMint,
  required Address opening,
  required Address randomness,
}) {
  final instructionData = SettleOpenInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: recipient, role: AccountRole.writable),
      AccountMeta(address: lootbox, role: AccountRole.writable),
      AccountMeta(address: vault, role: AccountRole.writable),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: randomness, role: AccountRole.readonly),
    ],
    data: getSettleOpenInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [SettleOpen] instruction from raw instruction data.
SettleOpenInstructionData parseSettleOpenInstruction(Instruction instruction) {
  return getSettleOpenInstructionDataDecoder().decode(instruction.data!);
}
