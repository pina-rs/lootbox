import 'package:lootbox/lootbox.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:test/test.dart';

void main() {
  const nft = Address('Bp6AJD3QQ64kZVfc1YnhP7GN5UBYEHsDXpGUc1xzg4op');
  group('finite templates', () {
    test('computes full collateral and exact initial odds', () {
      final plan = TemplatePlan(
        bundles: [
          PrizeBundle(
            label: 'SOL',
            quantity: BigInt.from(99),
            weight: BigInt.one,
            assets: [PrizeAsset.sol(BigInt.from(100000000))],
          ),
          PrizeBundle(
            label: 'Jackpot',
            quantity: BigInt.one,
            weight: BigInt.one,
            assets: [
              PrizeAsset.nft(nft),
              PrizeAsset.sol(BigInt.from(1000000000)),
            ],
          ),
        ],
      );
      expect(plan.maxSupply, BigInt.from(100));
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
              weight: BigInt.one,
              assets: [PrizeAsset.nft(nft)],
            ),
          ],
        ),
        throwsRangeError,
      );
    });

    test('rejects collateral overflow', () {
      expect(
        () => TemplatePlan(
          bundles: [
            PrizeBundle(
              label: 'SOL',
              quantity: BigInt.two,
              weight: BigInt.one,
              assets: [PrizeAsset.sol((BigInt.one << 64) - BigInt.one)],
            ),
          ],
        ),
        throwsRangeError,
      );
    });

    test('takes an immutable snapshot of bundle lists', () {
      final assets = [PrizeAsset.sol(BigInt.one)];
      final bundle = PrizeBundle(
        label: 'SOL',
        quantity: BigInt.one,
        weight: BigInt.one,
        assets: assets,
      );
      final bundles = [bundle];
      final plan = TemplatePlan(bundles: bundles);
      assets.clear();
      bundles.clear();
      expect(plan.bundles.single.assets.length, 1);
      expect(() => plan.bundles.clear(), throwsUnsupportedError);
    });
  });
}
