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
class CreateLootboxInstructionData {
  const CreateLootboxInstructionData({
    required this.id,
    required this.maxSupply,
    required this.oracleProgram,
    required this.oracleQueue,
    required this.bump,
    required this.vaultBump,
  }) : discriminator = 0;

  final int discriminator;
  final BigInt id;
  final BigInt maxSupply;
  final Address oracleProgram;
  final Address oracleQueue;
  final int bump;
  final int vaultBump;
}

Encoder<CreateLootboxInstructionData> getCreateLootboxInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('id', getU64Encoder()),
    ('maxSupply', getU64Encoder()),
    ('oracleProgram', getAddressEncoder()),
    ('oracleQueue', getAddressEncoder()),
    ('bump', getU8Encoder()),
    ('vaultBump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (CreateLootboxInstructionData value) => <String, Object?>{
      'discriminator': 0,
      'id': value.id,
      'maxSupply': value.maxSupply,
      'oracleProgram': value.oracleProgram,
      'oracleQueue': value.oracleQueue,
      'bump': value.bump,
      'vaultBump': value.vaultBump,
    },
  );
}

Decoder<CreateLootboxInstructionData> getCreateLootboxInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('id', getU64Decoder()),
    ('maxSupply', getU64Decoder()),
    ('oracleProgram', getAddressDecoder()),
    ('oracleQueue', getAddressDecoder()),
    ('bump', getU8Decoder()),
    ('vaultBump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'createLootbox instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (CreateLootboxInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      CreateLootboxInstructionData(
        id: map['id']! as BigInt,
        maxSupply: map['maxSupply']! as BigInt,
        oracleProgram: map['oracleProgram']! as Address,
        oracleQueue: map['oracleQueue']! as Address,
        bump: map['bump']! as int,
        vaultBump: map['vaultBump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CreateLootboxInstructionData>(
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
      VariableSizeDecoder<CreateLootboxInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<CreateLootboxInstructionData, CreateLootboxInstructionData>
getCreateLootboxInstructionDataCodec() {
  return combineCodec(
    getCreateLootboxInstructionDataEncoder(),
    getCreateLootboxInstructionDataDecoder(),
  );
}

/// Creates a [CreateLootbox] instruction.
Instruction getCreateLootboxInstruction({
  required Address programAddress,
  required Address authority,
  required Address boxMint,
  required Address lootbox,
  required Address vault,
  required Address systemProgram,
  required Address tokenProgram,
  required BigInt id,
  required BigInt maxSupply,
  required Address oracleProgram,
  required Address oracleQueue,
  required int bump,
  required int vaultBump,
}) {
  final instructionData = CreateLootboxInstructionData(
    id: id,
    maxSupply: maxSupply,
    oracleProgram: oracleProgram,
    oracleQueue: oracleQueue,
    bump: bump,
    vaultBump: vaultBump,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: lootbox, role: AccountRole.writable),
      AccountMeta(address: vault, role: AccountRole.writable),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: tokenProgram, role: AccountRole.readonly),
    ],
    data: getCreateLootboxInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [CreateLootbox] instruction from raw instruction data.
CreateLootboxInstructionData parseCreateLootboxInstruction(
  Instruction instruction,
) {
  return getCreateLootboxInstructionDataDecoder().decode(instruction.data!);
}
