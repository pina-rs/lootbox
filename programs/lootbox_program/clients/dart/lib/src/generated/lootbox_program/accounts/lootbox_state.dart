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
class LootboxState {
  const LootboxState({
    required this.authority,
    required this.boxMint,
    required this.oracleProgram,
    required this.oracleQueue,
    required this.id,
    required this.maxSupply,
    required this.totalMinted,
    required this.pendingOpenings,
    required this.opened,
    required this.refunded,
    required this.totalWeight,
    required this.maxRewardLamports,
    required this.outcomeWeights,
    required this.outcomeLamports,
    required this.outcomeCount,
    required this.sealed,
    required this.bump,
    required this.vaultBump,
  }) : discriminator = 1;

  final int discriminator;
  final Address authority;
  final Address boxMint;
  final Address oracleProgram;
  final Address oracleQueue;
  final BigInt id;
  final BigInt maxSupply;
  final BigInt totalMinted;
  final BigInt pendingOpenings;
  final BigInt opened;
  final BigInt refunded;
  final BigInt totalWeight;
  final BigInt maxRewardLamports;
  final Uint8List outcomeWeights;
  final Uint8List outcomeLamports;
  final int outcomeCount;
  final bool sealed;
  final int bump;
  final int vaultBump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LootboxState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          authority == other.authority &&
          boxMint == other.boxMint &&
          oracleProgram == other.oracleProgram &&
          oracleQueue == other.oracleQueue &&
          id == other.id &&
          maxSupply == other.maxSupply &&
          totalMinted == other.totalMinted &&
          pendingOpenings == other.pendingOpenings &&
          opened == other.opened &&
          refunded == other.refunded &&
          totalWeight == other.totalWeight &&
          maxRewardLamports == other.maxRewardLamports &&
          outcomeWeights == other.outcomeWeights &&
          outcomeLamports == other.outcomeLamports &&
          outcomeCount == other.outcomeCount &&
          sealed == other.sealed &&
          bump == other.bump &&
          vaultBump == other.vaultBump;

  @override
  int get hashCode => Object.hash(
    discriminator,
    authority,
    boxMint,
    oracleProgram,
    oracleQueue,
    id,
    maxSupply,
    totalMinted,
    pendingOpenings,
    opened,
    refunded,
    totalWeight,
    maxRewardLamports,
    outcomeWeights,
    outcomeLamports,
    outcomeCount,
    sealed,
    bump,
    vaultBump,
  );

  @override
  String toString() =>
      'LootboxState(discriminator: $discriminator, authority: $authority, boxMint: $boxMint, oracleProgram: $oracleProgram, oracleQueue: $oracleQueue, id: $id, maxSupply: $maxSupply, totalMinted: $totalMinted, pendingOpenings: $pendingOpenings, opened: $opened, refunded: $refunded, totalWeight: $totalWeight, maxRewardLamports: $maxRewardLamports, outcomeWeights: $outcomeWeights, outcomeLamports: $outcomeLamports, outcomeCount: $outcomeCount, sealed: $sealed, bump: $bump, vaultBump: $vaultBump)';
}

Encoder<LootboxState> getLootboxStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('authority', getAddressEncoder()),
    ('boxMint', getAddressEncoder()),
    ('oracleProgram', getAddressEncoder()),
    ('oracleQueue', getAddressEncoder()),
    ('id', getU64Encoder()),
    ('maxSupply', getU64Encoder()),
    ('totalMinted', getU64Encoder()),
    ('pendingOpenings', getU64Encoder()),
    ('opened', getU64Encoder()),
    ('refunded', getU64Encoder()),
    ('totalWeight', getU64Encoder()),
    ('maxRewardLamports', getU64Encoder()),
    (
      'outcomeWeights',
      fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false),
    ),
    (
      'outcomeLamports',
      fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false),
    ),
    ('outcomeCount', getU8Encoder()),
    ('sealed', getBooleanEncoder()),
    ('bump', getU8Encoder()),
    ('vaultBump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (LootboxState value) => <String, Object?>{
      'discriminator': 1,
      'authority': value.authority,
      'boxMint': value.boxMint,
      'oracleProgram': value.oracleProgram,
      'oracleQueue': value.oracleQueue,
      'id': value.id,
      'maxSupply': value.maxSupply,
      'totalMinted': value.totalMinted,
      'pendingOpenings': value.pendingOpenings,
      'opened': value.opened,
      'refunded': value.refunded,
      'totalWeight': value.totalWeight,
      'maxRewardLamports': value.maxRewardLamports,
      'outcomeWeights': value.outcomeWeights,
      'outcomeLamports': value.outcomeLamports,
      'outcomeCount': value.outcomeCount,
      'sealed': value.sealed,
      'bump': value.bump,
      'vaultBump': value.vaultBump,
    },
  );
}

Decoder<LootboxState> getLootboxStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('authority', getAddressDecoder()),
    ('boxMint', getAddressDecoder()),
    ('oracleProgram', getAddressDecoder()),
    ('oracleQueue', getAddressDecoder()),
    ('id', getU64Decoder()),
    ('maxSupply', getU64Decoder()),
    ('totalMinted', getU64Decoder()),
    ('pendingOpenings', getU64Decoder()),
    ('opened', getU64Decoder()),
    ('refunded', getU64Decoder()),
    ('totalWeight', getU64Decoder()),
    ('maxRewardLamports', getU64Decoder()),
    ('outcomeWeights', fixDecoderSize(getBytesDecoder(), 64)),
    ('outcomeLamports', fixDecoderSize(getBytesDecoder(), 64)),
    ('outcomeCount', getU8Decoder()),
    ('sealed', getBooleanDecoder()),
    ('bump', getU8Decoder()),
    ('vaultBump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'lootboxState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (LootboxState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(1)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      LootboxState(
        authority: map['authority']! as Address,
        boxMint: map['boxMint']! as Address,
        oracleProgram: map['oracleProgram']! as Address,
        oracleQueue: map['oracleQueue']! as Address,
        id: map['id']! as BigInt,
        maxSupply: map['maxSupply']! as BigInt,
        totalMinted: map['totalMinted']! as BigInt,
        pendingOpenings: map['pendingOpenings']! as BigInt,
        opened: map['opened']! as BigInt,
        refunded: map['refunded']! as BigInt,
        totalWeight: map['totalWeight']! as BigInt,
        maxRewardLamports: map['maxRewardLamports']! as BigInt,
        outcomeWeights: map['outcomeWeights']! as Uint8List,
        outcomeLamports: map['outcomeLamports']! as Uint8List,
        outcomeCount: map['outcomeCount']! as int,
        sealed: map['sealed']! as bool,
        bump: map['bump']! as int,
        vaultBump: map['vaultBump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() => FixedSizeDecoder<LootboxState>(
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
      VariableSizeDecoder<LootboxState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<LootboxState, LootboxState> getLootboxStateCodec() {
  return combineCodec(getLootboxStateEncoder(), getLootboxStateDecoder());
}

Account<LootboxState> decodeLootboxState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getLootboxStateDecoder());
}
