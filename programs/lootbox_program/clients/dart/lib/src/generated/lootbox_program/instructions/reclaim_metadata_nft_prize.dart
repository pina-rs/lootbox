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
class ReclaimMetadataNftPrizeInstructionData {
  const ReclaimMetadataNftPrizeInstructionData({
    required this.assetIndex,
  }) :
      discriminator = 29;

  final int discriminator;
  final int assetIndex;
}

Encoder<ReclaimMetadataNftPrizeInstructionData> getReclaimMetadataNftPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ReclaimMetadataNftPrizeInstructionData value) => <String, Object?>{
      'discriminator': 29,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ReclaimMetadataNftPrizeInstructionData> getReclaimMetadataNftPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'reclaimMetadataNftPrize instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (ReclaimMetadataNftPrizeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(29),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ReclaimMetadataNftPrizeInstructionData(
      assetIndex: map['assetIndex']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ReclaimMetadataNftPrizeInstructionData>(
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
      VariableSizeDecoder<ReclaimMetadataNftPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ReclaimMetadataNftPrizeInstructionData, ReclaimMetadataNftPrizeInstructionData> getReclaimMetadataNftPrizeInstructionDataCodec() {
  return combineCodec(getReclaimMetadataNftPrizeInstructionDataEncoder(), getReclaimMetadataNftPrizeInstructionDataDecoder());
}

/// Creates a [ReclaimMetadataNftPrize] instruction.
Instruction getReclaimMetadataNftPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
  required Address mint,
  required Address escrow,
  required Address destination,
  required Address metadata,
  required Address tokenMetadataProgram,
  required Address systemProgram,
  required Address instructionsSysvar,
  required Address tokenProgram,
  required Address associatedTokenProgram,
  required Address optionalAccounts,
  required int assetIndex,
}) {
  final instructionData = ReclaimMetadataNftPrizeInstructionData(
      assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.writableSigner),
    AccountMeta(address: template, role: AccountRole.readonly),
    AccountMeta(address: boxMint, role: AccountRole.readonly),
    AccountMeta(address: bundle, role: AccountRole.writable),
    AccountMeta(address: mint, role: AccountRole.readonly),
    AccountMeta(address: escrow, role: AccountRole.writable),
    AccountMeta(address: destination, role: AccountRole.writable),
    AccountMeta(address: metadata, role: AccountRole.writable),
    AccountMeta(address: tokenMetadataProgram, role: AccountRole.readonly),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    AccountMeta(address: instructionsSysvar, role: AccountRole.readonly),
    AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    AccountMeta(address: associatedTokenProgram, role: AccountRole.readonly),
    AccountMeta(address: optionalAccounts, role: AccountRole.readonly),
    ],
    data: getReclaimMetadataNftPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ReclaimMetadataNftPrize] instruction from raw instruction data.
ReclaimMetadataNftPrizeInstructionData parseReclaimMetadataNftPrizeInstruction(Instruction instruction) {
  return getReclaimMetadataNftPrizeInstructionDataDecoder().decode(instruction.data!);
}
