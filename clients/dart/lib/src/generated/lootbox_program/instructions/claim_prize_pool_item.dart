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
class ClaimPrizePoolItemInstructionData {
  const ClaimPrizePoolItemInstructionData({
    required this.assetIndex,
    required this.root,
    required this.dataHash,
    required this.creatorHash,
    required this.nonce,
    required this.index,
    required this.metadata,
  }) : discriminator = 48,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int assetIndex;
  final Uint8List root;
  final Uint8List dataHash;
  final Uint8List creatorHash;
  final BigInt nonce;
  final int index;
  final List<int> metadata;
}

Encoder<ClaimPrizePoolItemInstructionData>
getClaimPrizePoolItemInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
    ('root', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('dataHash', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    (
      'creatorHash',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('nonce', getU64Encoder()),
    ('index', getU32Encoder()),
    (
      'metadata',
      fixEncoderSize(
        getArrayEncoder<int>(
          transformEncoder(getU8Encoder(), (int value) => value),
          size: PrefixedArraySize(getU16Encoder()),
        ),
        514,
        allowTruncation: false,
      ),
    ),
  ]);

  return transformEncoder(
    structEncoder,
    (ClaimPrizePoolItemInstructionData value) => <String, Object?>{
      'discriminator': 48,
      'migrationVersion': 0,
      'assetIndex': value.assetIndex,
      'root': value.root,
      'dataHash': value.dataHash,
      'creatorHash': value.creatorHash,
      'nonce': value.nonce,
      'index': value.index,
      'metadata': value.metadata,
    },
  );
}

Decoder<ClaimPrizePoolItemInstructionData>
getClaimPrizePoolItemInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
    ('root', fixDecoderSize(getBytesDecoder(), 32)),
    ('dataHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('creatorHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('nonce', getU64Decoder()),
    ('index', getU32Decoder()),
    (
      'metadata',
      fixDecoderSize(
        getArrayDecoder(
          getU8Decoder(),
          size: PrefixedArraySize(getU16Decoder()),
        ),
        514,
      ),
    ),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'claimPrizePoolItem instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ClaimPrizePoolItemInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(48)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ClaimPrizePoolItemInstructionData(
        assetIndex: map['assetIndex']! as int,
        root: map['root']! as Uint8List,
        dataHash: map['dataHash']! as Uint8List,
        creatorHash: map['creatorHash']! as Uint8List,
        nonce: map['nonce']! as BigInt,
        index: map['index']! as int,
        metadata: map['metadata']! as List<int>,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ClaimPrizePoolItemInstructionData>(
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
      VariableSizeDecoder<ClaimPrizePoolItemInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ClaimPrizePoolItemInstructionData, ClaimPrizePoolItemInstructionData>
getClaimPrizePoolItemInstructionDataCodec() {
  return combineCodec(
    getClaimPrizePoolItemInstructionDataEncoder(),
    getClaimPrizePoolItemInstructionDataDecoder(),
  );
}

/// Creates a [ClaimPrizePoolItem] instruction.
Instruction getClaimPrizePoolItemInstruction({
  required Address programAddress,
  required Address template,
  required Address opening,
  required Address bundle,
  required Address prizePool,
  required Address prizePoolItem,
  required Address recipient,
  required Address rentRefund,
  required Address treeConfig,
  required Address merkleTree,
  required Address bubblegumProgram,
  required Address logWrapper,
  required Address compressionProgram,
  required Address systemProgram,
  required Address proofAccounts,
  required int assetIndex,
  required Uint8List root,
  required Uint8List dataHash,
  required Uint8List creatorHash,
  required BigInt nonce,
  required int index,
  required List<int> metadata,
}) {
  final instructionData = ClaimPrizePoolItemInstructionData(
    assetIndex: assetIndex,
    root: root,
    dataHash: dataHash,
    creatorHash: creatorHash,
    nonce: nonce,
    index: index,
    metadata: metadata,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: prizePool, role: AccountRole.writable),
      AccountMeta(address: prizePoolItem, role: AccountRole.writable),
      AccountMeta(address: recipient, role: AccountRole.readonly),
      AccountMeta(address: rentRefund, role: AccountRole.writable),
      AccountMeta(address: treeConfig, role: AccountRole.readonly),
      AccountMeta(address: merkleTree, role: AccountRole.writable),
      AccountMeta(address: bubblegumProgram, role: AccountRole.readonly),
      AccountMeta(address: logWrapper, role: AccountRole.readonly),
      AccountMeta(address: compressionProgram, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: proofAccounts, role: AccountRole.readonly),
    ],
    data: getClaimPrizePoolItemInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ClaimPrizePoolItem] instruction from raw instruction data.
ClaimPrizePoolItemInstructionData parseClaimPrizePoolItemInstruction(
  Instruction instruction,
) {
  return getClaimPrizePoolItemInstructionDataDecoder().decode(
    instruction.data!,
  );
}
