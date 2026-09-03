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
class MintBoxesInstructionData {
  const MintBoxesInstructionData({required this.amount}) : discriminator = 4;

  final int discriminator;
  final BigInt amount;
}

Encoder<MintBoxesInstructionData> getMintBoxesInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('amount', getU64Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (MintBoxesInstructionData value) => <String, Object?>{
      'discriminator': 4,
      'amount': value.amount,
    },
  );
}

Decoder<MintBoxesInstructionData> getMintBoxesInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('amount', getU64Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'mintBoxes instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (MintBoxesInstructionData, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(4)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      MintBoxesInstructionData(amount: map['amount']! as BigInt),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<MintBoxesInstructionData>(
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
      VariableSizeDecoder<MintBoxesInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<MintBoxesInstructionData, MintBoxesInstructionData>
getMintBoxesInstructionDataCodec() {
  return combineCodec(
    getMintBoxesInstructionDataEncoder(),
    getMintBoxesInstructionDataDecoder(),
  );
}

/// Creates a [MintBoxes] instruction.
Instruction getMintBoxesInstruction({
  required Address programAddress,
  required Address authority,
  required Address lootbox,
  required Address vault,
  required Address boxMint,
  required Address recipientBoxAccount,
  required Address tokenProgram,
  required BigInt amount,
}) {
  final instructionData = MintBoxesInstructionData(amount: amount);

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.readonlySigner),
      AccountMeta(address: lootbox, role: AccountRole.writable),
      AccountMeta(address: vault, role: AccountRole.readonly),
      AccountMeta(address: boxMint, role: AccountRole.writable),
      AccountMeta(address: recipientBoxAccount, role: AccountRole.writable),
      AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getMintBoxesInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [MintBoxes] instruction from raw instruction data.
MintBoxesInstructionData parseMintBoxesInstruction(Instruction instruction) {
  return getMintBoxesInstructionDataDecoder().decode(instruction.data!);
}
