import 'package:solana_kit_addresses/solana_kit_addresses.dart';

final BigInt _u64Max = (BigInt.one << 64) - BigInt.one;
final BigInt _ticketMax = BigInt.from(0xffffffff);
const int maxTemplateBundles = 1024;
const int maxPrizePoolItems = 4096;
const int maxPrizePoolMetadataBytes = 512;
const int maxPrizePoolProofNodes = 16;

bool _isByteList(List<int> bytes) =>
    bytes.every((value) => value >= 0 && value <= 255);

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
  prizePool,
  exclusiveNft,
}

/// Stable reasons why a treasury plan was rejected before transaction build.
enum TemplatePlanErrorCode {
  invalidBundleCount,
  invalidBundle,
  invalidAsset,
  duplicateUniqueAsset,
  ticketLimitExceeded,
  outOfRange,
}

/// Invalid treasury configuration rejected before transaction construction.
final class TemplatePlanException implements Exception {
  const TemplatePlanException(this.code, this.message);

  final TemplatePlanErrorCode code;
  final String message;

  @override
  String toString() => 'TemplatePlanException(${code.name}): $message';
}

/// One compressed NFT leaf deposited into a prize pool, with the metadata
/// preimage and Merkle proof needed to admit and deposit it on chain.
final class PrizePoolItem {
  PrizePoolItem({
    required this.asset,
    required this.metadataMutable,
    required List<int> metadata,
    required this.tree,
    required this.treeConfig,
    required List<int> root,
    required List<int> dataHash,
    required List<int> creatorHash,
    required this.nonce,
    required this.leafIndex,
    required List<Address> proof,
  }) : metadata = List.unmodifiable(metadata),
       root = List.unmodifiable(root),
       dataHash = List.unmodifiable(dataHash),
       creatorHash = List.unmodifiable(creatorHash),
       proof = List.unmodifiable(proof);

  final Address asset;
  final bool metadataMutable;
  final List<int> metadata;
  final Address tree;
  final Address treeConfig;
  final List<int> root;
  final List<int> dataHash;
  final List<int> creatorHash;
  final BigInt nonce;
  final int leafIndex;
  final List<Address> proof;
}

final class PrizeAsset {
  const PrizeAsset.sol(BigInt lamports)
    : kind = PrizeKind.sol,
      identifier = null,
      amount = lamports,
      poolItems = const [];

  const PrizeAsset.quoteSol(BigInt lamports)
    : kind = PrizeKind.quoteSol,
      identifier = null,
      amount = lamports,
      poolItems = const [];

  const PrizeAsset.classicToken(Address mint, BigInt baseUnits)
    : kind = PrizeKind.classicToken,
      identifier = mint,
      amount = baseUnits,
      poolItems = const [];

  const PrizeAsset.token2022(Address mint, BigInt baseUnits)
    : kind = PrizeKind.token2022,
      identifier = mint,
      amount = baseUnits,
      poolItems = const [];

  const PrizeAsset.quoteToken(Address mint, BigInt baseUnits)
    : kind = PrizeKind.quoteToken,
      identifier = mint,
      amount = baseUnits,
      poolItems = const [];

  PrizeAsset.mintBadge(Address mint)
    : kind = PrizeKind.mintBadge,
      identifier = mint,
      amount = BigInt.one,
      poolItems = const [];

  PrizeAsset.legacyNft(Address mint)
    : kind = PrizeKind.legacyNft,
      identifier = mint,
      amount = BigInt.one,
      poolItems = const [];

  PrizeAsset.metadataNft(Address mint)
    : kind = PrizeKind.metadataNft,
      identifier = mint,
      amount = BigInt.one,
      poolItems = const [];

  PrizeAsset.core(Address asset)
    : kind = PrizeKind.coreAsset,
      identifier = asset,
      amount = BigInt.one,
      poolItems = const [];

  PrizeAsset.compressedNft(Address asset)
    : kind = PrizeKind.compressedNft,
      identifier = asset,
      amount = BigInt.one,
      poolItems = const [];

  PrizeAsset.prizePool(Address tree, List<PrizePoolItem> items)
    : kind = PrizeKind.prizePool,
      identifier = tree,
      amount = BigInt.one,
      poolItems = List.unmodifiable(items);

  /// One Exclusive Lootbox NFT minted on claim from a published collection;
  /// many bundles may attach to one collection.
  PrizeAsset.exclusiveNft(Address collection)
    : kind = PrizeKind.exclusiveNft,
      identifier = collection,
      amount = BigInt.one,
      poolItems = const [];

