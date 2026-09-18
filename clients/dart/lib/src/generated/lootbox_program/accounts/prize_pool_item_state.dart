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
class PrizePoolItemState {
  const PrizePoolItemState({
    required this.pool,
    required this.asset,
    required this.dataHash,
    required this.creatorHash,
    required this.semanticMetadataHash,
    required this.previousManifestAccumulator,
    required this.nonce,
    required this.treeIndex,
    required this.poolIndex,
    required this.status,
    required this.bump,
  }) : discriminator = 9,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final Address pool;
  final Address asset;
  final Uint8List dataHash;
  final Uint8List creatorHash;
  final Uint8List semanticMetadataHash;
  final Uint8List previousManifestAccumulator;
  final BigInt nonce;
  final int treeIndex;
  final int poolIndex;
  final int status;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PrizePoolItemState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          migrationVersion == other.migrationVersion &&
          pool == other.pool &&
          asset == other.asset &&
          dataHash == other.dataHash &&
          creatorHash == other.creatorHash &&
          semanticMetadataHash == other.semanticMetadataHash &&
          previousManifestAccumulator == other.previousManifestAccumulator &&
          nonce == other.nonce &&
          treeIndex == other.treeIndex &&
          poolIndex == other.poolIndex &&
          status == other.status &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(
    discriminator,
    migrationVersion,
    pool,
    asset,
    dataHash,
    creatorHash,
    semanticMetadataHash,
    previousManifestAccumulator,
    nonce,
    treeIndex,
    poolIndex,
    status,
    bump,
  );

  @override
  String toString() =>
      'PrizePoolItemState(discriminator: $discriminator, migrationVersion: $migrationVersion, pool: $pool, asset: $asset, dataHash: $dataHash, creatorHash: $creatorHash, semanticMetadataHash: $semanticMetadataHash, previousManifestAccumulator: $previousManifestAccumulator, nonce: $nonce, treeIndex: $treeIndex, poolIndex: $poolIndex, status: $status, bump: $bump)';
}

Encoder<PrizePoolItemState> getPrizePoolItemStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('pool', getAddressEncoder()),
    ('asset', getAddressEncoder()),
    ('dataHash', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    (
      'creatorHash',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    (
      'semanticMetadataHash',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    (
      'previousManifestAccumulator',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('nonce', getU64Encoder()),
    ('treeIndex', getU32Encoder()),
    ('poolIndex', getU32Encoder()),
    ('status', getU8Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (PrizePoolItemState value) => <String, Object?>{
      'discriminator': 9,
      'migrationVersion': 0,
      'pool': value.pool,
      'asset': value.asset,
      'dataHash': value.dataHash,
      'creatorHash': value.creatorHash,
      'semanticMetadataHash': value.semanticMetadataHash,
      'previousManifestAccumulator': value.previousManifestAccumulator,
      'nonce': value.nonce,
      'treeIndex': value.treeIndex,
      'poolIndex': value.poolIndex,
      'status': value.status,
      'bump': value.bump,
    },
  );
}

Decoder<PrizePoolItemState> getPrizePoolItemStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('pool', getAddressDecoder()),
    ('asset', getAddressDecoder()),
    ('dataHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('creatorHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('semanticMetadataHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('previousManifestAccumulator', fixDecoderSize(getBytesDecoder(), 32)),
    ('nonce', getU64Decoder()),
    ('treeIndex', getU32Decoder()),
    ('poolIndex', getU32Decoder()),
    ('status', getU8Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'prizePoolItemState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (PrizePoolItemState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(9)).read(bytes, offset + 0);
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
      PrizePoolItemState(
        pool: map['pool']! as Address,
        asset: map['asset']! as Address,
        dataHash: map['dataHash']! as Uint8List,
        creatorHash: map['creatorHash']! as Uint8List,
        semanticMetadataHash: map['semanticMetadataHash']! as Uint8List,
        previousManifestAccumulator:
            map['previousManifestAccumulator']! as Uint8List,
        nonce: map['nonce']! as BigInt,
        treeIndex: map['treeIndex']! as int,
        poolIndex: map['poolIndex']! as int,
        status: map['status']! as int,
        bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<PrizePoolItemState>(
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
      VariableSizeDecoder<PrizePoolItemState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<PrizePoolItemState, PrizePoolItemState> getPrizePoolItemStateCodec() {
  return combineCodec(
    getPrizePoolItemStateEncoder(),
    getPrizePoolItemStateDecoder(),
  );
}

Account<PrizePoolItemState> decodePrizePoolItemState(
  EncodedAccount encodedAccount,
) {
  return decodeAccount(encodedAccount, getPrizePoolItemStateDecoder());
}

/// The account schema version this client was generated from.
const int prizePoolItemStateMigrationVersion = 0;

/// Cheap envelope check for fetched `PrizePoolItemState` bytes: returns true only when
/// the bytes carry this account's discriminator and a migration version older
/// than this client's schema — exactly the accounts [getMigrateInstruction]
/// can bring current. Decoding reports every other mismatch.
bool prizePoolItemStateNeedsMigration(List<int> data) {
  if (data.length < 2) {
    return false;
  }
  if (data[0] != 9) {
    return false;
  }
  return data[1] < 0;
}
