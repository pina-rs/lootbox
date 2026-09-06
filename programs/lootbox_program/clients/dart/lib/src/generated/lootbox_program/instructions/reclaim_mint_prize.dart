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
class ReclaimMintPrizeInstructionData {
  const ReclaimMintPrizeInstructionData({
    required this.assetIndex,
  }) :
      discriminator = 43;

  final int discriminator;
  final int assetIndex;
}

Encoder<ReclaimMintPrizeInstructionData> getReclaimMintPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ReclaimMintPrizeInstructionData value) => <String, Object?>{
      'discriminator': 43,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ReclaimMintPrizeInstructionData> getReclaimMintPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'reclaimMintPrize instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (ReclaimMintPrizeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(43),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ReclaimMintPrizeInstructionData(
      assetIndex: map['assetIndex']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ReclaimMintPrizeInstructionData>(
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
      VariableSizeDecoder<ReclaimMintPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ReclaimMintPrizeInstructionData, ReclaimMintPrizeInstructionData> getReclaimMintPrizeInstructionDataCodec() {
  return combineCodec(getReclaimMintPrizeInstructionDataEncoder(), getReclaimMintPrizeInstructionDataDecoder());
}

/// Creates a [ReclaimMintPrize] instruction.
Instruction getReclaimMintPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
  required Address mint,
  required Address tokenProgram,
  required int assetIndex,
}) {
  final instructionData = ReclaimMintPrizeInstructionData(
      assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.readonly),
    AccountMeta(address: template, role: AccountRole.readonly),
    AccountMeta(address: boxMint, role: AccountRole.readonly),
    AccountMeta(address: bundle, role: AccountRole.writable),
    AccountMeta(address: mint, role: AccountRole.writable),
    AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getReclaimMintPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ReclaimMintPrize] instruction from raw instruction data.
ReclaimMintPrizeInstructionData parseReclaimMintPrizeInstruction(Instruction instruction) {
  return getReclaimMintPrizeInstructionDataDecoder().decode(instruction.data!);
}
