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
class SealInstructionData {
  const SealInstructionData() :
      discriminator = 3;

  final int discriminator;
}

Encoder<SealInstructionData> getSealInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (SealInstructionData value) => <String, Object?>{
      'discriminator': 3,
    },
  );
}

Decoder<SealInstructionData> getSealInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'seal instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (SealInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(3),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      SealInstructionData(

      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<SealInstructionData>(
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
      VariableSizeDecoder<SealInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<SealInstructionData, SealInstructionData> getSealInstructionDataCodec() {
  return combineCodec(getSealInstructionDataEncoder(), getSealInstructionDataDecoder());
}

/// Creates a [Seal] instruction.
Instruction getSealInstruction({
  required Address programAddress,
  required Address authority,
  required Address lootbox,

}) {
  final instructionData = SealInstructionData(

  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.readonlySigner),
    AccountMeta(address: lootbox, role: AccountRole.writable),
    ],
    data: getSealInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [Seal] instruction from raw instruction data.
SealInstructionData parseSealInstruction(Instruction instruction) {
  return getSealInstructionDataDecoder().decode(instruction.data!);
}
