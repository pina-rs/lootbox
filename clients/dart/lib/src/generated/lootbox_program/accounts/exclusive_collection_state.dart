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
class ExclusiveCollectionState {
  const ExclusiveCollectionState({
    required this.admin,
    required this.coreCollection,
    required this.activeTree,
    required this.layersHash,
    required this.collectionId,
    required this.minted,
    required this.attachOpensAt,
    required this.attachClosesAt,
    required this.treeCount,
    required this.traitCounts,
    required this.weights,
    required this.namePrefix,
    required this.symbol,
    required this.baseUri,
    required this.layerCount,
    required this.status,
    required this.bump,
  }) : discriminator = 10,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final Address admin;
  final Address coreCollection;
  final Address activeTree;
  final Uint8List layersHash;
  final BigInt collectionId;
  final BigInt minted;
  final BigInt attachOpensAt;
  final BigInt attachClosesAt;
  final int treeCount;
  final Uint8List traitCounts;
  final Uint8List weights;
  final Uint8List namePrefix;
  final Uint8List symbol;
  final Uint8List baseUri;
  final int layerCount;
  final int status;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ExclusiveCollectionState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          migrationVersion == other.migrationVersion &&
          admin == other.admin &&
          coreCollection == other.coreCollection &&
          activeTree == other.activeTree &&
          layersHash == other.layersHash &&
          collectionId == other.collectionId &&
          minted == other.minted &&
          attachOpensAt == other.attachOpensAt &&
          attachClosesAt == other.attachClosesAt &&
          treeCount == other.treeCount &&
          traitCounts == other.traitCounts &&
          weights == other.weights &&
          namePrefix == other.namePrefix &&
          symbol == other.symbol &&
          baseUri == other.baseUri &&
          layerCount == other.layerCount &&
          status == other.status &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(
    discriminator,
    migrationVersion,
    admin,
    coreCollection,
    activeTree,
    layersHash,
    collectionId,
    minted,
    attachOpensAt,
    attachClosesAt,
    treeCount,
    traitCounts,
    weights,
    namePrefix,
    symbol,
    baseUri,
    layerCount,
    status,
    bump,
  );

  @override
  String toString() =>
      'ExclusiveCollectionState(discriminator: $discriminator, migrationVersion: $migrationVersion, admin: $admin, coreCollection: $coreCollection, activeTree: $activeTree, layersHash: $layersHash, collectionId: $collectionId, minted: $minted, attachOpensAt: $attachOpensAt, attachClosesAt: $attachClosesAt, treeCount: $treeCount, traitCounts: $traitCounts, weights: $weights, namePrefix: $namePrefix, symbol: $symbol, baseUri: $baseUri, layerCount: $layerCount, status: $status, bump: $bump)';
}

Encoder<ExclusiveCollectionState> getExclusiveCollectionStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('admin', getAddressEncoder()),
    ('coreCollection', getAddressEncoder()),
    ('activeTree', getAddressEncoder()),
    (
      'layersHash',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('collectionId', getU64Encoder()),
    ('minted', getU64Encoder()),
    ('attachOpensAt', getI64Encoder()),
    ('attachClosesAt', getI64Encoder()),
    ('treeCount', getU32Encoder()),
    (
      'traitCounts',
      fixEncoderSize(getBytesEncoder(), 12, allowTruncation: false),
    ),
    (
      'weights',
      fixEncoderSize(getBytesEncoder(), 3072, allowTruncation: false),
    ),
    (
      'namePrefix',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('symbol', fixEncoderSize(getBytesEncoder(), 10, allowTruncation: false)),
    ('baseUri', fixEncoderSize(getBytesEncoder(), 128, allowTruncation: false)),
    ('layerCount', getU8Encoder()),
    ('status', getU8Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ExclusiveCollectionState value) => <String, Object?>{
      'discriminator': 10,
      'migrationVersion': 0,
      'admin': value.admin,
      'coreCollection': value.coreCollection,
      'activeTree': value.activeTree,
      'layersHash': value.layersHash,
      'collectionId': value.collectionId,
      'minted': value.minted,
      'attachOpensAt': value.attachOpensAt,
      'attachClosesAt': value.attachClosesAt,
      'treeCount': value.treeCount,
      'traitCounts': value.traitCounts,
      'weights': value.weights,
      'namePrefix': value.namePrefix,
      'symbol': value.symbol,
      'baseUri': value.baseUri,
      'layerCount': value.layerCount,
      'status': value.status,
      'bump': value.bump,
    },
  );
}

Decoder<ExclusiveCollectionState> getExclusiveCollectionStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('admin', getAddressDecoder()),
    ('coreCollection', getAddressDecoder()),
    ('activeTree', getAddressDecoder()),
    ('layersHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('collectionId', getU64Decoder()),
    ('minted', getU64Decoder()),
    ('attachOpensAt', getI64Decoder()),
    ('attachClosesAt', getI64Decoder()),
    ('treeCount', getU32Decoder()),
    ('traitCounts', fixDecoderSize(getBytesDecoder(), 12)),
    ('weights', fixDecoderSize(getBytesDecoder(), 3072)),
    ('namePrefix', fixDecoderSize(getBytesDecoder(), 32)),
    ('symbol', fixDecoderSize(getBytesDecoder(), 10)),
    ('baseUri', fixDecoderSize(getBytesDecoder(), 128)),
    ('layerCount', getU8Decoder()),
    ('status', getU8Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'exclusiveCollectionState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ExclusiveCollectionState, int) readTopLevel(Uint8List bytes, int offset) {
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
      ExclusiveCollectionState(
        admin: map['admin']! as Address,
        coreCollection: map['coreCollection']! as Address,
        activeTree: map['activeTree']! as Address,
        layersHash: map['layersHash']! as Uint8List,
        collectionId: map['collectionId']! as BigInt,
        minted: map['minted']! as BigInt,
        attachOpensAt: map['attachOpensAt']! as BigInt,
        attachClosesAt: map['attachClosesAt']! as BigInt,
        treeCount: map['treeCount']! as int,
        traitCounts: map['traitCounts']! as Uint8List,
        weights: map['weights']! as Uint8List,
        namePrefix: map['namePrefix']! as Uint8List,
        symbol: map['symbol']! as Uint8List,
        baseUri: map['baseUri']! as Uint8List,
        layerCount: map['layerCount']! as int,
        status: map['status']! as int,
        bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ExclusiveCollectionState>(
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
      VariableSizeDecoder<ExclusiveCollectionState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ExclusiveCollectionState, ExclusiveCollectionState>
getExclusiveCollectionStateCodec() {
  return combineCodec(
    getExclusiveCollectionStateEncoder(),
    getExclusiveCollectionStateDecoder(),
  );
}

Account<ExclusiveCollectionState> decodeExclusiveCollectionState(
  EncodedAccount encodedAccount,
) {
  return decodeAccount(encodedAccount, getExclusiveCollectionStateDecoder());
}

/// The account schema version this client was generated from.
const int exclusiveCollectionStateMigrationVersion = 0;

/// Cheap envelope check for fetched `ExclusiveCollectionState` bytes: returns true only when
/// the bytes carry this account's discriminator and a migration version older
/// than this client's schema — exactly the accounts [getMigrateInstruction]
/// can bring current. Decoding reports every other mismatch.
bool exclusiveCollectionStateNeedsMigration(List<int> data) {
  if (data.length < 2) {
    return false;
  }
  if (data[0] != 10) {
    return false;
  }
  return data[1] < 0;
}
