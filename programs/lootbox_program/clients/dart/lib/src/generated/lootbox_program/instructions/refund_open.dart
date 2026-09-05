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
class RefundOpenInstructionData {
  const RefundOpenInstructionData() :
      discriminator = 7;

  final int discriminator;
}

Encoder<RefundOpenInstructionData> getRefundOpenInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (RefundOpenInstructionData value) => <String, Object?>{
      'discriminator': 7,
    },
  );
}

Decoder<RefundOpenInstructionData> getRefundOpenInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'refundOpen instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (RefundOpenInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(7),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      RefundOpenInstructionData(

      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<RefundOpenInstructionData>(
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
      VariableSizeDecoder<RefundOpenInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<RefundOpenInstructionData, RefundOpenInstructionData> getRefundOpenInstructionDataCodec() {
  return combineCodec(getRefundOpenInstructionDataEncoder(), getRefundOpenInstructionDataDecoder());
}

/// Creates a [RefundOpen] instruction.
Instruction getRefundOpenInstruction({
  required Address programAddress,
  required Address recipient,
  required Address lootbox,
  required Address vault,
  required Address boxMint,
  required Address opening,
  required Address randomness,
  required Address clock,

}) {
  final instructionData = RefundOpenInstructionData(

  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: recipient, role: AccountRole.writableSigner),
    AccountMeta(address: lootbox, role: AccountRole.writable),
    AccountMeta(address: vault, role: AccountRole.writable),
    AccountMeta(address: boxMint, role: AccountRole.readonly),
    AccountMeta(address: opening, role: AccountRole.writable),
    AccountMeta(address: randomness, role: AccountRole.readonly),
    AccountMeta(address: clock, role: AccountRole.readonly),
    ],
    data: getRefundOpenInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [RefundOpen] instruction from raw instruction data.
RefundOpenInstructionData parseRefundOpenInstruction(Instruction instruction) {
  return getRefundOpenInstructionDataDecoder().decode(instruction.data!);
}
