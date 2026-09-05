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
class CloseServiceVaultInstructionData {
  const CloseServiceVaultInstructionData() :
      discriminator = 38;

  final int discriminator;
}

Encoder<CloseServiceVaultInstructionData> getCloseServiceVaultInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (CloseServiceVaultInstructionData value) => <String, Object?>{
      'discriminator': 38,
    },
  );
}

Decoder<CloseServiceVaultInstructionData> getCloseServiceVaultInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'closeServiceVault instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (CloseServiceVaultInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(38),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      CloseServiceVaultInstructionData(

      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CloseServiceVaultInstructionData>(
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
      VariableSizeDecoder<CloseServiceVaultInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<CloseServiceVaultInstructionData, CloseServiceVaultInstructionData> getCloseServiceVaultInstructionDataCodec() {
  return combineCodec(getCloseServiceVaultInstructionDataEncoder(), getCloseServiceVaultInstructionDataDecoder());
}

/// Creates a [CloseServiceVault] instruction.
Instruction getCloseServiceVaultInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address serviceVault,
  required Address systemProgram,

}) {
  final instructionData = CloseServiceVaultInstructionData(

  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.writableSigner),
    AccountMeta(address: template, role: AccountRole.readonly),
    AccountMeta(address: boxMint, role: AccountRole.readonly),
    AccountMeta(address: serviceVault, role: AccountRole.writable),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getCloseServiceVaultInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [CloseServiceVault] instruction from raw instruction data.
CloseServiceVaultInstructionData parseCloseServiceVaultInstruction(Instruction instruction) {
  return getCloseServiceVaultInstructionDataDecoder().decode(instruction.data!);
}
