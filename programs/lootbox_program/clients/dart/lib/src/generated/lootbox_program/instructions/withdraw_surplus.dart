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
class WithdrawSurplusInstructionData {
  const WithdrawSurplusInstructionData({
    required this.lamports,
  }) :
      discriminator = 9;

  final int discriminator;
  final BigInt lamports;
}

Encoder<WithdrawSurplusInstructionData> getWithdrawSurplusInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('lamports', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (WithdrawSurplusInstructionData value) => <String, Object?>{
      'discriminator': 9,
      'lamports': value.lamports,
    },
  );
}

Decoder<WithdrawSurplusInstructionData> getWithdrawSurplusInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('lamports', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'withdrawSurplus instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (WithdrawSurplusInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(9),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      WithdrawSurplusInstructionData(
      lamports: map['lamports']! as BigInt,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<WithdrawSurplusInstructionData>(
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
      VariableSizeDecoder<WithdrawSurplusInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<WithdrawSurplusInstructionData, WithdrawSurplusInstructionData> getWithdrawSurplusInstructionDataCodec() {
  return combineCodec(getWithdrawSurplusInstructionDataEncoder(), getWithdrawSurplusInstructionDataDecoder());
}

/// Creates a [WithdrawSurplus] instruction.
Instruction getWithdrawSurplusInstruction({
  required Address programAddress,
  required Address authority,
  required Address lootbox,
  required Address vault,
  required Address boxMint,
  required BigInt lamports,
}) {
  final instructionData = WithdrawSurplusInstructionData(
      lamports: lamports,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.writableSigner),
    AccountMeta(address: lootbox, role: AccountRole.readonly),
    AccountMeta(address: vault, role: AccountRole.writable),
    AccountMeta(address: boxMint, role: AccountRole.readonly),
    ],
    data: getWithdrawSurplusInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [WithdrawSurplus] instruction from raw instruction data.
WithdrawSurplusInstructionData parseWithdrawSurplusInstruction(Instruction instruction) {
  return getWithdrawSurplusInstructionDataDecoder().decode(instruction.data!);
}
