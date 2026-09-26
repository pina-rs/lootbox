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
class CreateExclusiveSeriesInstructionData {
  const CreateExclusiveSeriesInstructionData({
    required this.assetIndex,
    required this.bump,
    required this.feeVaultBump,
    required this.contentsCount,
    required this.backgroundCount,
    required this.patternCount,
    required this.weights,
    required this.bonusLamports,
    required this.bonusCounts,
    required this.namePrefix,
    required this.symbol,
    required this.baseUri,
  }) : discriminator = 53,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int assetIndex;
  final int bump;
  final int feeVaultBump;
  final int contentsCount;
  final int backgroundCount;
  final int patternCount;
  final Uint8List weights;
  final Uint8List bonusLamports;
  final Uint8List bonusCounts;
  final Uint8List namePrefix;
  final Uint8List symbol;
  final Uint8List baseUri;
}

Encoder<CreateExclusiveSeriesInstructionData>
getCreateExclusiveSeriesInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
    ('bump', getU8Encoder()),
    ('feeVaultBump', getU8Encoder()),
    ('contentsCount', getU8Encoder()),
    ('backgroundCount', getU8Encoder()),
    ('patternCount', getU8Encoder()),
    ('weights', fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false)),
    (
      'bonusLamports',
      fixEncoderSize(getBytesEncoder(), 128, allowTruncation: false),
    ),
    (
      'bonusCounts',
      fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false),
    ),
    (
      'namePrefix',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('symbol', fixEncoderSize(getBytesEncoder(), 10, allowTruncation: false)),
    ('baseUri', fixEncoderSize(getBytesEncoder(), 96, allowTruncation: false)),
  ]);

  return transformEncoder(
    structEncoder,
    (CreateExclusiveSeriesInstructionData value) => <String, Object?>{
      'discriminator': 53,
      'migrationVersion': 0,
      'assetIndex': value.assetIndex,
      'bump': value.bump,
      'feeVaultBump': value.feeVaultBump,
      'contentsCount': value.contentsCount,
      'backgroundCount': value.backgroundCount,
      'patternCount': value.patternCount,
      'weights': value.weights,
      'bonusLamports': value.bonusLamports,
      'bonusCounts': value.bonusCounts,
      'namePrefix': value.namePrefix,
      'symbol': value.symbol,
      'baseUri': value.baseUri,
    },
  );
}

Decoder<CreateExclusiveSeriesInstructionData>
getCreateExclusiveSeriesInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
    ('bump', getU8Decoder()),
    ('feeVaultBump', getU8Decoder()),
    ('contentsCount', getU8Decoder()),
    ('backgroundCount', getU8Decoder()),
    ('patternCount', getU8Decoder()),
    ('weights', fixDecoderSize(getBytesDecoder(), 64)),
    ('bonusLamports', fixDecoderSize(getBytesDecoder(), 128)),
    ('bonusCounts', fixDecoderSize(getBytesDecoder(), 64)),
    ('namePrefix', fixDecoderSize(getBytesDecoder(), 32)),
    ('symbol', fixDecoderSize(getBytesDecoder(), 10)),
    ('baseUri', fixDecoderSize(getBytesDecoder(), 96)),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'createExclusiveSeries instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (CreateExclusiveSeriesInstructionData, int) readTopLevel(
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
      CreateExclusiveSeriesInstructionData(
        assetIndex: map['assetIndex']! as int,
        bump: map['bump']! as int,
        feeVaultBump: map['feeVaultBump']! as int,
        contentsCount: map['contentsCount']! as int,
        backgroundCount: map['backgroundCount']! as int,
        patternCount: map['patternCount']! as int,
        weights: map['weights']! as Uint8List,
        bonusLamports: map['bonusLamports']! as Uint8List,
        bonusCounts: map['bonusCounts']! as Uint8List,
        namePrefix: map['namePrefix']! as Uint8List,
        symbol: map['symbol']! as Uint8List,
        baseUri: map['baseUri']! as Uint8List,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<CreateExclusiveSeriesInstructionData>(
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
      VariableSizeDecoder<CreateExclusiveSeriesInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<
  CreateExclusiveSeriesInstructionData,
  CreateExclusiveSeriesInstructionData
>
getCreateExclusiveSeriesInstructionDataCodec() {
  return combineCodec(
    getCreateExclusiveSeriesInstructionDataEncoder(),
    getCreateExclusiveSeriesInstructionDataDecoder(),
  );
}

/// Creates a [CreateExclusiveSeries] instruction.
Instruction getCreateExclusiveSeriesInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address bundle,
  required Address exclusiveSeries,
  required Address feeVault,
  required Address systemProgram,
  required int assetIndex,
  required int bump,
  required int feeVaultBump,
  required int contentsCount,
  required int backgroundCount,
  required int patternCount,
  required Uint8List weights,
  required Uint8List bonusLamports,
  required Uint8List bonusCounts,
  required Uint8List namePrefix,
  required Uint8List symbol,
  required Uint8List baseUri,
}) {
  final instructionData = CreateExclusiveSeriesInstructionData(
    assetIndex: assetIndex,
    bump: bump,
    feeVaultBump: feeVaultBump,
    contentsCount: contentsCount,
    backgroundCount: backgroundCount,
    patternCount: patternCount,
    weights: weights,
    bonusLamports: bonusLamports,
    bonusCounts: bonusCounts,
    namePrefix: namePrefix,
    symbol: symbol,
    baseUri: baseUri,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: exclusiveSeries, role: AccountRole.writable),
      AccountMeta(address: feeVault, role: AccountRole.writable),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getCreateExclusiveSeriesInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [CreateExclusiveSeries] instruction from raw instruction data.
CreateExclusiveSeriesInstructionData parseCreateExclusiveSeriesInstruction(
  Instruction instruction,
) {
  return getCreateExclusiveSeriesInstructionDataDecoder().decode(
    instruction.data!,
  );
}
