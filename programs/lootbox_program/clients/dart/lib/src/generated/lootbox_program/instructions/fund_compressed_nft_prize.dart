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
class FundCompressedNftPrizeInstructionData {
  const FundCompressedNftPrizeInstructionData({
    required this.root,
    required this.dataHash,
    required this.creatorHash,
    required this.nonce,
    required this.index,
  }) :
      discriminator = 33;

  final int discriminator;
  final Uint8List root;
  final Uint8List dataHash;
  final Uint8List creatorHash;
  final BigInt nonce;
  final int index;
}

Encoder<FundCompressedNftPrizeInstructionData> getFundCompressedNftPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('root', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('dataHash', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('creatorHash', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('nonce', getU64Encoder()),
    ('index', getU32Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (FundCompressedNftPrizeInstructionData value) => <String, Object?>{
      'discriminator': 33,
      'root': value.root,
      'dataHash': value.dataHash,
      'creatorHash': value.creatorHash,
      'nonce': value.nonce,
      'index': value.index,
    },
  );
}

Decoder<FundCompressedNftPrizeInstructionData> getFundCompressedNftPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
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
        'codecDescription': 'fundCompressedNftPrize instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (FundCompressedNftPrizeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(33),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      FundCompressedNftPrizeInstructionData(
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
      FixedSizeDecoder<FundCompressedNftPrizeInstructionData>(
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
      VariableSizeDecoder<FundCompressedNftPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FundCompressedNftPrizeInstructionData, FundCompressedNftPrizeInstructionData> getFundCompressedNftPrizeInstructionDataCodec() {
  return combineCodec(getFundCompressedNftPrizeInstructionDataEncoder(), getFundCompressedNftPrizeInstructionDataDecoder());
}

/// Creates a [FundCompressedNftPrize] instruction.
Instruction getFundCompressedNftPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
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
  final instructionData = FundCompressedNftPrizeInstructionData(
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
    AccountMeta(address: bundle, role: AccountRole.writable),
    AccountMeta(address: treeConfig, role: AccountRole.readonly),
    AccountMeta(address: merkleTree, role: AccountRole.writable),
    AccountMeta(address: bubblegumProgram, role: AccountRole.readonly),
    AccountMeta(address: logWrapper, role: AccountRole.readonly),
    AccountMeta(address: compressionProgram, role: AccountRole.readonly),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    AccountMeta(address: proofAccounts, role: AccountRole.readonly),
    ],
    data: getFundCompressedNftPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [FundCompressedNftPrize] instruction from raw instruction data.
FundCompressedNftPrizeInstructionData parseFundCompressedNftPrizeInstruction(Instruction instruction) {
  return getFundCompressedNftPrizeInstructionDataDecoder().decode(instruction.data!);
}
