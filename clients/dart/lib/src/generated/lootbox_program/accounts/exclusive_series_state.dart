// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'dart:typed_data';

import 'package:meta/meta.dart';
import 'package:solana_kit_accounts/solana_kit_accounts.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_core/solana_kit_codecs_core.dart';
import 'package:solana_kit_codecs_data_structures/solana_kit_codecs_data_structures.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';
import 'package:solana_kit_errors/solana_kit_errors.dart';

@immutable
class ExclusiveSeriesState {
  const ExclusiveSeriesState({
    required this.authority,
    required this.template,
    required this.bundle,
    required this.collection,
    required this.merkleTree,
    required this.quantity,
    required this.minted,
    required this.rentReserve,
    required this.mintFeeLamports,
    required this.weights,
    required this.bonusLamports,
    required this.bonusCounts,
    required this.bonusRemaining,
    required this.tierMinted,
    required this.namePrefix,
    required this.symbol,
    required this.baseUri,
    required this.maxBufferSize,
    required this.assetIndex,
    required this.contentsCount,
    required this.backgroundCount,
    required this.patternCount,
    required this.maxDepth,
    required this.status,
    required this.bump,
    required this.feeVaultBump,
  }) : discriminator = 10,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final Address authority;
  final Address template;
  final Address bundle;
  final Address collection;
  final Address merkleTree;
  final BigInt quantity;
  final BigInt minted;
  final BigInt rentReserve;
  final BigInt mintFeeLamports;
  final Uint8List weights;
  final Uint8List bonusLamports;
  final Uint8List bonusCounts;
  final Uint8List bonusRemaining;
  final Uint8List tierMinted;
  final Uint8List namePrefix;
  final Uint8List symbol;
  final Uint8List baseUri;
  final int maxBufferSize;
  final int assetIndex;
  final int contentsCount;
  final int backgroundCount;
  final int patternCount;
  final int maxDepth;
  final int status;
  final int bump;
  final int feeVaultBump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ExclusiveSeriesState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          migrationVersion == other.migrationVersion &&
          authority == other.authority &&
          template == other.template &&
          bundle == other.bundle &&
          collection == other.collection &&
          merkleTree == other.merkleTree &&
          quantity == other.quantity &&
          minted == other.minted &&
          rentReserve == other.rentReserve &&
          mintFeeLamports == other.mintFeeLamports &&
          weights == other.weights &&
          bonusLamports == other.bonusLamports &&
          bonusCounts == other.bonusCounts &&
          bonusRemaining == other.bonusRemaining &&
          tierMinted == other.tierMinted &&
          namePrefix == other.namePrefix &&
          symbol == other.symbol &&
          baseUri == other.baseUri &&
          maxBufferSize == other.maxBufferSize &&
          assetIndex == other.assetIndex &&
          contentsCount == other.contentsCount &&
          backgroundCount == other.backgroundCount &&
          patternCount == other.patternCount &&
          maxDepth == other.maxDepth &&
          status == other.status &&
          bump == other.bump &&
          feeVaultBump == other.feeVaultBump;

  @override
  int get hashCode => Object.hashAll([
    discriminator,
    migrationVersion,
    authority,
    template,
    bundle,
    collection,
    merkleTree,
    quantity,
    minted,
    rentReserve,
    mintFeeLamports,
    weights,
    bonusLamports,
    bonusCounts,
    bonusRemaining,
    tierMinted,
    namePrefix,
    symbol,
    baseUri,
    maxBufferSize,
    assetIndex,
    contentsCount,
    backgroundCount,
    patternCount,
    maxDepth,
    status,
    bump,
    feeVaultBump,
  ]);

