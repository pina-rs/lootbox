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
class MintTemplateBoxesInstructionData {
  const MintTemplateBoxesInstructionData({required this.amount})
    : discriminator = 15;

  final int discriminator;
  final BigInt amount;
}

Encoder<MintTemplateBoxesInstructionData>
getMintTemplateBoxesInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('amount', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (MintTemplateBoxesInstructionData value) => <String, Object?>{
      'discriminator': 15,
      'amount': value.amount,
    },
  );
}

Decoder<MintTemplateBoxesInstructionData>
getMintTemplateBoxesInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('amount', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'mintTemplateBoxes instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (MintTemplateBoxesInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(15)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      MintTemplateBoxesInstructionData(amount: map['amount']! as BigInt),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<MintTemplateBoxesInstructionData>(
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
      VariableSizeDecoder<MintTemplateBoxesInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<MintTemplateBoxesInstructionData, MintTemplateBoxesInstructionData>
getMintTemplateBoxesInstructionDataCodec() {
  return combineCodec(
    getMintTemplateBoxesInstructionDataEncoder(),
    getMintTemplateBoxesInstructionDataDecoder(),
  );
}

/// Creates a [MintTemplateBoxes] instruction.
Instruction getMintTemplateBoxesInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address recipientBoxAccount,
  required Address boxTokenProgram,
  required BigInt amount,
}) {
  final instructionData = MintTemplateBoxesInstructionData(amount: amount);

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.readonly),
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: boxMint, role: AccountRole.writable),
      AccountMeta(address: recipientBoxAccount, role: AccountRole.writable),
      AccountMeta(address: boxTokenProgram, role: AccountRole.readonly),
    ],
    data: getMintTemplateBoxesInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [MintTemplateBoxes] instruction from raw instruction data.
MintTemplateBoxesInstructionData parseMintTemplateBoxesInstruction(
  Instruction instruction,
) {
  return getMintTemplateBoxesInstructionDataDecoder().decode(instruction.data!);
}
