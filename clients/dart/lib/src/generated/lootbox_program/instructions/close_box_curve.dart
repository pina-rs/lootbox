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
class CloseBoxCurveInstructionData {
  const CloseBoxCurveInstructionData()
    : discriminator = 63,
      migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
}

Encoder<CloseBoxCurveInstructionData> getCloseBoxCurveInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (CloseBoxCurveInstructionData value) => <String, Object?>{
      'discriminator': 63,
      'migrationVersion': 0,
    },
  );
}

Decoder<CloseBoxCurveInstructionData> getCloseBoxCurveInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'closeBoxCurve instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (CloseBoxCurveInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(63)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (CloseBoxCurveInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CloseBoxCurveInstructionData>(
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
      VariableSizeDecoder<CloseBoxCurveInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<CloseBoxCurveInstructionData, CloseBoxCurveInstructionData>
getCloseBoxCurveInstructionDataCodec() {
  return combineCodec(
    getCloseBoxCurveInstructionDataEncoder(),
    getCloseBoxCurveInstructionDataDecoder(),
  );
}

/// Creates a [CloseBoxCurve] instruction.
Instruction getCloseBoxCurveInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxCurve,
  required Address boxMint,
  required Address curveBoxAccount,
  required Address destinationBoxAccount,
  required Address boxTokenProgram,
}) {
  final instructionData = CloseBoxCurveInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxCurve, role: AccountRole.writable),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: curveBoxAccount, role: AccountRole.writable),
      AccountMeta(address: destinationBoxAccount, role: AccountRole.writable),
      AccountMeta(address: boxTokenProgram, role: AccountRole.readonly),
    ],
    data: getCloseBoxCurveInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [CloseBoxCurve] instruction from raw instruction data.
CloseBoxCurveInstructionData parseCloseBoxCurveInstruction(
  Instruction instruction,
) {
  return getCloseBoxCurveInstructionDataDecoder().decode(instruction.data!);
}
