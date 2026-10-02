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
class OpenBoxCurveInstructionData {
  const OpenBoxCurveInstructionData({
    required this.inventory,
    required this.startPrice,
    required this.priceStep,
    required this.feeBps,
    required this.bump,
  }) : discriminator = 60,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final BigInt inventory;
  final BigInt startPrice;
  final BigInt priceStep;
  final int feeBps;
  final int bump;
}

Encoder<OpenBoxCurveInstructionData> getOpenBoxCurveInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('inventory', getU64Encoder()),
    ('startPrice', getU64Encoder()),
    ('priceStep', getU64Encoder()),
    ('feeBps', getU16Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (OpenBoxCurveInstructionData value) => <String, Object?>{
      'discriminator': 60,
      'migrationVersion': 0,
      'inventory': value.inventory,
      'startPrice': value.startPrice,
      'priceStep': value.priceStep,
      'feeBps': value.feeBps,
      'bump': value.bump,
    },
  );
}

Decoder<OpenBoxCurveInstructionData> getOpenBoxCurveInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('inventory', getU64Decoder()),
    ('startPrice', getU64Decoder()),
    ('priceStep', getU64Decoder()),
    ('feeBps', getU16Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'openBoxCurve instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (OpenBoxCurveInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(60)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      OpenBoxCurveInstructionData(
        inventory: map['inventory']! as BigInt,
        startPrice: map['startPrice']! as BigInt,
        priceStep: map['priceStep']! as BigInt,
        feeBps: map['feeBps']! as int,
        bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<OpenBoxCurveInstructionData>(
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
      VariableSizeDecoder<OpenBoxCurveInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<OpenBoxCurveInstructionData, OpenBoxCurveInstructionData>
getOpenBoxCurveInstructionDataCodec() {
  return combineCodec(
    getOpenBoxCurveInstructionDataEncoder(),
    getOpenBoxCurveInstructionDataDecoder(),
  );
}

/// Creates a [OpenBoxCurve] instruction.
Instruction getOpenBoxCurveInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address sourceBoxAccount,
  required Address boxCurve,
  required Address curveBoxAccount,
  required Address systemProgram,
  required Address boxTokenProgram,
  required BigInt inventory,
  required BigInt startPrice,
  required BigInt priceStep,
  required int feeBps,
  required int bump,
}) {
  final instructionData = OpenBoxCurveInstructionData(
    inventory: inventory,
    startPrice: startPrice,
    priceStep: priceStep,
    feeBps: feeBps,
    bump: bump,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: sourceBoxAccount, role: AccountRole.writable),
      AccountMeta(address: boxCurve, role: AccountRole.writable),
      AccountMeta(address: curveBoxAccount, role: AccountRole.writable),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: boxTokenProgram, role: AccountRole.readonly),
    ],
    data: getOpenBoxCurveInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [OpenBoxCurve] instruction from raw instruction data.
OpenBoxCurveInstructionData parseOpenBoxCurveInstruction(
  Instruction instruction,
) {
  return getOpenBoxCurveInstructionDataDecoder().decode(instruction.data!);
}
