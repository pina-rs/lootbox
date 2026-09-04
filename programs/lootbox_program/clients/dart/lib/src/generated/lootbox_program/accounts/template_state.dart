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
class TemplateState {
  const TemplateState({
    required this.authority,
    required this.boxMint,
    required this.oracleProgram,
    required this.oracleQueue,
    required this.id,
    required this.opensAt,
    required this.maxSupply,
    required this.totalMinted,
    required this.remainingBundles,
    required this.pendingOpenings,
    required this.nextRequest,
    required this.nextAllocation,
    required this.weights,
    required this.remaining,
    required this.name,
    required this.uri,
    required this.outcomeCount,
    required this.fundedOutcomes,
    required this.sealed,
    required this.retired,
    required this.bump,
  }) : discriminator = 4;

  final int discriminator;
  final Address authority;
  final Address boxMint;
  final Address oracleProgram;
  final Address oracleQueue;
  final BigInt id;
  final BigInt opensAt;
  final BigInt maxSupply;
  final BigInt totalMinted;
  final BigInt remainingBundles;
  final BigInt pendingOpenings;
  final BigInt nextRequest;
  final BigInt nextAllocation;
  final Uint8List weights;
  final Uint8List remaining;
  final Uint8List name;
  final Uint8List uri;
  final int outcomeCount;
  final int fundedOutcomes;
  final bool sealed;
  final bool retired;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TemplateState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          authority == other.authority &&
          boxMint == other.boxMint &&
          oracleProgram == other.oracleProgram &&
          oracleQueue == other.oracleQueue &&
          id == other.id &&
          opensAt == other.opensAt &&
          maxSupply == other.maxSupply &&
          totalMinted == other.totalMinted &&
          remainingBundles == other.remainingBundles &&
          pendingOpenings == other.pendingOpenings &&
          nextRequest == other.nextRequest &&
          nextAllocation == other.nextAllocation &&
          weights == other.weights &&
          remaining == other.remaining &&
          name == other.name &&
          uri == other.uri &&
          outcomeCount == other.outcomeCount &&
          fundedOutcomes == other.fundedOutcomes &&
          sealed == other.sealed &&
          retired == other.retired &&
          bump == other.bump;

  @override
  int get hashCode => Object.hashAll([
    discriminator,
    authority,
    boxMint,
    oracleProgram,
    oracleQueue,
    id,
    opensAt,
    maxSupply,
    totalMinted,
    remainingBundles,
    pendingOpenings,
    nextRequest,
    nextAllocation,
    weights,
    remaining,
    name,
    uri,
    outcomeCount,
    fundedOutcomes,
    sealed,
    retired,
    bump,
  ]);

  @override
  String toString() =>
      'TemplateState(discriminator: $discriminator, authority: $authority, boxMint: $boxMint, oracleProgram: $oracleProgram, oracleQueue: $oracleQueue, id: $id, opensAt: $opensAt, maxSupply: $maxSupply, totalMinted: $totalMinted, remainingBundles: $remainingBundles, pendingOpenings: $pendingOpenings, nextRequest: $nextRequest, nextAllocation: $nextAllocation, weights: $weights, remaining: $remaining, name: $name, uri: $uri, outcomeCount: $outcomeCount, fundedOutcomes: $fundedOutcomes, sealed: $sealed, retired: $retired, bump: $bump)';
}

