import 'dart:convert';
import 'dart:io';

import 'package:lootbox/lootbox.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:test/test.dart';

void main() {
  const nft = Address('Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op');
  final serviceBudgetVector =
      jsonDecode(
            File('../../tests/vectors/service-budget.json').readAsStringSync(),
          )
          as Map<String, dynamic>;
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
