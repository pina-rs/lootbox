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
    required this.lockedAt,
    required this.totalBundles,
    required this.totalMinted,
    required this.remainingBundles,
    required this.pendingOpenings,
    required this.nextRequest,
    required this.nextAllocation,
    required this.version,
    required this.remaining,
    required this.name,
    required this.uri,
    required this.bundleCount,
    required this.status,
    required this.bump,
  }) : discriminator = 4;

  final int discriminator;
  final Address authority;
  final Address boxMint;
  final Address oracleProgram;
  final Address oracleQueue;
  final BigInt id;
  final BigInt opensAt;
  final BigInt lockedAt;
  final BigInt totalBundles;
  final BigInt totalMinted;
  final BigInt remainingBundles;
  final BigInt pendingOpenings;
  final BigInt nextRequest;
  final BigInt nextAllocation;
  final BigInt version;
  final Uint8List remaining;
  final Uint8List name;
  final Uint8List uri;
  final int bundleCount;
  final int status;
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
          lockedAt == other.lockedAt &&
          totalBundles == other.totalBundles &&
          totalMinted == other.totalMinted &&
          remainingBundles == other.remainingBundles &&
          pendingOpenings == other.pendingOpenings &&
          nextRequest == other.nextRequest &&
          nextAllocation == other.nextAllocation &&
          version == other.version &&
          remaining == other.remaining &&
          name == other.name &&
          uri == other.uri &&
          bundleCount == other.bundleCount &&
          status == other.status &&
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
    lockedAt,
    totalBundles,
    totalMinted,
    remainingBundles,
    pendingOpenings,
    nextRequest,
    nextAllocation,
    version,
    remaining,
    name,
    uri,
    bundleCount,
    status,
    bump,
  ]);

  @override
  String toString() =>
      'TemplateState(discriminator: $discriminator, authority: $authority, boxMint: $boxMint, oracleProgram: $oracleProgram, oracleQueue: $oracleQueue, id: $id, opensAt: $opensAt, lockedAt: $lockedAt, totalBundles: $totalBundles, totalMinted: $totalMinted, remainingBundles: $remainingBundles, pendingOpenings: $pendingOpenings, nextRequest: $nextRequest, nextAllocation: $nextAllocation, version: $version, remaining: $remaining, name: $name, uri: $uri, bundleCount: $bundleCount, status: $status, bump: $bump)';
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
    ('lockedAt', getI64Encoder()),
    ('totalBundles', getU64Encoder()),
    ('totalMinted', getU64Encoder()),
    ('remainingBundles', getU64Encoder()),
    ('pendingOpenings', getU64Encoder()),
    ('nextRequest', getU64Encoder()),
    ('nextAllocation', getU64Encoder()),
    ('version', getU64Encoder()),
    (
      'remaining',
      fixEncoderSize(getBytesEncoder(), 2048, allowTruncation: false),
    ),
    ('name', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('uri', fixEncoderSize(getBytesEncoder(), 200, allowTruncation: false)),
    ('bundleCount', getU32Encoder()),
    ('status', getU8Encoder()),
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
      'lockedAt': value.lockedAt,
      'totalBundles': value.totalBundles,
      'totalMinted': value.totalMinted,
      'remainingBundles': value.remainingBundles,
      'pendingOpenings': value.pendingOpenings,
      'nextRequest': value.nextRequest,
      'nextAllocation': value.nextAllocation,
      'version': value.version,
      'remaining': value.remaining,
      'name': value.name,
      'uri': value.uri,
      'bundleCount': value.bundleCount,
      'status': value.status,
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
    ('lockedAt', getI64Decoder()),
    ('totalBundles', getU64Decoder()),
    ('totalMinted', getU64Decoder()),
    ('remainingBundles', getU64Decoder()),
    ('pendingOpenings', getU64Decoder()),
    ('nextRequest', getU64Decoder()),
    ('nextAllocation', getU64Decoder()),
    ('version', getU64Decoder()),
    ('remaining', fixDecoderSize(getBytesDecoder(), 2048)),
    ('name', fixDecoderSize(getBytesDecoder(), 32)),
    ('uri', fixDecoderSize(getBytesDecoder(), 200)),
    ('bundleCount', getU32Decoder()),
    ('status', getU8Decoder()),
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
        lockedAt: map['lockedAt']! as BigInt,
        totalBundles: map['totalBundles']! as BigInt,
        totalMinted: map['totalMinted']! as BigInt,
        remainingBundles: map['remainingBundles']! as BigInt,
        pendingOpenings: map['pendingOpenings']! as BigInt,
        nextRequest: map['nextRequest']! as BigInt,
        nextAllocation: map['nextAllocation']! as BigInt,
        version: map['version']! as BigInt,
        remaining: map['remaining']! as Uint8List,
        name: map['name']! as Uint8List,
        uri: map['uri']! as Uint8List,
        bundleCount: map['bundleCount']! as int,
        status: map['status']! as int,
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