Encoder<TemplateState> getTemplateStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('authority', getAddressEncoder()),
    ('boxMint', getAddressEncoder()),
    ('oracleProgram', getAddressEncoder()),
    ('oracleQueue', getAddressEncoder()),
    ('id', getU64Encoder()),
    ('opensAt', getI64Encoder()),
    ('maxSupply', getU64Encoder()),
    ('totalMinted', getU64Encoder()),
    ('remainingBundles', getU64Encoder()),
    ('pendingOpenings', getU64Encoder()),
    ('nextRequest', getU64Encoder()),
    ('nextAllocation', getU64Encoder()),
    ('weights', fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false)),
    (
      'remaining',
      fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false),
    ),
    ('name', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('uri', fixEncoderSize(getBytesEncoder(), 200, allowTruncation: false)),
    ('outcomeCount', getU8Encoder()),
    ('fundedOutcomes', getU8Encoder()),
    ('sealed', getBooleanEncoder()),
    ('retired', getBooleanEncoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (TemplateState value) => <String, Object?>{
      'discriminator': 4,
      'authority': value.authority,
      'boxMint': value.boxMint,
      'oracleProgram': value.oracleProgram,
      'oracleQueue': value.oracleQueue,
      'id': value.id,
      'opensAt': value.opensAt,
      'maxSupply': value.maxSupply,
      'totalMinted': value.totalMinted,
      'remainingBundles': value.remainingBundles,
      'pendingOpenings': value.pendingOpenings,
      'nextRequest': value.nextRequest,
      'nextAllocation': value.nextAllocation,
      'weights': value.weights,
      'remaining': value.remaining,
      'name': value.name,
      'uri': value.uri,
      'outcomeCount': value.outcomeCount,
      'fundedOutcomes': value.fundedOutcomes,
      'sealed': value.sealed,
      'retired': value.retired,
      'bump': value.bump,
    },
  );
}

Decoder<TemplateState> getTemplateStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('authority', getAddressDecoder()),
    ('boxMint', getAddressDecoder()),
    ('oracleProgram', getAddressDecoder()),
    ('oracleQueue', getAddressDecoder()),
    ('id', getU64Decoder()),
    ('opensAt', getI64Decoder()),
    ('maxSupply', getU64Decoder()),
    ('totalMinted', getU64Decoder()),
    ('remainingBundles', getU64Decoder()),
    ('pendingOpenings', getU64Decoder()),
    ('nextRequest', getU64Decoder()),
    ('nextAllocation', getU64Decoder()),
    ('weights', fixDecoderSize(getBytesDecoder(), 64)),
    ('remaining', fixDecoderSize(getBytesDecoder(), 64)),
    ('name', fixDecoderSize(getBytesDecoder(), 32)),
    ('uri', fixDecoderSize(getBytesDecoder(), 200)),
    ('outcomeCount', getU8Decoder()),
    ('fundedOutcomes', getU8Decoder()),
    ('sealed', getBooleanDecoder()),
    ('retired', getBooleanDecoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'templateState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (TemplateState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(4)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      TemplateState(
        authority: map['authority']! as Address,
        boxMint: map['boxMint']! as Address,
        oracleProgram: map['oracleProgram']! as Address,
        oracleQueue: map['oracleQueue']! as Address,
        id: map['id']! as BigInt,
        opensAt: map['opensAt']! as BigInt,
        maxSupply: map['maxSupply']! as BigInt,
        totalMinted: map['totalMinted']! as BigInt,
        remainingBundles: map['remainingBundles']! as BigInt,
        pendingOpenings: map['pendingOpenings']! as BigInt,
        nextRequest: map['nextRequest']! as BigInt,
        nextAllocation: map['nextAllocation']! as BigInt,
        weights: map['weights']! as Uint8List,
        remaining: map['remaining']! as Uint8List,
        name: map['name']! as Uint8List,
        uri: map['uri']! as Uint8List,
        outcomeCount: map['outcomeCount']! as int,
        fundedOutcomes: map['fundedOutcomes']! as int,
        sealed: map['sealed']! as bool,
        retired: map['retired']! as bool,
        bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() => FixedSizeDecoder<TemplateState>(
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
      VariableSizeDecoder<TemplateState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<TemplateState, TemplateState> getTemplateStateCodec() {
  return combineCodec(getTemplateStateEncoder(), getTemplateStateDecoder());
}

Account<TemplateState> decodeTemplateState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getTemplateStateDecoder());
}