  @override
  String toString() =>
      'ExclusiveSeriesState(discriminator: $discriminator, migrationVersion: $migrationVersion, authority: $authority, template: $template, bundle: $bundle, collection: $collection, merkleTree: $merkleTree, quantity: $quantity, minted: $minted, rentReserve: $rentReserve, mintFeeLamports: $mintFeeLamports, weights: $weights, bonusLamports: $bonusLamports, bonusCounts: $bonusCounts, bonusRemaining: $bonusRemaining, tierMinted: $tierMinted, namePrefix: $namePrefix, symbol: $symbol, baseUri: $baseUri, maxBufferSize: $maxBufferSize, assetIndex: $assetIndex, contentsCount: $contentsCount, backgroundCount: $backgroundCount, patternCount: $patternCount, maxDepth: $maxDepth, status: $status, bump: $bump, feeVaultBump: $feeVaultBump)';
}

Encoder<ExclusiveSeriesState> getExclusiveSeriesStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('authority', getAddressEncoder()),
    ('template', getAddressEncoder()),
    ('bundle', getAddressEncoder()),
    ('collection', getAddressEncoder()),
    ('merkleTree', getAddressEncoder()),
    ('quantity', getU64Encoder()),
    ('minted', getU64Encoder()),
    ('rentReserve', getU64Encoder()),
    ('mintFeeLamports', getU64Encoder()),
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
      'bonusRemaining',
      fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false),
    ),
    (
      'tierMinted',
      fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false),
    ),
    (
      'namePrefix',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('symbol', fixEncoderSize(getBytesEncoder(), 10, allowTruncation: false)),
    ('baseUri', fixEncoderSize(getBytesEncoder(), 96, allowTruncation: false)),
    ('maxBufferSize', getU32Encoder()),
    ('assetIndex', getU8Encoder()),
    ('contentsCount', getU8Encoder()),
    ('backgroundCount', getU8Encoder()),
    ('patternCount', getU8Encoder()),
    ('maxDepth', getU8Encoder()),
    ('status', getU8Encoder()),
    ('bump', getU8Encoder()),
    ('feeVaultBump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ExclusiveSeriesState value) => <String, Object?>{
      'discriminator': 10,
      'migrationVersion': 0,
      'authority': value.authority,
      'template': value.template,
      'bundle': value.bundle,
      'collection': value.collection,
      'merkleTree': value.merkleTree,
      'quantity': value.quantity,
      'minted': value.minted,
      'rentReserve': value.rentReserve,
      'mintFeeLamports': value.mintFeeLamports,
      'weights': value.weights,
      'bonusLamports': value.bonusLamports,
      'bonusCounts': value.bonusCounts,
      'bonusRemaining': value.bonusRemaining,
      'tierMinted': value.tierMinted,
      'namePrefix': value.namePrefix,
      'symbol': value.symbol,
      'baseUri': value.baseUri,
      'maxBufferSize': value.maxBufferSize,
      'assetIndex': value.assetIndex,
      'contentsCount': value.contentsCount,
      'backgroundCount': value.backgroundCount,
      'patternCount': value.patternCount,
      'maxDepth': value.maxDepth,
      'status': value.status,
      'bump': value.bump,
      'feeVaultBump': value.feeVaultBump,
    },
  );
}

