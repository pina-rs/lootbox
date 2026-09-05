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
class AddOutcomeInstructionData {
  const AddOutcomeInstructionData({
    required this.weight,
    required this.rewardLamports,
  }) :
      discriminator = 1;

  final int discriminator;
  final BigInt weight;
  final BigInt rewardLamports;
}

Encoder<AddOutcomeInstructionData> getAddOutcomeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('weight', getU64Encoder()),
    ('rewardLamports', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (AddOutcomeInstructionData value) => <String, Object?>{
      'discriminator': 1,
      'weight': value.weight,
      'rewardLamports': value.rewardLamports,
    },
  );
}

Decoder<AddOutcomeInstructionData> getAddOutcomeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('weight', getU64Decoder()),
    ('rewardLamports', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'addOutcome instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (AddOutcomeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(1),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      AddOutcomeInstructionData(
      weight: map['weight']! as BigInt,
      rewardLamports: map['rewardLamports']! as BigInt,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<AddOutcomeInstructionData>(
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
      VariableSizeDecoder<AddOutcomeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<AddOutcomeInstructionData, AddOutcomeInstructionData> getAddOutcomeInstructionDataCodec() {
  return combineCodec(getAddOutcomeInstructionDataEncoder(), getAddOutcomeInstructionDataDecoder());
}

/// Creates a [AddOutcome] instruction.
Instruction getAddOutcomeInstruction({
  required Address programAddress,
  required Address authority,
  required Address lootbox,
  required BigInt weight,
  required BigInt rewardLamports,
}) {
  final instructionData = AddOutcomeInstructionData(
      weight: weight,
      rewardLamports: rewardLamports,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.readonlySigner),
    AccountMeta(address: lootbox, role: AccountRole.writable),
    ],
    data: getAddOutcomeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [AddOutcome] instruction from raw instruction data.
AddOutcomeInstructionData parseAddOutcomeInstruction(Instruction instruction) {
  return getAddOutcomeInstructionDataDecoder().decode(instruction.data!);
}
