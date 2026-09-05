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
class ClaimMetadataNftPrizeInstructionData {
  const ClaimMetadataNftPrizeInstructionData({
    required this.assetIndex,
  }) :
      discriminator = 28;

  final int discriminator;
  final int assetIndex;
}

Encoder<ClaimMetadataNftPrizeInstructionData> getClaimMetadataNftPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ClaimMetadataNftPrizeInstructionData value) => <String, Object?>{
      'discriminator': 28,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ClaimMetadataNftPrizeInstructionData> getClaimMetadataNftPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'claimMetadataNftPrize instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (ClaimMetadataNftPrizeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(28),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ClaimMetadataNftPrizeInstructionData(
      assetIndex: map['assetIndex']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ClaimMetadataNftPrizeInstructionData>(
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
      VariableSizeDecoder<ClaimMetadataNftPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ClaimMetadataNftPrizeInstructionData, ClaimMetadataNftPrizeInstructionData> getClaimMetadataNftPrizeInstructionDataCodec() {
  return combineCodec(getClaimMetadataNftPrizeInstructionDataEncoder(), getClaimMetadataNftPrizeInstructionDataDecoder());
}

/// Creates a [ClaimMetadataNftPrize] instruction.
Instruction getClaimMetadataNftPrizeInstruction({
  required Address programAddress,
  required Address payer,
  required Address template,
  required Address opening,
  required Address bundle,
  required Address recipient,
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
  final instructionData = ClaimMetadataNftPrizeInstructionData(
      assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: payer, role: AccountRole.writableSigner),
    AccountMeta(address: template, role: AccountRole.readonly),
    AccountMeta(address: opening, role: AccountRole.writable),
    AccountMeta(address: bundle, role: AccountRole.writable),
    AccountMeta(address: recipient, role: AccountRole.readonly),
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
    data: getClaimMetadataNftPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [ClaimMetadataNftPrize] instruction from raw instruction data.
ClaimMetadataNftPrizeInstructionData parseClaimMetadataNftPrizeInstruction(Instruction instruction) {
  return getClaimMetadataNftPrizeInstructionDataDecoder().decode(instruction.data!);
}
