import 'package:lootbox/lootbox.dart';
import 'package:test/test.dart';

void main() {
  group('LootboxPlan', () {
    test('calculates probabilities and worst-case collateral', () {
      final plan = LootboxPlan(
        maxSupply: BigInt.from(100),
        outcomes: [
          LootboxOutcome(
            label: 'Spark',
            weight: BigInt.from(70),
            rewardLamports: BigInt.from(10000),
          ),
          LootboxOutcome(
            label: 'Nova',
            weight: BigInt.from(30),
            rewardLamports: BigInt.from(50000),
          ),
        ],
      );

      expect(plan.totalWeight, BigInt.from(100));
      expect(plan.probabilityBasisPoints(0), 7000);
      expect(plan.requiredCollateralLamports, BigInt.from(5000000));
    });

    test('rejects a zero-weight outcome', () {
      expect(
        () => LootboxPlan(
          maxSupply: BigInt.one,
          outcomes: [
            LootboxOutcome(
              label: 'Impossible',
              weight: BigInt.zero,
              rewardLamports: BigInt.one,
            ),
          ],
        ),
        throwsA(
          isA<LootboxPlanException>().having(
            (error) => error.code,
            'code',
            'ZERO_WEIGHT',
          ),
        ),
      );
    });

    test('rejects values that overflow on-chain integers', () {
      expect(
        () => LootboxPlan(
          maxSupply: BigInt.two,
          outcomes: [
            LootboxOutcome(
              label: 'Overflow',
              weight: BigInt.one,
              rewardLamports: (BigInt.one << 64) - BigInt.one,
            ),
          ],
        ),
        throwsA(
          isA<LootboxPlanException>().having(
            (error) => error.code,
            'code',
            'ARITHMETIC_OVERFLOW',
          ),
        ),
      );
    });
  });
}
