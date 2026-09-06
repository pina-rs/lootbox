import 'package:solana_kit_addresses/solana_kit_addresses.dart';

final BigInt _u64Max = (BigInt.one << 64) - BigInt.one;
final BigInt _ticketMax = BigInt.from(0xffffffff);
const int maxTemplateBundles = 1024;

enum PrizeKind {
  sol,
  quoteSol,
  classicToken,
  token2022,
  quoteToken,
  mintBadge,
  legacyNft,
  metadataNft,
  coreAsset,
  compressedNft,
}

/// A typed treasury asset. Ownership, extensions, plugins, and Merkle proofs
/// are validated by the corresponding on-chain transfer adapter.
final class PrizeAsset {
  const PrizeAsset.sol(BigInt lamports)
    : kind = PrizeKind.sol,
      identifier = null,
      amount = lamports;

  const PrizeAsset.quoteSol(BigInt lamports)
    : kind = PrizeKind.quoteSol,
      identifier = null,
      amount = lamports;

  const PrizeAsset.classicToken(Address mint, BigInt baseUnits)
    : kind = PrizeKind.classicToken,
      identifier = mint,
      amount = baseUnits;

  const PrizeAsset.token2022(Address mint, BigInt baseUnits)
    : kind = PrizeKind.token2022,
      identifier = mint,
      amount = baseUnits;

  const PrizeAsset.quoteToken(Address mint, BigInt baseUnits)
    : kind = PrizeKind.quoteToken,
      identifier = mint,
      amount = baseUnits;

  PrizeAsset.mintBadge(Address mint)
    : kind = PrizeKind.mintBadge,
      identifier = mint,
      amount = BigInt.one;

  PrizeAsset.legacyNft(Address mint)
    : kind = PrizeKind.legacyNft,
      identifier = mint,
      amount = BigInt.one;

  PrizeAsset.metadataNft(Address mint)
    : kind = PrizeKind.metadataNft,
      identifier = mint,
      amount = BigInt.one;

  PrizeAsset.core(Address asset)
    : kind = PrizeKind.coreAsset,
      identifier = asset,
      amount = BigInt.one;

  PrizeAsset.compressedNft(Address asset)
    : kind = PrizeKind.compressedNft,
      identifier = asset,
      amount = BigInt.one;

  final PrizeKind kind;
  final Address? identifier;
  final BigInt amount;

  bool get isUnique => switch (kind) {
    PrizeKind.sol ||
    PrizeKind.quoteSol ||
    PrizeKind.classicToken ||
    PrizeKind.token2022 ||
    PrizeKind.quoteToken => false,
    PrizeKind.mintBadge ||
    PrizeKind.legacyNft ||
    PrizeKind.metadataNft ||
    PrizeKind.coreAsset ||
    PrizeKind.compressedNft => true,
  };

  bool get requiresSingleCopy => isUnique && kind != PrizeKind.mintBadge;
}

/// All assets in a bundle are delivered together. Each copy is one ticket.
final class PrizeBundle {
  PrizeBundle({
    required this.label,
    required this.quantity,
    required List<PrizeAsset> assets,
  }) : assets = List.unmodifiable(assets);

  final String label;
  final BigInt quantity;
  final List<PrizeAsset> assets;
}

/// Finite, fully escrowed prize inventory; no statistical insolvency allowance.
final class TemplatePlan {
  factory TemplatePlan({
    required List<PrizeBundle> bundles,
    BigInt? settlementBountyLamports,
    bool resultReceiptsEnabled = false,
  }) {
    final bounty = _u64(
      settlementBountyLamports ?? BigInt.zero,
      'settlement bounty',
    );
    if (bundles.isEmpty || bundles.length > maxTemplateBundles) {
      throw RangeError(
        'a template needs between one and $maxTemplateBundles bundles',
      );
    }
    var totalBundles = BigInt.zero;
    final treasury = <Address?, BigInt>{};
    final uniqueAssets = <Address>{};

    for (final bundle in bundles) {
      _u64(bundle.quantity, 'bundle quantity');
      if (bundle.quantity == BigInt.zero ||
          bundle.assets.isEmpty ||
          bundle.assets.length > 4) {
        throw RangeError(
          'bundles need positive quantity and one to four assets',
        );
      }
      totalBundles = _u64(totalBundles + bundle.quantity, 'total bundles');
      if (totalBundles > _ticketMax) {
        throw RangeError('total bundle copies cannot exceed u32::MAX');
      }
      final seen = <Address?>{};
      for (final asset in bundle.assets) {
        _u64(asset.amount, 'prize amount');
        if (asset.amount == BigInt.zero ||
            !seen.add(asset.identifier) ||
            asset.identifier?.value == '11111111111111111111111111111111' ||
            asset.identifier?.value ==
                'So11111111111111111111111111111111111111112') {
          throw RangeError(
            'prize assets must be positive and distinct; use native SOL, not wrapped SOL',
          );
        }
        if (asset.isUnique &&
            (asset.requiresSingleCopy && bundle.quantity != BigInt.one ||
                !uniqueAssets.add(asset.identifier!))) {
          throw RangeError('each unique asset can fund only one bundle');
        }
        final deposit = _u64(
          asset.amount * bundle.quantity,
          'prize collateral',
        );
        treasury[asset.identifier] = _u64(
          (treasury[asset.identifier] ?? BigInt.zero) + deposit,
          'total asset collateral',
        );
      }
    }

    return TemplatePlan._(
      List.unmodifiable(bundles),
      totalBundles,
      Map.unmodifiable(treasury),
      bounty,
      resultReceiptsEnabled,
    );
  }

  const TemplatePlan._(
    this.bundles,
    this.totalBundles,
    this.treasury,
    this.settlementBountyLamports,
    this.resultReceiptsEnabled,
  );

  final List<PrizeBundle> bundles;
  final BigInt totalBundles;
  final BigInt settlementBountyLamports;
  final bool resultReceiptsEnabled;

  /// Exact zero-decimal box issuance after the treasury is market locked.
  BigInt get fixedSupply => totalBundles;

  /// Null selects native SOL; all other keys are stored asset identifiers.
  final Map<Address?, BigInt> treasury;

  /// Exact creator-funded service deposit collected when the treasury locks.
  ///
  /// [resultReceiptRent] is the cluster's current rent-exempt minimum for one
  /// immutable result receipt. Disabled receipts contribute no rent cost.
  BigInt requiredServiceBudget(BigInt resultReceiptRent) {
    _u64(resultReceiptRent, 'result receipt rent');
    final receiptBudget = resultReceiptsEnabled
        ? _u64(resultReceiptRent * totalBundles, 'result receipt budget')
        : BigInt.zero;
    final bountyBudget = _u64(
      settlementBountyLamports * totalBundles,
      'settlement bounty budget',
    );
    return _u64(receiptBudget + bountyBudget, 'service budget');
  }

  /// Exact initial numerator and denominator; depletion changes future odds.
  ({BigInt numerator, BigInt denominator}) odds(int index) =>
      (numerator: bundles[index].quantity, denominator: totalBundles);

  /// Rounded down, with the same precision as the TypeScript planner.
  double probabilityPercent(int index) =>
      ((odds(index).numerator * BigInt.from(1000000)) ~/ totalBundles).toInt() /
      10000;
}

BigInt _u64(BigInt value, String field) {
  if (value < BigInt.zero || value > _u64Max) {
    throw RangeError('$field must fit in an unsigned 64-bit integer');
  }

  return value;
}
