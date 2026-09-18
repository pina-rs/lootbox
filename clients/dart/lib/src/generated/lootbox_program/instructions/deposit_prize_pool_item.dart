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
class DepositPrizePoolItemInstructionData {
  const DepositPrizePoolItemInstructionData({
    required this.root,
    required this.dataHash,
    required this.creatorHash,
    required this.nonce,
    required this.index,
  }) : discriminator = 45,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final Uint8List root;
  final Uint8List dataHash;
  final Uint8List creatorHash;
  final BigInt nonce;
  final int index;
}

Encoder<DepositPrizePoolItemInstructionData>
getDepositPrizePoolItemInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('root', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('dataHash', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    (
      'creatorHash',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('nonce', getU64Encoder()),
    ('index', getU32Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (DepositPrizePoolItemInstructionData value) => <String, Object?>{
      'discriminator': 45,
      'migrationVersion': 0,
      'root': value.root,
      'dataHash': value.dataHash,
      'creatorHash': value.creatorHash,
      'nonce': value.nonce,
      'index': value.index,
    },
  );
}

Decoder<DepositPrizePoolItemInstructionData>
getDepositPrizePoolItemInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('root', fixDecoderSize(getBytesDecoder(), 32)),
    ('dataHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('creatorHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('nonce', getU64Decoder()),
    ('index', getU32Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'depositPrizePoolItem instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (DepositPrizePoolItemInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(45)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      DepositPrizePoolItemInstructionData(
        root: map['root']! as Uint8List,
        dataHash: map['dataHash']! as Uint8List,
        creatorHash: map['creatorHash']! as Uint8List,
        nonce: map['nonce']! as BigInt,
        index: map['index']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<DepositPrizePoolItemInstructionData>(
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
      VariableSizeDecoder<DepositPrizePoolItemInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<DepositPrizePoolItemInstructionData, DepositPrizePoolItemInstructionData>
getDepositPrizePoolItemInstructionDataCodec() {
  return combineCodec(
    getDepositPrizePoolItemInstructionDataEncoder(),
    getDepositPrizePoolItemInstructionDataDecoder(),
  );
}

/// Creates a [DepositPrizePoolItem] instruction.
Instruction getDepositPrizePoolItemInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
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
  required Uint8List root,
  required Uint8List dataHash,
  required Uint8List creatorHash,
  required BigInt nonce,
  required int index,
}) {
  final instructionData = DepositPrizePoolItemInstructionData(
    root: root,
    dataHash: dataHash,
    creatorHash: creatorHash,
    nonce: nonce,
    index: index,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.readonly),
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
    data: getDepositPrizePoolItemInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [DepositPrizePoolItem] instruction from raw instruction data.
DepositPrizePoolItemInstructionData parseDepositPrizePoolItemInstruction(
  Instruction instruction,
) {
  return getDepositPrizePoolItemInstructionDataDecoder().decode(
    instruction.data!,
  );
}
