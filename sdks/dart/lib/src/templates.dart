import 'package:solana_kit_addresses/solana_kit_addresses.dart';

final BigInt _u64Max = (BigInt.one << 64) - BigInt.one;
final BigInt _weightMax = BigInt.from(0xffffffff);

enum PrizeKind { sol, token, nft }

/// An exact base-unit payout. Mint authorities and NFT uniqueness must also be
/// checked on chain; this planning model cannot verify external accounts.
final class PrizeAsset {
  const PrizeAsset.sol(BigInt lamports)
    : kind = PrizeKind.sol,
      mint = null,
      amount = lamports;

  const PrizeAsset.token(Address tokenMint, BigInt baseUnits)
    : kind = PrizeKind.token,
      mint = tokenMint,
      amount = baseUnits;

  PrizeAsset.nft(Address tokenMint)
    : kind = PrizeKind.nft,
      mint = tokenMint,
      amount = BigInt.one;

  final PrizeKind kind;
  final Address? mint;
  final BigInt amount;
}

/// All assets in this outcome are delivered together as one discrete win.
final class PrizeBundle {
  PrizeBundle({
    required this.label,
    required this.quantity,
    required this.weight,
    required List<PrizeAsset> assets,
  }) : assets = List.unmodifiable(assets);

  final String label;
  final BigInt quantity;
  final BigInt weight;
  final List<PrizeAsset> assets;
}

/// Finite, fully escrowed prize inventory; no statistical insolvency allowance.
final class TemplatePlan {
  factory TemplatePlan({
    required List<PrizeBundle> bundles,
    BigInt? maxSupply,
  }) {
    if (bundles.isEmpty || bundles.length > 8) {
      throw RangeError('a template needs between one and eight bundles');
    }
    var totalBundles = BigInt.zero;
    var totalWeight = BigInt.zero;
    final treasury = <Address?, BigInt>{};
    final nftMints = <Address>{};

    for (final bundle in bundles) {
      _u64(bundle.quantity, 'bundle quantity');
      _u64(bundle.weight, 'bundle weight');
      if (bundle.quantity == BigInt.zero ||
          bundle.weight == BigInt.zero ||
          bundle.assets.isEmpty ||
          bundle.assets.length > 4) {
        throw RangeError(
          'bundles need positive quantity and weight, and one to four assets',
        );
      }
      totalBundles = _u64(totalBundles + bundle.quantity, 'total bundles');
      totalWeight = _u64(
        totalWeight + bundle.weight * bundle.quantity,
        'total inventory weight',
      );
      final seen = <Address?>{};
      for (final asset in bundle.assets) {
        _u64(asset.amount, 'prize amount');
        if (asset.amount == BigInt.zero ||
            !seen.add(asset.mint) ||
            asset.mint?.value == '11111111111111111111111111111111' ||
            asset.mint?.value ==
                'So11111111111111111111111111111111111111112') {
          throw RangeError(
            'prize assets must be positive and distinct; use native SOL, not wrapped SOL',
          );
        }
        if (asset.kind == PrizeKind.nft &&
            (bundle.quantity != BigInt.one || !nftMints.add(asset.mint!))) {
          throw RangeError('each unique NFT can fund only one bundle');
        }
        final deposit = _u64(
          asset.amount * bundle.quantity,
          'prize collateral',
        );
        treasury[asset.mint] = _u64(
          (treasury[asset.mint] ?? BigInt.zero) + deposit,
          'total asset collateral',
        );
      }
    }
    if (totalWeight > _weightMax) {
      throw RangeError('total inventory weight exceeds u32::MAX');
    }
    final supply = _u64(maxSupply ?? totalBundles, 'maxSupply');
    if (supply == BigInt.zero || supply > totalBundles) {
      throw RangeError(
        'maxSupply must be between one and the funded bundle count',
      );
    }

    return TemplatePlan._(
      List.unmodifiable(bundles),
      supply,
      totalBundles,
      totalWeight,
      Map.unmodifiable(treasury),
    );
  }

  const TemplatePlan._(
    this.bundles,
    this.maxSupply,
    this.totalBundles,
    this.totalWeight,
    this.treasury,
  );

  final List<PrizeBundle> bundles;
  final BigInt maxSupply;
  final BigInt totalBundles;
  final BigInt totalWeight;

  /// Null selects native SOL; all other keys are mint addresses.
  final Map<Address?, BigInt> treasury;

  /// Exact initial numerator and denominator; depletion changes future odds.
  ({BigInt numerator, BigInt denominator}) odds(int index) => (
    numerator: bundles[index].weight * bundles[index].quantity,
    denominator: totalWeight,
  );

  /// Rounded down, with the same precision as the TypeScript planner.
  double probabilityPercent(int index) =>
      ((odds(index).numerator * BigInt.from(1000000)) ~/ totalWeight).toInt() /
      10000;
}

BigInt _u64(BigInt value, String field) {
  if (value < BigInt.zero || value > _u64Max) {
    throw RangeError('$field must fit in an unsigned 64-bit integer');
  }

  return value;
}