Decoder<ExclusiveSeriesState> getExclusiveSeriesStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('authority', getAddressDecoder()),
    ('template', getAddressDecoder()),
    ('bundle', getAddressDecoder()),
    ('collection', getAddressDecoder()),
    ('merkleTree', getAddressDecoder()),
    ('quantity', getU64Decoder()),
    ('minted', getU64Decoder()),
    ('rentReserve', getU64Decoder()),
    ('mintFeeLamports', getU64Decoder()),
    ('weights', fixDecoderSize(getBytesDecoder(), 64)),
    ('bonusLamports', fixDecoderSize(getBytesDecoder(), 128)),
    ('bonusCounts', fixDecoderSize(getBytesDecoder(), 64)),
    ('bonusRemaining', fixDecoderSize(getBytesDecoder(), 64)),
    ('tierMinted', fixDecoderSize(getBytesDecoder(), 64)),
    ('namePrefix', fixDecoderSize(getBytesDecoder(), 32)),
    ('symbol', fixDecoderSize(getBytesDecoder(), 10)),
    ('baseUri', fixDecoderSize(getBytesDecoder(), 96)),
    ('maxBufferSize', getU32Decoder()),
    ('assetIndex', getU8Decoder()),
    ('contentsCount', getU8Decoder()),
    ('backgroundCount', getU8Decoder()),
    ('patternCount', getU8Decoder()),
    ('maxDepth', getU8Decoder()),
    ('status', getU8Decoder()),
    ('bump', getU8Decoder()),
    ('feeVaultBump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'exclusiveSeriesState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ExclusiveSeriesState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(10)).read(bytes, offset + 0);
    final (storedMigrationVersion, _) = getU8Decoder().read(bytes, offset + 1);
    if (storedMigrationVersion != 0) {
      throw StateError(
        storedMigrationVersion < 0
            ? 'migration version mismatch: expected 0, received $storedMigrationVersion (the data predates this client; migrate it by sending a transaction to the program, or decode it with a client generated from an older IDL)'
            : 'migration version mismatch: expected 0, received $storedMigrationVersion (the data was written by a newer program; upgrade this client)',
      );
    }
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      ExclusiveSeriesState(
        authority: map['authority']! as Address,
        template: map['template']! as Address,
        bundle: map['bundle']! as Address,
        collection: map['collection']! as Address,
        merkleTree: map['merkleTree']! as Address,
        quantity: map['quantity']! as BigInt,
        minted: map['minted']! as BigInt,
        rentReserve: map['rentReserve']! as BigInt,
        mintFeeLamports: map['mintFeeLamports']! as BigInt,
        weights: map['weights']! as Uint8List,
        bonusLamports: map['bonusLamports']! as Uint8List,
        bonusCounts: map['bonusCounts']! as Uint8List,
        bonusRemaining: map['bonusRemaining']! as Uint8List,
        tierMinted: map['tierMinted']! as Uint8List,
        namePrefix: map['namePrefix']! as Uint8List,
        symbol: map['symbol']! as Uint8List,
        baseUri: map['baseUri']! as Uint8List,
        maxBufferSize: map['maxBufferSize']! as int,
        assetIndex: map['assetIndex']! as int,
        contentsCount: map['contentsCount']! as int,
        backgroundCount: map['backgroundCount']! as int,
        patternCount: map['patternCount']! as int,
        maxDepth: map['maxDepth']! as int,
        status: map['status']! as int,
        bump: map['bump']! as int,
        feeVaultBump: map['feeVaultBump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ExclusiveSeriesState>(
        fixedSize: structDecoder.fixedSize,
        read: (bytes, offset) {
          final bytesLength = bytes.length - offset;
          if (bytesLength < structDecoder.fixedSize) {
            throwInvalidByteLength(structDecoder.fixedSize, bytesLength);
          }
          return readTopLevel(bytes, offset);
        },
      ),
    VariableSizeDecoder<Map<String, Object?>>() =>
      VariableSizeDecoder<ExclusiveSeriesState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ExclusiveSeriesState, ExclusiveSeriesState>
getExclusiveSeriesStateCodec() {
  return combineCodec(
    getExclusiveSeriesStateEncoder(),
    getExclusiveSeriesStateDecoder(),
  );
}

Account<ExclusiveSeriesState> decodeExclusiveSeriesState(
  EncodedAccount encodedAccount,
) {
  return decodeAccount(encodedAccount, getExclusiveSeriesStateDecoder());
}

/// The account schema version this client was generated from.
const int exclusiveSeriesStateMigrationVersion = 0;

/// Cheap envelope check for fetched `ExclusiveSeriesState` bytes: returns true only when
/// the bytes carry this account's discriminator and a migration version older
/// than this client's schema — exactly the accounts [getMigrateInstruction]
/// can bring current. Decoding reports every other mismatch.
bool exclusiveSeriesStateNeedsMigration(List<int> data) {
  if (data.length < 2) {
    return false;
  }
  if (data[0] != 10) {
    return false;
  }
  return data[1] < 0;
}
