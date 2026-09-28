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
class BuyCurveBoxesInstructionData {
  const BuyCurveBoxesInstructionData({
    required this.count,
    required this.maxLamports,
  }) : discriminator = 61,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final BigInt count;
  final BigInt maxLamports;
}

Encoder<BuyCurveBoxesInstructionData> getBuyCurveBoxesInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('count', getU64Encoder()),
    ('maxLamports', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (BuyCurveBoxesInstructionData value) => <String, Object?>{
      'discriminator': 61,
      'migrationVersion': 0,
      'count': value.count,
      'maxLamports': value.maxLamports,
    },
  );
}

Decoder<BuyCurveBoxesInstructionData> getBuyCurveBoxesInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('count', getU64Decoder()),
    ('maxLamports', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'buyCurveBoxes instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (BuyCurveBoxesInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(61)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      BuyCurveBoxesInstructionData(
        count: map['count']! as BigInt,
        maxLamports: map['maxLamports']! as BigInt,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<BuyCurveBoxesInstructionData>(
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
      VariableSizeDecoder<BuyCurveBoxesInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<BuyCurveBoxesInstructionData, BuyCurveBoxesInstructionData>
getBuyCurveBoxesInstructionDataCodec() {
  return combineCodec(
    getBuyCurveBoxesInstructionDataEncoder(),
    getBuyCurveBoxesInstructionDataDecoder(),
  );
}

/// Creates a [BuyCurveBoxes] instruction.
Instruction getBuyCurveBoxesInstruction({
  required Address programAddress,
  required Address buyer,
  required Address template,
  required Address boxCurve,
  required Address boxMint,
  required Address curveBoxAccount,
  required Address destinationBoxAccount,
  required Address authority,
  required Address systemProgram,
  required Address boxTokenProgram,
  required BigInt count,
  required BigInt maxLamports,
}) {
  final instructionData = BuyCurveBoxesInstructionData(
    count: count,
    maxLamports: maxLamports,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: buyer, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxCurve, role: AccountRole.writable),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: curveBoxAccount, role: AccountRole.writable),
      AccountMeta(address: destinationBoxAccount, role: AccountRole.writable),
      AccountMeta(address: authority, role: AccountRole.writable),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: boxTokenProgram, role: AccountRole.readonly),
    ],
    data: getBuyCurveBoxesInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [BuyCurveBoxes] instruction from raw instruction data.
BuyCurveBoxesInstructionData parseBuyCurveBoxesInstruction(
  Instruction instruction,
) {
  return getBuyCurveBoxesInstructionDataDecoder().decode(instruction.data!);
}
