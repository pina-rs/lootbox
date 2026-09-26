import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';

/// Largest number of stacked trait layers in one collection.
const int maxExclusiveLayers = 12;

/// Largest number of traits in one layer.
const int maxExclusiveTraits = 64;

/// Bubblegum caps names at 32 bytes; minted names are `{prefix} #{serial}`.
const int maxExclusiveNameBytes = 32;

/// Lamports Bubblegum `mint_v2` charges per mint, escrowed per attachment.
final BigInt bubblegumMintV2FeeLamports = BigInt.from(90000);

final BigInt _maxTotalWeight = BigInt.from(0xffffffff);
final BigInt _two64 = BigInt.one << 64;
final List<int> _seedDomain = utf8.encode('lootbox:exclusive-nft');
final List<int> _layerLabel = utf8.encode('layer');
const int _rounds = 8;

/// Invalid layer table or derivation input.
final class ExclusiveNftException implements Exception {
  const ExclusiveNftException(this.message);

  final String message;

  @override
  String toString() => 'ExclusiveNftException: $message';
}

List<int> _sha256(List<List<int>> parts) =>
    sha256.convert([for (final part in parts) ...part]).bytes;

BigInt _u64LittleEndian(List<int> bytes) {
  var value = BigInt.zero;
  for (var index = 7; index >= 0; index--) {
    value = (value << 8) | BigInt.from(bytes[index]);
  }

  return value;
}

/// Seed `S = sha256("lootbox:exclusive-nft" || template || opening || R)`,
/// where `R` is the opening's verified Switchboard value.
Uint8List exclusiveNftSeed(
  Address template,
  Address opening,
  List<int> entropy,
) {
  if (entropy.length != 32) {
    throw const ExclusiveNftException('opening entropy must be 32 bytes');
  }

  final encoder = getAddressEncoder();

  return Uint8List.fromList(
    _sha256([
      _seedDomain,
      encoder.encode(template),
      encoder.encode(opening),
      entropy,
    ]),
  );
}

/// Validate layer tables exactly as `SetExclusiveLayer` and publication do.
void validateExclusiveLayers(List<List<int>> layers) {
  if (layers.isEmpty || layers.length > maxExclusiveLayers) {
    throw const ExclusiveNftException('a collection needs 1 to 12 layers');
  }

  for (final layer in layers) {
    final total = layer.fold(
      BigInt.zero,
      (sum, weight) => sum + BigInt.from(weight),
    );

    if (layer.isEmpty ||
        layer.length > maxExclusiveTraits ||
        layer.any((weight) => weight < 0 || weight > 0xffffffff) ||
        total == BigInt.zero ||
        total > _maxTotalWeight) {
      throw const ExclusiveNftException(
        'layers need 1 to 64 u32 weights with a nonzero total no greater than u32::MAX',
      );
    }
  }
}

/// Unbiased draw in `0..bound` from `sha256(S || "layer" || layer [|| round])`.
BigInt _layerDraw(List<int> seed, int layer, BigInt bound) {
  final threshold = (_two64 - bound) % bound;

  for (var round = 0; round < _rounds; round++) {
    final digest = _sha256([
      seed,
      _layerLabel,
      [layer],
      if (round != 0) [round],
    ]);
    final candidate = _u64LittleEndian(digest);

    if (candidate >= threshold) {
      return candidate % bound;
    }
  }

  throw const ExclusiveNftException(
    'entropy rejection exhausted after 8 rounds',
  );
}

/// Pick one trait per layer from `S`, exactly as `ClaimExclusiveNft` does.
List<int> exclusiveTraits(List<int> seed, List<List<int>> layers) {
  if (seed.length != 32) {
    throw const ExclusiveNftException('the seed must be 32 bytes');
  }

  validateExclusiveLayers(layers);
  final traits = <int>[];

  for (var layer = 0; layer < layers.length; layer++) {
    final weights = layers[layer];
    final total = weights.fold(
      BigInt.zero,
      (sum, weight) => sum + BigInt.from(weight),
    );
    final target = _layerDraw(seed, layer, total);
    var cumulative = BigInt.zero;

    for (var slot = 0; slot < weights.length; slot++) {
      cumulative += BigInt.from(weights[slot]);
      if (target < cumulative) {
        traits.add(slot);
        break;
      }
    }
  }

  return List.unmodifiable(traits);
}

/// Recompute the traits an opening's claim mints from on-chain data alone.
({Uint8List seed, List<int> traits}) deriveExclusiveTraits(
  Address template,
  Address opening,
  List<int> entropy,
  List<List<int>> layers,
) {
  final seed = exclusiveNftSeed(template, opening, entropy);

  return (seed: seed, traits: exclusiveTraits(seed, layers));
}

/// On-chain leaf name `{namePrefix} #{serial}`.
String exclusiveName(String namePrefix, BigInt serial) {
  final name = '$namePrefix #$serial';

  if (utf8.encode(name).length > maxExclusiveNameBytes) {
    throw const ExclusiveNftException(
      "the name exceeds Bubblegum's 32-byte cap",
    );
  }

  return name;
}

/// On-chain leaf URI `{baseUri}{lowercase hex, one byte per layer}-{serial}.json`.
String exclusiveUri(String baseUri, List<int> traits, BigInt serial) {
  final hex = traits
      .map((value) => value.toRadixString(16).padLeft(2, '0'))
      .join();

  return '$baseUri$hex-$serial.json';
}

/// Bubblegum fees an attachment escrows for [quantity] mints.
BigInt exclusiveMintFeeEscrow(BigInt quantity) =>
    quantity * bubblegumMintV2FeeLamports;
