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
class CreateTemplateInstructionData {
  const CreateTemplateInstructionData({
    required this.id,
    required this.maxSupply,
    required this.opensAt,
    required this.oracleProgram,
    required this.oracleQueue,
    required this.name,
    required this.uri,
    required this.bump,
  }) : discriminator = 10;

  final int discriminator;
  final BigInt id;
  final BigInt maxSupply;
  final BigInt opensAt;
  final Address oracleProgram;
  final Address oracleQueue;
  final Uint8List name;
  final Uint8List uri;
  final int bump;
}

Encoder<CreateTemplateInstructionData>
getCreateTemplateInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('id', getU64Encoder()),
    ('maxSupply', getU64Encoder()),
    ('opensAt', getI64Encoder()),
    ('oracleProgram', getAddressEncoder()),
    ('oracleQueue', getAddressEncoder()),
    ('name', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('uri', fixEncoderSize(getBytesEncoder(), 200, allowTruncation: false)),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (CreateTemplateInstructionData value) => <String, Object?>{
      'discriminator': 10,
      'id': value.id,
      'maxSupply': value.maxSupply,
      'opensAt': value.opensAt,
      'oracleProgram': value.oracleProgram,
      'oracleQueue': value.oracleQueue,
      'name': value.name,
      'uri': value.uri,
      'bump': value.bump,
    },
  );
}

Decoder<CreateTemplateInstructionData>
getCreateTemplateInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('id', getU64Decoder()),
    ('maxSupply', getU64Decoder()),
    ('opensAt', getI64Decoder()),
    ('oracleProgram', getAddressDecoder()),
    ('oracleQueue', getAddressDecoder()),
    ('name', fixDecoderSize(getBytesDecoder(), 32)),
    ('uri', fixDecoderSize(getBytesDecoder(), 200)),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'createTemplate instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (CreateTemplateInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(10)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      CreateTemplateInstructionData(
        id: map['id']! as BigInt,
        maxSupply: map['maxSupply']! as BigInt,
        opensAt: map['opensAt']! as BigInt,
        oracleProgram: map['oracleProgram']! as Address,
        oracleQueue: map['oracleQueue']! as Address,
        name: map['name']! as Uint8List,
        uri: map['uri']! as Uint8List,
        bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CreateTemplateInstructionData>(
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
      VariableSizeDecoder<CreateTemplateInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<CreateTemplateInstructionData, CreateTemplateInstructionData>
getCreateTemplateInstructionDataCodec() {
  return combineCodec(
    getCreateTemplateInstructionDataEncoder(),
    getCreateTemplateInstructionDataDecoder(),
  );
}

/// Creates a [CreateTemplate] instruction.
Instruction getCreateTemplateInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address systemProgram,
  required Address boxTokenProgram,
  required BigInt id,
  required BigInt maxSupply,
  required BigInt opensAt,
  required Address oracleProgram,
  required Address oracleQueue,
  required Uint8List name,
  required Uint8List uri,
  required int bump,
}) {
  final instructionData = CreateTemplateInstructionData(
    id: id,
    maxSupply: maxSupply,
    opensAt: opensAt,
    oracleProgram: oracleProgram,
    oracleQueue: oracleQueue,
    name: name,
    uri: uri,
    bump: bump,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.writable),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: boxTokenProgram, role: AccountRole.readonly),
    ],
    data: getCreateTemplateInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [CreateTemplate] instruction from raw instruction data.
CreateTemplateInstructionData parseCreateTemplateInstruction(
  Instruction instruction,
) {
  return getCreateTemplateInstructionDataDecoder().decode(instruction.data!);
}
