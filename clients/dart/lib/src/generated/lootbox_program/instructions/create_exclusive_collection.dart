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
class CreateExclusiveCollectionInstructionData {
  const CreateExclusiveCollectionInstructionData({
    required this.collectionId,
    required this.attachOpensAt,
    required this.attachClosesAt,
    required this.layerCount,
    required this.bump,
    required this.namePrefix,
    required this.symbol,
    required this.baseUri,
  }) : discriminator = 53,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final BigInt collectionId;
  final BigInt attachOpensAt;
  final BigInt attachClosesAt;
  final int layerCount;
  final int bump;
  final Uint8List namePrefix;
  final Uint8List symbol;
  final Uint8List baseUri;
}

Encoder<CreateExclusiveCollectionInstructionData>
getCreateExclusiveCollectionInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('collectionId', getU64Encoder()),
    ('attachOpensAt', getI64Encoder()),
    ('attachClosesAt', getI64Encoder()),
    ('layerCount', getU8Encoder()),
    ('bump', getU8Encoder()),
    (
      'namePrefix',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('symbol', fixEncoderSize(getBytesEncoder(), 10, allowTruncation: false)),
    ('baseUri', fixEncoderSize(getBytesEncoder(), 128, allowTruncation: false)),
  ]);

  return transformEncoder(
    structEncoder,
    (CreateExclusiveCollectionInstructionData value) => <String, Object?>{
      'discriminator': 53,
      'migrationVersion': 0,
      'collectionId': value.collectionId,
      'attachOpensAt': value.attachOpensAt,
      'attachClosesAt': value.attachClosesAt,
      'layerCount': value.layerCount,
      'bump': value.bump,
      'namePrefix': value.namePrefix,
      'symbol': value.symbol,
      'baseUri': value.baseUri,
    },
  );
}

Decoder<CreateExclusiveCollectionInstructionData>
getCreateExclusiveCollectionInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('collectionId', getU64Decoder()),
    ('attachOpensAt', getI64Decoder()),
    ('attachClosesAt', getI64Decoder()),
    ('layerCount', getU8Decoder()),
    ('bump', getU8Decoder()),
    ('namePrefix', fixDecoderSize(getBytesDecoder(), 32)),
    ('symbol', fixDecoderSize(getBytesDecoder(), 10)),
    ('baseUri', fixDecoderSize(getBytesDecoder(), 128)),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'createExclusiveCollection instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (CreateExclusiveCollectionInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(53)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      CreateExclusiveCollectionInstructionData(
        collectionId: map['collectionId']! as BigInt,
        attachOpensAt: map['attachOpensAt']! as BigInt,
        attachClosesAt: map['attachClosesAt']! as BigInt,
        layerCount: map['layerCount']! as int,
        bump: map['bump']! as int,
        namePrefix: map['namePrefix']! as Uint8List,
        symbol: map['symbol']! as Uint8List,
        baseUri: map['baseUri']! as Uint8List,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CreateExclusiveCollectionInstructionData>(
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
      VariableSizeDecoder<CreateExclusiveCollectionInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<
  CreateExclusiveCollectionInstructionData,
  CreateExclusiveCollectionInstructionData
>
getCreateExclusiveCollectionInstructionDataCodec() {
  return combineCodec(
    getCreateExclusiveCollectionInstructionDataEncoder(),
    getCreateExclusiveCollectionInstructionDataDecoder(),
  );
}

/// Creates a [CreateExclusiveCollection] instruction.
Instruction getCreateExclusiveCollectionInstruction({
  required Address programAddress,
  required Address admin,
  required Address exclusiveCollection,
  required Address coreCollection,
  required Address coreProgram,
  required Address systemProgram,
  required BigInt collectionId,
  required BigInt attachOpensAt,
  required BigInt attachClosesAt,
  required int layerCount,
  required int bump,
  required Uint8List namePrefix,
  required Uint8List symbol,
  required Uint8List baseUri,
}) {
  final instructionData = CreateExclusiveCollectionInstructionData(
    collectionId: collectionId,
    attachOpensAt: attachOpensAt,
    attachClosesAt: attachClosesAt,
    layerCount: layerCount,
    bump: bump,
    namePrefix: namePrefix,
    symbol: symbol,
    baseUri: baseUri,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: admin, role: AccountRole.writableSigner),
      AccountMeta(address: exclusiveCollection, role: AccountRole.writable),
      AccountMeta(address: coreCollection, role: AccountRole.writableSigner),
      AccountMeta(address: coreProgram, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getCreateExclusiveCollectionInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [CreateExclusiveCollection] instruction from raw instruction data.
CreateExclusiveCollectionInstructionData
parseCreateExclusiveCollectionInstruction(Instruction instruction) {
  return getCreateExclusiveCollectionInstructionDataDecoder().decode(
    instruction.data!,
  );
}
