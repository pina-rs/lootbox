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
class BundleState {
  const BundleState({
    required this.template,
    required this.quantity,
    required this.rentReserve,
    required this.mints,
    required this.amounts,
    required this.claimed,
    required this.kinds,
    required this.decimals,
    required this.index,
    required this.assetCount,
    required this.fundedAssets,
    required this.reclaimedMask,
    required this.bump,
  }) : discriminator = 5;

  final int discriminator;
  final Address template;
  final BigInt quantity;
  final BigInt rentReserve;
  final Uint8List mints;
  final Uint8List amounts;
  final Uint8List claimed;
  final Uint8List kinds;
  final Uint8List decimals;
  final int index;
  final int assetCount;
  final int fundedAssets;
  final int reclaimedMask;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BundleState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          template == other.template &&
          quantity == other.quantity &&
          rentReserve == other.rentReserve &&
          mints == other.mints &&
          amounts == other.amounts &&
          claimed == other.claimed &&
          kinds == other.kinds &&
          decimals == other.decimals &&
          index == other.index &&
          assetCount == other.assetCount &&
          fundedAssets == other.fundedAssets &&
          reclaimedMask == other.reclaimedMask &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(
    discriminator,
    template,
    quantity,
    rentReserve,
    mints,
    amounts,
    claimed,
    kinds,
    decimals,
    index,
    assetCount,
    fundedAssets,
    reclaimedMask,
    bump,
  );

  @override
  String toString() =>
      'BundleState(discriminator: $discriminator, template: $template, quantity: $quantity, rentReserve: $rentReserve, mints: $mints, amounts: $amounts, claimed: $claimed, kinds: $kinds, decimals: $decimals, index: $index, assetCount: $assetCount, fundedAssets: $fundedAssets, reclaimedMask: $reclaimedMask, bump: $bump)';
}

Encoder<BundleState> getBundleStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('template', getAddressEncoder()),
    ('quantity', getU64Encoder()),
    ('rentReserve', getU64Encoder()),
    ('mints', fixEncoderSize(getBytesEncoder(), 128, allowTruncation: false)),
    ('amounts', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('claimed', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('kinds', fixEncoderSize(getBytesEncoder(), 4, allowTruncation: false)),
    ('decimals', fixEncoderSize(getBytesEncoder(), 4, allowTruncation: false)),
    ('index', getU8Encoder()),
    ('assetCount', getU8Encoder()),
    ('fundedAssets', getU8Encoder()),
    ('reclaimedMask', getU8Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (BundleState value) => <String, Object?>{
      'discriminator': 5,
      'template': value.template,
      'quantity': value.quantity,
      'rentReserve': value.rentReserve,
      'mints': value.mints,
      'amounts': value.amounts,
      'claimed': value.claimed,
      'kinds': value.kinds,
      'decimals': value.decimals,
      'index': value.index,
      'assetCount': value.assetCount,
      'fundedAssets': value.fundedAssets,
      'reclaimedMask': value.reclaimedMask,
      'bump': value.bump,
    },
  );
}

Decoder<BundleState> getBundleStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('template', getAddressDecoder()),
    ('quantity', getU64Decoder()),
    ('rentReserve', getU64Decoder()),
    ('mints', fixDecoderSize(getBytesDecoder(), 128)),
    ('amounts', fixDecoderSize(getBytesDecoder(), 32)),
    ('claimed', fixDecoderSize(getBytesDecoder(), 32)),
    ('kinds', fixDecoderSize(getBytesDecoder(), 4)),
    ('decimals', fixDecoderSize(getBytesDecoder(), 4)),
    ('index', getU8Decoder()),
    ('assetCount', getU8Decoder()),
    ('fundedAssets', getU8Decoder()),
    ('reclaimedMask', getU8Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'bundleState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (BundleState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(5)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      BundleState(
        template: map['template']! as Address,
        quantity: map['quantity']! as BigInt,
        rentReserve: map['rentReserve']! as BigInt,
        mints: map['mints']! as Uint8List,
        amounts: map['amounts']! as Uint8List,
        claimed: map['claimed']! as Uint8List,
        kinds: map['kinds']! as Uint8List,
        decimals: map['decimals']! as Uint8List,
        index: map['index']! as int,
        assetCount: map['assetCount']! as int,
        fundedAssets: map['fundedAssets']! as int,
        reclaimedMask: map['reclaimedMask']! as int,
        bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() => FixedSizeDecoder<BundleState>(
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
      VariableSizeDecoder<BundleState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<BundleState, BundleState> getBundleStateCodec() {
  return combineCodec(getBundleStateEncoder(), getBundleStateDecoder());
}

Account<BundleState> decodeBundleState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getBundleStateDecoder());
}
