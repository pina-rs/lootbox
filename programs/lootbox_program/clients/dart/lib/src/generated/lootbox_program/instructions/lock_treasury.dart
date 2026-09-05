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
class LockTreasuryInstructionData {
  const LockTreasuryInstructionData({
    required this.serviceVaultBump,
  }) :
      discriminator = 37;

  final int discriminator;
  final int serviceVaultBump;
}

Encoder<LockTreasuryInstructionData> getLockTreasuryInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('serviceVaultBump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (LockTreasuryInstructionData value) => <String, Object?>{
      'discriminator': 37,
      'serviceVaultBump': value.serviceVaultBump,
    },
  );
}

Decoder<LockTreasuryInstructionData> getLockTreasuryInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('serviceVaultBump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'lockTreasury instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (LockTreasuryInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(37),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      LockTreasuryInstructionData(
      serviceVaultBump: map['serviceVaultBump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<LockTreasuryInstructionData>(
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
      VariableSizeDecoder<LockTreasuryInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<LockTreasuryInstructionData, LockTreasuryInstructionData> getLockTreasuryInstructionDataCodec() {
  return combineCodec(getLockTreasuryInstructionDataEncoder(), getLockTreasuryInstructionDataDecoder());
}

/// Creates a [LockTreasury] instruction.
Instruction getLockTreasuryInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
  required Address serviceVault,
  required Address systemProgram,
  required Address boxTokenProgram,
  required int serviceVaultBump,
}) {
  final instructionData = LockTreasuryInstructionData(
      serviceVaultBump: serviceVaultBump,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.writable),
    AccountMeta(address: template, role: AccountRole.writable),
    AccountMeta(address: boxMint, role: AccountRole.writable),
    AccountMeta(address: bundle, role: AccountRole.readonly),
    AccountMeta(address: serviceVault, role: AccountRole.writable),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    AccountMeta(address: boxTokenProgram, role: AccountRole.readonly),
    ],
    data: getLockTreasuryInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [LockTreasury] instruction from raw instruction data.
LockTreasuryInstructionData parseLockTreasuryInstruction(Instruction instruction) {
  return getLockTreasuryInstructionDataDecoder().decode(instruction.data!);
}
