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
class CloseTemplateOpeningInstructionData {
  const CloseTemplateOpeningInstructionData() :
      discriminator = 24;

  final int discriminator;
}

Encoder<CloseTemplateOpeningInstructionData> getCloseTemplateOpeningInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (CloseTemplateOpeningInstructionData value) => <String, Object?>{
      'discriminator': 24,
    },
  );
}

Decoder<CloseTemplateOpeningInstructionData> getCloseTemplateOpeningInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'closeTemplateOpening instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (CloseTemplateOpeningInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(24),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      CloseTemplateOpeningInstructionData(

      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CloseTemplateOpeningInstructionData>(
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
      VariableSizeDecoder<CloseTemplateOpeningInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<CloseTemplateOpeningInstructionData, CloseTemplateOpeningInstructionData> getCloseTemplateOpeningInstructionDataCodec() {
  return combineCodec(getCloseTemplateOpeningInstructionDataEncoder(), getCloseTemplateOpeningInstructionDataDecoder());
}

/// Creates a [CloseTemplateOpening] instruction.
Instruction getCloseTemplateOpeningInstruction({
  required Address programAddress,
  required Address rentRefund,
  required Address template,
  required Address opening,
  required Address randomness,
  required Address rewardEscrow,
  required Address oracleProgram,
  required Address oracleProgramState,
  required Address oracleLut,
  required Address oracleLutSigner,
  required Address systemProgram,
  required Address tokenProgram,
  required Address wrappedSolMint,
  required Address addressLookupTableProgram,

}) {
  final instructionData = CloseTemplateOpeningInstructionData(

  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: rentRefund, role: AccountRole.writable),
    AccountMeta(address: template, role: AccountRole.readonly),
    AccountMeta(address: opening, role: AccountRole.writable),
    AccountMeta(address: randomness, role: AccountRole.writable),
    AccountMeta(address: rewardEscrow, role: AccountRole.writable),
    AccountMeta(address: oracleProgram, role: AccountRole.readonly),
    AccountMeta(address: oracleProgramState, role: AccountRole.readonly),
    AccountMeta(address: oracleLut, role: AccountRole.writable),
    AccountMeta(address: oracleLutSigner, role: AccountRole.readonly),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    AccountMeta(address: wrappedSolMint, role: AccountRole.readonly),
    AccountMeta(address: addressLookupTableProgram, role: AccountRole.readonly),
    ],
    data: getCloseTemplateOpeningInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [CloseTemplateOpening] instruction from raw instruction data.
CloseTemplateOpeningInstructionData parseCloseTemplateOpeningInstruction(Instruction instruction) {
  return getCloseTemplateOpeningInstructionDataDecoder().decode(instruction.data!);
}
