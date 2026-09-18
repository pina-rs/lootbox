// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import '../pina_pod_codecs.dart';

import 'dart:typed_data';

import 'package:meta/meta.dart';
import 'package:solana_kit_accounts/solana_kit_accounts.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_core/solana_kit_codecs_core.dart';
import 'package:solana_kit_codecs_data_structures/solana_kit_codecs_data_structures.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';
import 'package:solana_kit_errors/solana_kit_errors.dart';

@immutable
class PrizePoolState {
  const PrizePoolState({
    required this.authority,
    required this.bundle,
    required this.tree,
    required this.manifestAccumulator,
    required this.quantity,
    required this.version,
    required this.depositCursor,
    required this.assignedCount,
    required this.claimedCount,
    required this.reclaimedCount,
    required this.assetIndex,
    required this.status,
    required this.hasPreparedItem,
    required this.bump,
    required this.unavailable,
  }) : discriminator = 8,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final Address authority;
  final Address bundle;
  final Address tree;
  final Uint8List manifestAccumulator;
  final BigInt quantity;
  final BigInt version;
  final int depositCursor;
  final int assignedCount;
  final int claimedCount;
  final int reclaimedCount;
  final int assetIndex;
  final int status;
  final bool hasPreparedItem;
  final int bump;
  final List<int> unavailable;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PrizePoolState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          migrationVersion == other.migrationVersion &&
          authority == other.authority &&
          bundle == other.bundle &&
          tree == other.tree &&
          manifestAccumulator == other.manifestAccumulator &&
          quantity == other.quantity &&
          version == other.version &&
          depositCursor == other.depositCursor &&
          assignedCount == other.assignedCount &&
          claimedCount == other.claimedCount &&
          reclaimedCount == other.reclaimedCount &&
          assetIndex == other.assetIndex &&
          status == other.status &&
          hasPreparedItem == other.hasPreparedItem &&
          bump == other.bump &&
          unavailable == other.unavailable;

  @override
  int get hashCode => Object.hash(
    discriminator,
    migrationVersion,
    authority,
    bundle,
    tree,
    manifestAccumulator,
    quantity,
    version,
    depositCursor,
    assignedCount,
    claimedCount,
    reclaimedCount,
    assetIndex,
    status,
    hasPreparedItem,
    bump,
    unavailable,
  );

  @override
  String toString() =>
      'PrizePoolState(discriminator: $discriminator, migrationVersion: $migrationVersion, authority: $authority, bundle: $bundle, tree: $tree, manifestAccumulator: $manifestAccumulator, quantity: $quantity, version: $version, depositCursor: $depositCursor, assignedCount: $assignedCount, claimedCount: $claimedCount, reclaimedCount: $reclaimedCount, assetIndex: $assetIndex, status: $status, hasPreparedItem: $hasPreparedItem, bump: $bump, unavailable: $unavailable)';
}

Encoder<PrizePoolState> getPrizePoolStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('authority', getAddressEncoder()),
    ('bundle', getAddressEncoder()),
    ('tree', getAddressEncoder()),
    (
      'manifestAccumulator',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('quantity', getU64Encoder()),
    ('version', getU64Encoder()),
    ('depositCursor', getU32Encoder()),
    ('assignedCount', getU32Encoder()),
    ('claimedCount', getU32Encoder()),
    ('reclaimedCount', getU32Encoder()),
    ('assetIndex', getU8Encoder()),
    ('status', getU8Encoder()),
    ('hasPreparedItem', getBooleanEncoder()),
    ('bump', getU8Encoder()),
    (
      'unavailable',
      getArrayEncoder<int>(
        transformEncoder(getU8Encoder(), (int value) => value),
        size: PrefixedArraySize(getU16Encoder()),
      ),
    ),
  ]);

  return transformEncoder(
    structEncoder,
    (PrizePoolState value) => <String, Object?>{
      'discriminator': 8,
      'migrationVersion': 0,
      'authority': value.authority,
      'bundle': value.bundle,
      'tree': value.tree,
      'manifestAccumulator': value.manifestAccumulator,
      'quantity': value.quantity,
      'version': value.version,
      'depositCursor': value.depositCursor,
      'assignedCount': value.assignedCount,
      'claimedCount': value.claimedCount,
      'reclaimedCount': value.reclaimedCount,
      'assetIndex': value.assetIndex,
      'status': value.status,
      'hasPreparedItem': value.hasPreparedItem,
      'bump': value.bump,
      'unavailable': value.unavailable,
    },
  );
}

Decoder<PrizePoolState> getPrizePoolStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('authority', getAddressDecoder()),
    ('bundle', getAddressDecoder()),
    ('tree', getAddressDecoder()),
    ('manifestAccumulator', fixDecoderSize(getBytesDecoder(), 32)),
    ('quantity', getU64Decoder()),
    ('version', getU64Decoder()),
    ('depositCursor', getU32Decoder()),
    ('assignedCount', getU32Decoder()),
    ('claimedCount', getU32Decoder()),
    ('reclaimedCount', getU32Decoder()),
    ('assetIndex', getU8Decoder()),
    ('status', getU8Decoder()),
    ('hasPreparedItem', getBooleanDecoder()),
    ('bump', getU8Decoder()),
    (
      'unavailable',
      getPinaPodBoundedArrayDecoder(
        getArrayDecoder(
          getU8Decoder(),
          size: PrefixedArraySize(getU16Decoder()),
        ),
        getPinaPodBoundedCountDecoder(getU16Decoder(), 512),
        512,
      ),
    ),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'prizePoolState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (PrizePoolState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(8)).read(bytes, offset + 0);
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
      PrizePoolState(
        authority: map['authority']! as Address,
        bundle: map['bundle']! as Address,
        tree: map['tree']! as Address,
        manifestAccumulator: map['manifestAccumulator']! as Uint8List,
        quantity: map['quantity']! as BigInt,
        version: map['version']! as BigInt,
        depositCursor: map['depositCursor']! as int,
        assignedCount: map['assignedCount']! as int,
        claimedCount: map['claimedCount']! as int,
        reclaimedCount: map['reclaimedCount']! as int,
        assetIndex: map['assetIndex']! as int,
        status: map['status']! as int,
        hasPreparedItem: map['hasPreparedItem']! as bool,
        bump: map['bump']! as int,
        unavailable: map['unavailable']! as List<int>,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<PrizePoolState>(
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
      VariableSizeDecoder<PrizePoolState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<PrizePoolState, PrizePoolState> getPrizePoolStateCodec() {
  return combineCodec(getPrizePoolStateEncoder(), getPrizePoolStateDecoder());
}

Account<PrizePoolState> decodePrizePoolState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getPrizePoolStateDecoder());
}

/// The account schema version this client was generated from.
const int prizePoolStateMigrationVersion = 0;

/// Cheap envelope check for fetched `PrizePoolState` bytes: returns true only when
/// the bytes carry this account's discriminator and a migration version older
/// than this client's schema — exactly the accounts [getMigrateInstruction]
/// can bring current. Decoding reports every other mismatch.
bool prizePoolStateNeedsMigration(List<int> data) {
  if (data.length < 2) {
    return false;
  }
  if (data[0] != 8) {
    return false;
  }
  return data[1] < 0;
}
