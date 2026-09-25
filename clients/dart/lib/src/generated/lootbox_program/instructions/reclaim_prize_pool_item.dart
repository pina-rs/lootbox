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
class ReclaimPrizePoolItemInstructionData {
  const ReclaimPrizePoolItemInstructionData({
    required this.poolIndex,
    required this.root,
    required this.dataHash,
    required this.creatorHash,
    required this.nonce,
    required this.index,
    required this.metadata,
  }) : discriminator = 49,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int poolIndex;
  final Uint8List root;
  final Uint8List dataHash;
  final Uint8List creatorHash;
  final BigInt nonce;
  final int index;
  final List<int> metadata;
}

Encoder<ReclaimPrizePoolItemInstructionData>
getReclaimPrizePoolItemInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('poolIndex', getU32Encoder()),
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
        getArrayEncoder(
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
    (ReclaimPrizePoolItemInstructionData value) => <String, Object?>{
      'discriminator': 49,
      'migrationVersion': 0,
      'poolIndex': value.poolIndex,
      'root': value.root,
      'dataHash': value.dataHash,
      'creatorHash': value.creatorHash,
      'nonce': value.nonce,
      'index': value.index,
      'metadata': value.metadata,
    },
  );
}

Decoder<ReclaimPrizePoolItemInstructionData>
getReclaimPrizePoolItemInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('poolIndex', getU32Decoder()),
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
      'codecDescription': 'reclaimPrizePoolItem instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ReclaimPrizePoolItemInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(49)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ReclaimPrizePoolItemInstructionData(
        poolIndex: map['poolIndex']! as int,
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
      FixedSizeDecoder<ReclaimPrizePoolItemInstructionData>(
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
      VariableSizeDecoder<ReclaimPrizePoolItemInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ReclaimPrizePoolItemInstructionData, ReclaimPrizePoolItemInstructionData>
getReclaimPrizePoolItemInstructionDataCodec() {
  return combineCodec(
    getReclaimPrizePoolItemInstructionDataEncoder(),
    getReclaimPrizePoolItemInstructionDataDecoder(),
  );
}

/// Creates a [ReclaimPrizePoolItem] instruction.
Instruction getReclaimPrizePoolItemInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
  required Address prizePool,
  required Address prizePoolItem,
  required Address treeConfig,
  required Address merkleTree,
  required Address bubblegumProgram,
  required Address logWrapper,
  required Address compressionProgram,
  required Address systemProgram,
  required Address proofAccounts,
  required int poolIndex,
  required Uint8List root,
  required Uint8List dataHash,
  required Uint8List creatorHash,
  required BigInt nonce,
  required int index,
  required List<int> metadata,
}) {
  final instructionData = ReclaimPrizePoolItemInstructionData(
    poolIndex: poolIndex,
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
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: prizePool, role: AccountRole.writable),
      AccountMeta(address: prizePoolItem, role: AccountRole.writable),
      AccountMeta(address: treeConfig, role: AccountRole.readonly),
      AccountMeta(address: merkleTree, role: AccountRole.writable),
      AccountMeta(address: bubblegumProgram, role: AccountRole.readonly),
      AccountMeta(address: logWrapper, role: AccountRole.readonly),
      AccountMeta(address: compressionProgram, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: proofAccounts, role: AccountRole.readonly),
    ],
    data: getReclaimPrizePoolItemInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [ReclaimPrizePoolItem] instruction from raw instruction data.
ReclaimPrizePoolItemInstructionData parseReclaimPrizePoolItemInstruction(
  Instruction instruction,
) {
  return getReclaimPrizePoolItemInstructionDataDecoder().decode(
    instruction.data!,
  );
}
