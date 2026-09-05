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
class AddBundleInstructionData {
  const AddBundleInstructionData({
    required this.quantity,
    required this.assetCount,
    required this.bump,
  }) :
      discriminator = 11;

  final int discriminator;
  final BigInt quantity;
  final int assetCount;
  final int bump;
}

Encoder<AddBundleInstructionData> getAddBundleInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('quantity', getU64Encoder()),
    ('assetCount', getU8Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (AddBundleInstructionData value) => <String, Object?>{
      'discriminator': 11,
      'quantity': value.quantity,
      'assetCount': value.assetCount,
      'bump': value.bump,
    },
  );
}

Decoder<AddBundleInstructionData> getAddBundleInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('quantity', getU64Decoder()),
    ('assetCount', getU8Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'addBundle instruction decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (AddBundleInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(11),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      AddBundleInstructionData(
      quantity: map['quantity']! as BigInt,
      assetCount: map['assetCount']! as int,
      bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<AddBundleInstructionData>(
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
      VariableSizeDecoder<AddBundleInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<AddBundleInstructionData, AddBundleInstructionData> getAddBundleInstructionDataCodec() {
  return combineCodec(getAddBundleInstructionDataEncoder(), getAddBundleInstructionDataDecoder());
}

/// Creates a [AddBundle] instruction.
Instruction getAddBundleInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address systemProgram,
  required BigInt quantity,
  required int assetCount,
  required int bump,
}) {
  final instructionData = AddBundleInstructionData(
      quantity: quantity,
      assetCount: assetCount,
      bump: bump,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
    AccountMeta(address: authority, role: AccountRole.writable),
    AccountMeta(address: template, role: AccountRole.writable),
    AccountMeta(address: bundle, role: AccountRole.writable),
    AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getAddBundleInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [AddBundle] instruction from raw instruction data.
AddBundleInstructionData parseAddBundleInstruction(Instruction instruction) {
  return getAddBundleInstructionDataDecoder().decode(instruction.data!);
}
