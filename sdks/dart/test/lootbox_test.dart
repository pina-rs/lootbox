import 'dart:typed_data';

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
      expect(plan.minimumRewardLamports, BigInt.from(10000));
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

    test('rejects total weights above the settlement-safe bound', () {
      expect(
        () => LootboxPlan(
          maxSupply: BigInt.one,
          outcomes: [
            LootboxOutcome(
              label: 'Bound',
              weight: maxTotalWeight,
              rewardLamports: BigInt.one,
            ),
            LootboxOutcome(
              label: 'Overflow',
              weight: BigInt.one,
              rewardLamports: BigInt.one,
            ),
          ],
        ),
        throwsA(
          isA<LootboxPlanException>().having(
            (error) => error.code,
            'code',
            'WEIGHT_LIMIT_EXCEEDED',
          ),
        ),
      );
    });
  });

  group('decodeSwitchboardReveal', () {
    test('extracts the signed fields for settleOpen', () {
      final data = Uint8List(105)
        ..setAll(0, switchboardRevealDiscriminator)
        ..fillRange(8, 72, 9)
        ..[72] = 1
        ..fillRange(73, 105, 4);

      final reveal = decodeSwitchboardReveal(data);

      expect(reveal.signature, orderedEquals(List<int>.filled(64, 9)));
      expect(reveal.recoveryId, 1);
      expect(reveal.value, orderedEquals(List<int>.filled(32, 4)));
    });

    test('rejects unrelated instruction data', () {
      expect(() => decodeSwitchboardReveal(Uint8List(105)), throwsRangeError);
    });
  });
}
