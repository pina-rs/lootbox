import 'dart:convert';
import 'dart:io';

import 'package:lootbox/lootbox.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:test/test.dart';

void main() {
  const nft = Address('Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op');
  const tree = Address('7RmhTYBS7Uv9PSNmJGX6tM8BjSn7HVbGdVgV6EtCNKLm');
  const poolAssets = [
    Address('Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op'),
    Address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    Address('DezXAZ8z7PnrnRJjz3wXBoRgixCa6XKj7D3WpqkDmzPK'),
  ];
  final serviceBudgetVector =
      jsonDecode(
            File('../../tests/vectors/service-budget.json').readAsStringSync(),
          )
          as Map<String, dynamic>;
  final prizePoolVector =
      jsonDecode(File('../../tests/vectors/prize-pool.json').readAsStringSync())
          as Map<String, dynamic>;
  PrizePoolItem poolItem(
    Address asset, {
    bool metadataMutable = false,
    List<int> metadata = const [1],
    List<Address>? proof,
  }) => PrizePoolItem(
    asset: asset,
    metadataMutable: metadataMutable,
    metadata: metadata,
    tree: tree,
    treeConfig: nft,
    root: List.filled(32, 1),
    dataHash: List.filled(32, 2),
    creatorHash: List.filled(32, 3),
    nonce: BigInt.zero,
    leafIndex: 0,
    proof: proof ?? [nft],
  );
  group('finite templates', () {
    test('computes full collateral and exact initial odds', () {
      final plan = TemplatePlan(
        bundles: [
          PrizeBundle(
            label: 'SOL',
            quantity: BigInt.from(99),
            assets: [PrizeAsset.sol(BigInt.from(100000000))],
          ),
          PrizeBundle(
            label: 'Jackpot',
            quantity: BigInt.one,
            assets: [
              PrizeAsset.metadataNft(nft),
              PrizeAsset.sol(BigInt.from(1000000000)),
            ],
          ),
        ],
      );
      expect(plan.totalBundles, BigInt.from(100));
      expect(plan.fixedSupply, plan.totalBundles);
      expect(plan.probabilityPercent(1), 1);
      expect(plan.treasury[null], BigInt.from(10900000000));
      expect(plan.treasury[nft], BigInt.one);
    });

    test('rejects duplicated NFT inventory', () {
      expect(
        () => TemplatePlan(
          bundles: [
            PrizeBundle(
              label: 'NFT',
              quantity: BigInt.two,
              assets: [PrizeAsset.compressedNft(nft)],
            ),
          ],
        ),
        throwsA(
          isA<TemplatePlanException>().having(
            (error) => error.code,
            'code',
            TemplatePlanErrorCode.duplicateUniqueAsset,
          ),
        ),
      );
    });

    test('rejects collateral overflow', () {
      expect(
        () => TemplatePlan(
          bundles: [
            PrizeBundle(
              label: 'SOL',
              quantity: BigInt.two,
              assets: [PrizeAsset.sol((BigInt.one << 64) - BigInt.one)],
            ),
          ],
        ),
        throwsA(isA<TemplatePlanException>()),
      );

      expect(prizePoolVector['validMetadataBytes'], 1);
      expect(prizePoolVector['validProofNodes'], 1);
      for (final invalidItem in [
        poolItem(nft, metadata: const []),
        poolItem(
          nft,
          metadata: List.filled(
            prizePoolVector['oversizedMetadataBytes'] as int,
            0,
          ),
        ),
        poolItem(
          nft,
          proof: List.filled(
            prizePoolVector['oversizedProofNodes'] as int,
            nft,
          ),
        ),
      ]) {
        expect(
          () => TemplatePlan(
            bundles: [
              PrizeBundle(
                label: 'Invalid pool witness',
                quantity: BigInt.one,
                assets: [
                  PrizeAsset.prizePool(tree, [invalidItem]),
                ],
              ),
            ],
          ),
          throwsA(isA<TemplatePlanException>()),
        );
      }
    });

    test('counts quote collateral and allows multi-copy badge authority', () {
      final plan = TemplatePlan(
        bundles: [
          PrizeBundle(
            label: 'Launch',
            quantity: BigInt.from(10),
            assets: [
              PrizeAsset.quoteSol(BigInt.from(100)),
              PrizeAsset.mintBadge(nft),
            ],
          ),
        ],
      );
      expect(plan.treasury[null], BigInt.from(1000));
      expect(plan.treasury[nft], BigInt.from(10));
    });

    test('matches PrizePool ticket capacity to deposited item count', () {
      expect(maxPrizePoolItems, prizePoolVector['maxItems']);
      final quantity = BigInt.from(prizePoolVector['validQuantity'] as int);
      final plan = TemplatePlan(
        bundles: [
          PrizeBundle(
            label: 'Compressed collection',
            quantity: quantity,
            assets: [
              PrizeAsset.prizePool(
                tree,
                poolAssets
                    .take(prizePoolVector['validItemCount'] as int)
                    .map((asset) => poolItem(asset))
                    .toList(),
              ),
            ],
          ),
        ],
      );
      expect(plan.fixedSupply, quantity);
      expect(plan.treasury[tree], quantity);

      expect(
        () => TemplatePlan(
          bundles: [
            PrizeBundle(
              label: 'Incomplete pool',
              quantity: quantity,
              assets: [
                PrizeAsset.prizePool(
                  tree,
                  poolAssets
                      .take(prizePoolVector['mismatchedItemCount'] as int)
                      .map((asset) => poolItem(asset))
                      .toList(),
                ),
              ],
            ),
          ],
        ),
        throwsA(isA<TemplatePlanException>()),
      );
      final oversized = prizePoolVector['oversizedQuantity'] as int;
      expect(
        () => TemplatePlan(
          bundles: [
            PrizeBundle(
              label: 'Oversized pool',
              quantity: BigInt.from(oversized),
              assets: [
                PrizeAsset.prizePool(
                  tree,
                  List.generate(oversized, (_) => poolItem(nft)),
                ),
              ],
            ),
          ],
        ),
        throwsA(isA<TemplatePlanException>()),
      );

      final mutableCount = prizePoolVector['mutableItemCount'] as int;
      expect(
        () => TemplatePlan(
          bundles: [
            PrizeBundle(
              label: 'Mutable pool',
              quantity: BigInt.from(mutableCount),
              assets: [
                PrizeAsset.prizePool(
                  tree,
                  List.generate(
                    mutableCount,
                    (_) => poolItem(nft, metadataMutable: true),
                  ),
                ),
              ],
            ),
          ],
        ),
        throwsA(isA<TemplatePlanException>()),
      );

      final duplicateCount = prizePoolVector['duplicateItemCount'] as int;
      expect(
        () => TemplatePlan(
          bundles: [
            PrizeBundle(
              label: 'Duplicate pool',
              quantity: BigInt.from(duplicateCount),
              assets: [
                PrizeAsset.prizePool(
                  tree,
                  List.generate(duplicateCount, (_) => poolItem(nft)),
                ),
              ],
            ),
          ],
        ),
        throwsA(isA<TemplatePlanException>()),
      );

      for (final invalidItem in [
        PrizePoolItem(
          asset: const Address('11111111111111111111111111111111'),
          metadataMutable: false,
          metadata: const [1],
          tree: tree,
          treeConfig: nft,
          root: List.filled(32, 1),
          dataHash: List.filled(32, 2),
          creatorHash: List.filled(32, 3),
          nonce: BigInt.zero,
          leafIndex: 0,
          proof: const [nft],
        ),
        PrizePoolItem(
          asset: nft,
          metadataMutable: false,
          metadata: const [-1],
          tree: tree,
          treeConfig: nft,
          root: List.filled(32, 1),
          dataHash: List.filled(32, 2),
          creatorHash: List.filled(32, 3),
          nonce: BigInt.zero,
          leafIndex: 0,
          proof: const [nft],
        ),
      ]) {
        expect(
          () => TemplatePlan(
            bundles: [
              PrizeBundle(
                label: 'Invalid byte domain',
                quantity: BigInt.one,
                assets: [
                  PrizeAsset.prizePool(tree, [invalidItem]),
                ],
              ),
            ],
          ),
          throwsA(isA<TemplatePlanException>()),
        );
      }
    });

    test('rejects more than the compact inventory capacity', () {
      final bundle = PrizeBundle(
        label: 'SOL',
        quantity: BigInt.one,
        assets: [PrizeAsset.sol(BigInt.one)],
      );
      expect(
        () =>
            TemplatePlan(bundles: List.filled(maxTemplateBundles + 1, bundle)),
        throwsA(
          isA<TemplatePlanException>().having(
            (error) => error.code,
            'code',
            TemplatePlanErrorCode.invalidBundleCount,
          ),
        ),
      );
    });

    test('takes an immutable snapshot of bundle lists', () {
      final assets = [PrizeAsset.sol(BigInt.one)];
      final bundle = PrizeBundle(
        label: 'SOL',
        quantity: BigInt.one,
        assets: assets,
      );
      final bundles = [bundle];
      final plan = TemplatePlan(bundles: bundles);
      assets.clear();
      bundles.clear();
      expect(plan.bundles.single.assets.length, 1);
      expect(() => plan.bundles.clear(), throwsUnsupportedError);
    });

    test('creator service funding is exact and optional', () {
      final totalBundles = BigInt.parse(
        serviceBudgetVector['totalBundles'] as String,
      );
      final settlementBountyLamports = BigInt.parse(
        serviceBudgetVector['settlementBountyLamports'] as String,
      );
      final resultReceiptRentLamports = BigInt.parse(
        serviceBudgetVector['resultReceiptRentLamports'] as String,
      );
      final serviceVaultRentLamports = BigInt.parse(
        serviceBudgetVector['serviceVaultRentLamports'] as String,
      );
      final expectedBudgetLamports = BigInt.parse(
        serviceBudgetVector['expectedBudgetLamports'] as String,
      );
      final bundles = [
        PrizeBundle(
          label: 'SOL',
          quantity: totalBundles,
          assets: [PrizeAsset.sol(BigInt.one)],
        ),
      ];
      expect(
        TemplatePlan(bundles: bundles).requiredServiceBudget(
          resultReceiptRentLamports,
          serviceVaultRentLamports,
        ),
        BigInt.zero,
      );
      final plan = TemplatePlan(
        bundles: bundles,
        settlementBountyLamports: settlementBountyLamports,
        resultReceiptsEnabled:
            serviceBudgetVector['resultReceiptsEnabled'] as bool,
      );
      expect(
        plan.requiredServiceBudget(
          resultReceiptRentLamports,
          serviceVaultRentLamports,
        ),
        expectedBudgetLamports,
      );
    });
  });
}
