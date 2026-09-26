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
class AttachExclusiveNftInstructionData {
  const AttachExclusiveNftInstructionData({
    required this.assetIndex,
    required this.bump,
    required this.feeVaultBump,
  }) : discriminator = 57,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int assetIndex;
  final int bump;
  final int feeVaultBump;
}

Encoder<AttachExclusiveNftInstructionData>
getAttachExclusiveNftInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
    ('bump', getU8Encoder()),
    ('feeVaultBump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (AttachExclusiveNftInstructionData value) => <String, Object?>{
      'discriminator': 57,
      'migrationVersion': 0,
      'assetIndex': value.assetIndex,
      'bump': value.bump,
      'feeVaultBump': value.feeVaultBump,
    },
  );
}

Decoder<AttachExclusiveNftInstructionData>
getAttachExclusiveNftInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
    ('bump', getU8Decoder()),
    ('feeVaultBump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'attachExclusiveNft instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (AttachExclusiveNftInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(57)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      AttachExclusiveNftInstructionData(
        assetIndex: map['assetIndex']! as int,
        bump: map['bump']! as int,
        feeVaultBump: map['feeVaultBump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<AttachExclusiveNftInstructionData>(
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
      VariableSizeDecoder<AttachExclusiveNftInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<AttachExclusiveNftInstructionData, AttachExclusiveNftInstructionData>
getAttachExclusiveNftInstructionDataCodec() {
  return combineCodec(
    getAttachExclusiveNftInstructionDataEncoder(),
    getAttachExclusiveNftInstructionDataDecoder(),
  );
}

/// Creates a [AttachExclusiveNft] instruction.
Instruction getAttachExclusiveNftInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address exclusiveCollection,
  required Address exclusiveAttachment,
  required Address feeVault,
  required Address systemProgram,
  required int assetIndex,
  required int bump,
  required int feeVaultBump,
}) {
  final instructionData = AttachExclusiveNftInstructionData(
    assetIndex: assetIndex,
    bump: bump,
    feeVaultBump: feeVaultBump,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: exclusiveCollection, role: AccountRole.readonly),
      AccountMeta(address: exclusiveAttachment, role: AccountRole.writable),
      AccountMeta(address: feeVault, role: AccountRole.writable),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getAttachExclusiveNftInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [AttachExclusiveNft] instruction from raw instruction data.
AttachExclusiveNftInstructionData parseAttachExclusiveNftInstruction(
  Instruction instruction,
) {
  return getAttachExclusiveNftInstructionDataDecoder().decode(
    instruction.data!,
  );
}
