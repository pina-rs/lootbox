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
class DepositInstructionData {
  const DepositInstructionData({
    required this.lamports,
  }) :
      discriminator = 2;

  final int discriminator;
  final BigInt lamports;
}

Encoder<DepositInstructionData> getDepositInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('lamports', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (DepositInstructionData value) => <String, Object?>{
      'discriminator': 2,
      'lamports': value.lamports,
    },
  );
}

Decoder<DepositInstructionData> getDepositInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('lamports', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'deposit instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (DepositInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(2),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      DepositInstructionData(
      lamports: map['lamports']! as BigInt,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<DepositInstructionData>(
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
      VariableSizeDecoder<DepositInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<DepositInstructionData, DepositInstructionData> getDepositInstructionDataCodec() {
  return combineCodec(getDepositInstructionDataEncoder(), getDepositInstructionDataDecoder());
}

/// Creates a [Deposit] instruction.
Instruction getDepositInstruction({
  required Address programAddress,
  required Address depositor,
  required Address lootbox,
  required Address vault,
  required Address systemProgram,
  required BigInt lamports,
}) {
  final instructionData = DepositInstructionData(
      lamports: lamports,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: depositor, role: AccountRole.writableSigner),
    AccountMeta(address: lootbox, role: AccountRole.readonly),
    AccountMeta(address: vault, role: AccountRole.writable),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getDepositInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [Deposit] instruction from raw instruction data.
DepositInstructionData parseDepositInstruction(Instruction instruction) {
  return getDepositInstructionDataDecoder().decode(instruction.data!);
}
