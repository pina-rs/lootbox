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
class SellCurveBoxesInstructionData {
  const SellCurveBoxesInstructionData({
    required this.count,
    required this.minLamports,
  }) : discriminator = 62,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final BigInt count;
  final BigInt minLamports;
}

Encoder<SellCurveBoxesInstructionData>
getSellCurveBoxesInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('count', getU64Encoder()),
    ('minLamports', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (SellCurveBoxesInstructionData value) => <String, Object?>{
      'discriminator': 62,
      'migrationVersion': 0,
      'count': value.count,
      'minLamports': value.minLamports,
    },
  );
}

Decoder<SellCurveBoxesInstructionData>
getSellCurveBoxesInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('count', getU64Decoder()),
    ('minLamports', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'sellCurveBoxes instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (SellCurveBoxesInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(62)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      SellCurveBoxesInstructionData(
        count: map['count']! as BigInt,
        minLamports: map['minLamports']! as BigInt,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<SellCurveBoxesInstructionData>(
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
      VariableSizeDecoder<SellCurveBoxesInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<SellCurveBoxesInstructionData, SellCurveBoxesInstructionData>
getSellCurveBoxesInstructionDataCodec() {
  return combineCodec(
    getSellCurveBoxesInstructionDataEncoder(),
    getSellCurveBoxesInstructionDataDecoder(),
  );
}

/// Creates a [SellCurveBoxes] instruction.
Instruction getSellCurveBoxesInstruction({
  required Address programAddress,
  required Address seller,
  required Address template,
  required Address boxCurve,
  required Address boxMint,
  required Address sourceBoxAccount,
  required Address curveBoxAccount,
  required Address authority,
  required Address boxTokenProgram,
  required BigInt count,
  required BigInt minLamports,
}) {
  final instructionData = SellCurveBoxesInstructionData(
    count: count,
    minLamports: minLamports,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: seller, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxCurve, role: AccountRole.writable),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: sourceBoxAccount, role: AccountRole.writable),
      AccountMeta(address: curveBoxAccount, role: AccountRole.writable),
      AccountMeta(address: authority, role: AccountRole.writable),
      AccountMeta(address: boxTokenProgram, role: AccountRole.readonly),
    ],
    data: getSellCurveBoxesInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [SellCurveBoxes] instruction from raw instruction data.
SellCurveBoxesInstructionData parseSellCurveBoxesInstruction(
  Instruction instruction,
) {
  return getSellCurveBoxesInstructionDataDecoder().decode(instruction.data!);
}
