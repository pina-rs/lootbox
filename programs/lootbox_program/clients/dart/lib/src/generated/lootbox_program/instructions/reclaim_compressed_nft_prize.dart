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
class ReclaimCompressedNftPrizeInstructionData {
  const ReclaimCompressedNftPrizeInstructionData({
    required this.assetIndex,
    required this.root,
    required this.dataHash,
    required this.creatorHash,
    required this.nonce,
    required this.index,
  }) :
      discriminator = 35;

  final int discriminator;
  final int assetIndex;
  final Uint8List root;
  final Uint8List dataHash;
  final Uint8List creatorHash;
  final BigInt nonce;
  final int index;
}

Encoder<ReclaimCompressedNftPrizeInstructionData> getReclaimCompressedNftPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
    ('root', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('dataHash', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('creatorHash', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('nonce', getU64Encoder()),
    ('index', getU32Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ReclaimCompressedNftPrizeInstructionData value) => <String, Object?>{
      'discriminator': 35,
      'assetIndex': value.assetIndex,
      'root': value.root,
      'dataHash': value.dataHash,
      'creatorHash': value.creatorHash,
      'nonce': value.nonce,
      'index': value.index,
    },
  );
}

Decoder<ReclaimCompressedNftPrizeInstructionData> getReclaimCompressedNftPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
    ('root', fixDecoderSize(getBytesDecoder(), 32)),
    ('dataHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('creatorHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('nonce', getU64Decoder()),
    ('index', getU32Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'reclaimCompressedNftPrize instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (ReclaimCompressedNftPrizeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(35),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ReclaimCompressedNftPrizeInstructionData(
      assetIndex: map['assetIndex']! as int,
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
      FixedSizeDecoder<ReclaimCompressedNftPrizeInstructionData>(
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
      VariableSizeDecoder<ReclaimCompressedNftPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ReclaimCompressedNftPrizeInstructionData, ReclaimCompressedNftPrizeInstructionData> getReclaimCompressedNftPrizeInstructionDataCodec() {
  return combineCodec(getReclaimCompressedNftPrizeInstructionDataEncoder(), getReclaimCompressedNftPrizeInstructionDataDecoder());
}

/// Creates a [ReclaimCompressedNftPrize] instruction.
Instruction getReclaimCompressedNftPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
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
}) {
  final instructionData = ReclaimCompressedNftPrizeInstructionData(
      assetIndex: assetIndex,
      root: root,
      dataHash: dataHash,
      creatorHash: creatorHash,
      nonce: nonce,
      index: index,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.readonlySigner),
    AccountMeta(address: template, role: AccountRole.readonly),
    AccountMeta(address: boxMint, role: AccountRole.readonly),
    AccountMeta(address: bundle, role: AccountRole.writable),
    AccountMeta(address: treeConfig, role: AccountRole.readonly),
    AccountMeta(address: merkleTree, role: AccountRole.writable),
    AccountMeta(address: bubblegumProgram, role: AccountRole.readonly),
    AccountMeta(address: logWrapper, role: AccountRole.readonly),
    AccountMeta(address: compressionProgram, role: AccountRole.readonly),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    AccountMeta(address: proofAccounts, role: AccountRole.readonly),
    ],
    data: getReclaimCompressedNftPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ReclaimCompressedNftPrize] instruction from raw instruction data.
ReclaimCompressedNftPrizeInstructionData parseReclaimCompressedNftPrizeInstruction(Instruction instruction) {
  return getReclaimCompressedNftPrizeInstructionDataDecoder().decode(instruction.data!);
}
