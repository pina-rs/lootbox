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
class RequestOpenInstructionData {
  const RequestOpenInstructionData({required this.bump}) : discriminator = 5;

  final int discriminator;
  final int bump;
}

Encoder<RequestOpenInstructionData> getRequestOpenInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (RequestOpenInstructionData value) => <String, Object?>{
      'discriminator': 5,
      'bump': value.bump,
    },
  );
}

Decoder<RequestOpenInstructionData> getRequestOpenInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'requestOpen instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (RequestOpenInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(5)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (RequestOpenInstructionData(bump: map['bump']! as int), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<RequestOpenInstructionData>(
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
      VariableSizeDecoder<RequestOpenInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<RequestOpenInstructionData, RequestOpenInstructionData>
getRequestOpenInstructionDataCodec() {
  return combineCodec(
    getRequestOpenInstructionDataEncoder(),
    getRequestOpenInstructionDataDecoder(),
  );
}

/// Creates a [RequestOpen] instruction.
Instruction getRequestOpenInstruction({
  required Address programAddress,
  required Address owner,
  required Address lootbox,
  required Address vault,
  required Address boxMint,
  required Address ownerBoxAccount,
  required Address opening,
  required Address randomness,
  required Address clock,
  required Address systemProgram,
  required Address tokenProgram,
  required int bump,
}) {
  final instructionData = RequestOpenInstructionData(bump: bump);

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: owner, role: AccountRole.writableSigner),
      AccountMeta(address: lootbox, role: AccountRole.writable),
      AccountMeta(address: vault, role: AccountRole.readonly),
      AccountMeta(address: boxMint, role: AccountRole.writable),
      AccountMeta(address: ownerBoxAccount, role: AccountRole.writable),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: randomness, role: AccountRole.readonly),
      AccountMeta(address: clock, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getRequestOpenInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [RequestOpen] instruction from raw instruction data.
RequestOpenInstructionData parseRequestOpenInstruction(
  Instruction instruction,
) {
  return getRequestOpenInstructionDataDecoder().decode(instruction.data!);
}
