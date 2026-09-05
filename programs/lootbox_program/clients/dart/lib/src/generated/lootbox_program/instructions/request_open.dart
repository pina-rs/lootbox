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
  const RequestOpenInstructionData({
    required this.recentSlot,
    required this.bump,
  }) :
      discriminator = 5;

  final int discriminator;
  final BigInt recentSlot;
  final int bump;
}

Encoder<RequestOpenInstructionData> getRequestOpenInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('recentSlot', getU64Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (RequestOpenInstructionData value) => <String, Object?>{
      'discriminator': 5,
      'recentSlot': value.recentSlot,
      'bump': value.bump,
    },
  );
}

Decoder<RequestOpenInstructionData> getRequestOpenInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('recentSlot', getU64Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'requestOpen instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (RequestOpenInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(5),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      RequestOpenInstructionData(
      recentSlot: map['recentSlot']! as BigInt,
      bump: map['bump']! as int,
      ),
      newOffset,
    );
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

Codec<RequestOpenInstructionData, RequestOpenInstructionData> getRequestOpenInstructionDataCodec() {
  return combineCodec(getRequestOpenInstructionDataEncoder(), getRequestOpenInstructionDataDecoder());
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
  required Address rewardEscrow,
  required Address oracleQueue,
  required Address oracle,
  required Address recentSlotHashes,
  required Address oracleProgram,
  required Address oracleProgramState,
  required Address oracleLutSigner,
  required Address oracleLut,
  required Address associatedTokenProgram,
  required Address wrappedSolMint,
  required Address addressLookupTableProgram,
  required Address systemProgram,
  required Address tokenProgram,
  required BigInt recentSlot,
  required int bump,
}) {
  final instructionData = RequestOpenInstructionData(
      recentSlot: recentSlot,
      bump: bump,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: owner, role: AccountRole.writableSigner),
    AccountMeta(address: lootbox, role: AccountRole.writable),
    AccountMeta(address: vault, role: AccountRole.readonly),
    AccountMeta(address: boxMint, role: AccountRole.writable),
    AccountMeta(address: ownerBoxAccount, role: AccountRole.writable),
    AccountMeta(address: opening, role: AccountRole.writable),
    AccountMeta(address: randomness, role: AccountRole.writableSigner),
    AccountMeta(address: rewardEscrow, role: AccountRole.writable),
    AccountMeta(address: oracleQueue, role: AccountRole.writable),
    AccountMeta(address: oracle, role: AccountRole.writable),
    AccountMeta(address: recentSlotHashes, role: AccountRole.readonly),
    AccountMeta(address: oracleProgram, role: AccountRole.readonly),
    AccountMeta(address: oracleProgramState, role: AccountRole.readonly),
    AccountMeta(address: oracleLutSigner, role: AccountRole.readonly),
    AccountMeta(address: oracleLut, role: AccountRole.writable),
    AccountMeta(address: associatedTokenProgram, role: AccountRole.readonly),
    AccountMeta(address: wrappedSolMint, role: AccountRole.readonly),
    AccountMeta(address: addressLookupTableProgram, role: AccountRole.readonly),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getRequestOpenInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [RequestOpen] instruction from raw instruction data.
RequestOpenInstructionData parseRequestOpenInstruction(Instruction instruction) {
  return getRequestOpenInstructionDataDecoder().decode(instruction.data!);
}
