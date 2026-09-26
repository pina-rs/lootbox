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
class PublishExclusiveCollectionInstructionData {
  const PublishExclusiveCollectionInstructionData()
    : discriminator = 56,
      migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
}

Encoder<PublishExclusiveCollectionInstructionData>
getPublishExclusiveCollectionInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (PublishExclusiveCollectionInstructionData value) => <String, Object?>{
      'discriminator': 56,
      'migrationVersion': 0,
    },
  );
}

Decoder<PublishExclusiveCollectionInstructionData>
getPublishExclusiveCollectionInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'publishExclusiveCollection instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (PublishExclusiveCollectionInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(56)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (PublishExclusiveCollectionInstructionData(), newOffset);
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<PublishExclusiveCollectionInstructionData>(
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
      VariableSizeDecoder<PublishExclusiveCollectionInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<
  PublishExclusiveCollectionInstructionData,
  PublishExclusiveCollectionInstructionData
>
getPublishExclusiveCollectionInstructionDataCodec() {
  return combineCodec(
    getPublishExclusiveCollectionInstructionDataEncoder(),
    getPublishExclusiveCollectionInstructionDataDecoder(),
  );
}

/// Creates a [PublishExclusiveCollection] instruction.
Instruction getPublishExclusiveCollectionInstruction({
  required Address programAddress,
  required Address admin,
  required Address exclusiveCollection,
}) {
  final instructionData = PublishExclusiveCollectionInstructionData();

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: admin, role: AccountRole.readonlySigner),
      AccountMeta(address: exclusiveCollection, role: AccountRole.writable),
    ],
    data: getPublishExclusiveCollectionInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [PublishExclusiveCollection] instruction from raw instruction data.
PublishExclusiveCollectionInstructionData
parsePublishExclusiveCollectionInstruction(Instruction instruction) {
  return getPublishExclusiveCollectionInstructionDataDecoder().decode(
    instruction.data!,
  );
}
