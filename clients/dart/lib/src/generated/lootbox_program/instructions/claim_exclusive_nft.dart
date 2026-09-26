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
class ClaimExclusiveNftInstructionData {
  const ClaimExclusiveNftInstructionData({required this.assetIndex})
    : discriminator = 58,
      migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int assetIndex;
}

Encoder<ClaimExclusiveNftInstructionData>
getClaimExclusiveNftInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ClaimExclusiveNftInstructionData value) => <String, Object?>{
      'discriminator': 58,
      'migrationVersion': 0,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ClaimExclusiveNftInstructionData>
getClaimExclusiveNftInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'claimExclusiveNft instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ClaimExclusiveNftInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(58)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ClaimExclusiveNftInstructionData(assetIndex: map['assetIndex']! as int),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ClaimExclusiveNftInstructionData>(
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
      VariableSizeDecoder<ClaimExclusiveNftInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ClaimExclusiveNftInstructionData, ClaimExclusiveNftInstructionData>
getClaimExclusiveNftInstructionDataCodec() {
  return combineCodec(
    getClaimExclusiveNftInstructionDataEncoder(),
    getClaimExclusiveNftInstructionDataDecoder(),
  );
}

/// Creates a [ClaimExclusiveNft] instruction.
Instruction getClaimExclusiveNftInstruction({
  required Address programAddress,
  required Address template,
  required Address opening,
  required Address bundle,
  required Address exclusiveAttachment,
  required Address feeVault,
  required Address exclusiveCollection,
  required Address recipient,
  required Address treeConfig,
  required Address merkleTree,
  required Address coreCollection,
  required Address coreCpiSigner,
  required Address bubblegumProgram,
  required Address coreProgram,
  required Address logWrapper,
  required Address compressionProgram,
  required Address systemProgram,
  required int assetIndex,
}) {
  final instructionData = ClaimExclusiveNftInstructionData(
    assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: exclusiveAttachment, role: AccountRole.writable),
      AccountMeta(address: feeVault, role: AccountRole.writable),
      AccountMeta(address: exclusiveCollection, role: AccountRole.writable),
      AccountMeta(address: recipient, role: AccountRole.readonly),
      AccountMeta(address: treeConfig, role: AccountRole.writable),
      AccountMeta(address: merkleTree, role: AccountRole.writable),
      AccountMeta(address: coreCollection, role: AccountRole.writable),
      AccountMeta(address: coreCpiSigner, role: AccountRole.readonly),
      AccountMeta(address: bubblegumProgram, role: AccountRole.readonly),
      AccountMeta(address: coreProgram, role: AccountRole.readonly),
      AccountMeta(address: logWrapper, role: AccountRole.readonly),
      AccountMeta(address: compressionProgram, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getClaimExclusiveNftInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ClaimExclusiveNft] instruction from raw instruction data.
ClaimExclusiveNftInstructionData parseClaimExclusiveNftInstruction(
  Instruction instruction,
) {
  return getClaimExclusiveNftInstructionDataDecoder().decode(instruction.data!);
}
