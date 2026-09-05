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
class FundMetadataNftPrizeInstructionData {
  const FundMetadataNftPrizeInstructionData() :
      discriminator = 27;

  final int discriminator;
}

Encoder<FundMetadataNftPrizeInstructionData> getFundMetadataNftPrizeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (FundMetadataNftPrizeInstructionData value) => <String, Object?>{
      'discriminator': 27,
    },
  );
}

Decoder<FundMetadataNftPrizeInstructionData> getFundMetadataNftPrizeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'fundMetadataNftPrize instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (FundMetadataNftPrizeInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(27),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      FundMetadataNftPrizeInstructionData(

      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<FundMetadataNftPrizeInstructionData>(
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
      VariableSizeDecoder<FundMetadataNftPrizeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FundMetadataNftPrizeInstructionData, FundMetadataNftPrizeInstructionData> getFundMetadataNftPrizeInstructionDataCodec() {
  return combineCodec(getFundMetadataNftPrizeInstructionDataEncoder(), getFundMetadataNftPrizeInstructionDataDecoder());
}

/// Creates a [FundMetadataNftPrize] instruction.
Instruction getFundMetadataNftPrizeInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address mint,
  required Address source,
  required Address escrow,
  required Address metadata,
  required Address tokenMetadataProgram,
  required Address systemProgram,
  required Address instructionsSysvar,
  required Address tokenProgram,
  required Address associatedTokenProgram,
  required Address optionalAccounts,

}) {
  final instructionData = FundMetadataNftPrizeInstructionData(

  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.writableSigner),
    AccountMeta(address: template, role: AccountRole.readonly),
    AccountMeta(address: bundle, role: AccountRole.writable),
    AccountMeta(address: mint, role: AccountRole.readonly),
    AccountMeta(address: source, role: AccountRole.writable),
    AccountMeta(address: escrow, role: AccountRole.writable),
    AccountMeta(address: metadata, role: AccountRole.writable),
    AccountMeta(address: tokenMetadataProgram, role: AccountRole.readonly),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    AccountMeta(address: instructionsSysvar, role: AccountRole.readonly),
    AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    AccountMeta(address: associatedTokenProgram, role: AccountRole.readonly),
    AccountMeta(address: optionalAccounts, role: AccountRole.readonly),
    ],
    data: getFundMetadataNftPrizeInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [FundMetadataNftPrize] instruction from raw instruction data.
FundMetadataNftPrizeInstructionData parseFundMetadataNftPrizeInstruction(Instruction instruction) {
  return getFundMetadataNftPrizeInstructionDataDecoder().decode(instruction.data!);
}