  final PrizeKind kind;
  final Address? identifier;
  final BigInt amount;
  final List<PrizePoolItem> poolItems;

  int get itemCount => poolItems.length;

  bool get isUnique => switch (kind) {
    PrizeKind.sol ||
    PrizeKind.quoteSol ||
    PrizeKind.classicToken ||
    PrizeKind.token2022 ||
    PrizeKind.quoteToken => false,
    PrizeKind.prizePool || PrizeKind.exclusiveNft => false,
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
      throw TemplatePlanException(
        TemplatePlanErrorCode.invalidBundleCount,
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
        throw const TemplatePlanException(
          TemplatePlanErrorCode.invalidBundle,
          'bundles need positive quantity and one to four assets',
        );
      }
      totalBundles = _u64(totalBundles + bundle.quantity, 'total bundles');
      if (totalBundles > _ticketMax) {
        throw const TemplatePlanException(
          TemplatePlanErrorCode.ticketLimitExceeded,
          'total bundle copies cannot exceed u32::MAX',
        );
      }
      final seen = <Address?>{};
      var prizePoolCount = 0;
      for (final asset in bundle.assets) {
        if (asset.kind == PrizeKind.prizePool) {
          prizePoolCount++;
          if (prizePoolCount > 1 ||
              asset.itemCount < 1 ||
              asset.itemCount > maxPrizePoolItems ||
              BigInt.from(asset.itemCount) != bundle.quantity) {
            throw const TemplatePlanException(
              TemplatePlanErrorCode.invalidAsset,
              'a bundle supports one prize pool with exactly one item per ticket',
            );
          }
          for (final item in asset.poolItems) {
            if (item.metadataMutable ||
                item.asset.value == '11111111111111111111111111111111' ||
                item.metadata.isEmpty ||
                item.metadata.length > maxPrizePoolMetadataBytes ||
                !_isByteList(item.metadata) ||
                item.tree != asset.identifier ||
                item.treeConfig.value == '11111111111111111111111111111111' ||
                item.root.length != 32 ||
                !_isByteList(item.root) ||
                item.dataHash.length != 32 ||
                !_isByteList(item.dataHash) ||
                item.creatorHash.length != 32 ||
                !_isByteList(item.creatorHash) ||
                item.nonce < BigInt.zero ||
                item.nonce > _u64Max ||
                item.leafIndex < 0 ||
                item.leafIndex > 0xffffffff ||
                item.proof.length > maxPrizePoolProofNodes ||
                !uniqueAssets.add(item.asset)) {
              throw const TemplatePlanException(
                TemplatePlanErrorCode.invalidAsset,
                'prize-pool items need distinct immutable V1 metadata and complete same-tree proofs',
              );
            }
          }
        }
        _u64(asset.amount, 'prize amount');
        if (asset.amount == BigInt.zero ||
            !seen.add(asset.identifier) ||
            asset.identifier?.value == '11111111111111111111111111111111' ||
            asset.identifier?.value ==
                'So11111111111111111111111111111111111111112') {
          throw const TemplatePlanException(
            TemplatePlanErrorCode.invalidAsset,
            'prize assets must be positive and distinct; use native SOL, not wrapped SOL',
          );
        }
        if (asset.isUnique &&
            (asset.requiresSingleCopy && bundle.quantity != BigInt.one ||
                !uniqueAssets.add(asset.identifier!))) {
          throw const TemplatePlanException(
            TemplatePlanErrorCode.duplicateUniqueAsset,
            'each unique asset can fund only one bundle',
          );
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
  /// immutable result receipt. [serviceVaultRent] is charged once whenever the
  /// plan has a nonzero service reserve. Disabled services contribute no rent.
  BigInt requiredServiceBudget(
    BigInt resultReceiptRent,
    BigInt serviceVaultRent,
  ) {
    _u64(resultReceiptRent, 'result receipt rent');
    _u64(serviceVaultRent, 'service vault rent');
    final receiptBudget = resultReceiptsEnabled
        ? _u64(resultReceiptRent * totalBundles, 'result receipt budget')
        : BigInt.zero;
    final bountyBudget = _u64(
      settlementBountyLamports * totalBundles,
      'settlement bounty budget',
    );
    final reserve = _u64(receiptBudget + bountyBudget, 'service reserve');

    return reserve == BigInt.zero
        ? BigInt.zero
        : _u64(reserve + serviceVaultRent, 'service budget');
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
    throw TemplatePlanException(
      TemplatePlanErrorCode.outOfRange,
      '$field must fit in an unsigned 64-bit integer',
    );
  }

  return value;
}
