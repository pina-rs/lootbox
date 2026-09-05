/// Ergonomic planning helpers over the generated lootbox program client.
library;

import 'dart:typed_data';

export 'package:lootbox_program_generated/lootbox_program.dart';
export 'src/templates.dart';

const int maxOutcomes = 8;
const List<int> switchboardRevealDiscriminator = [
  197,
  181,
  187,
  10,
  30,
  58,
  20,
  73,
];
final BigInt _maxU64 = (BigInt.one << 64) - BigInt.one;
final BigInt maxTotalWeight = BigInt.from(0xffffffff);

/// Gateway proof fields accepted by `settle_open`.
final class SwitchboardReveal {
  const SwitchboardReveal({
    required this.signature,
    required this.recoveryId,
    required this.value,
  });

  final Uint8List signature;
  final int recoveryId;
  final Uint8List value;
}

/// Decodes Switchboard `randomness_reveal` data for the generated settle API.
SwitchboardReveal decodeSwitchboardReveal(Uint8List data) {
  if (data.length != 105) {
    throw RangeError('Switchboard reveal data must contain exactly 105 bytes');
  }

  for (final (index, byte) in switchboardRevealDiscriminator.indexed) {
    if (data[index] != byte) {
      throw RangeError('instruction is not a Switchboard randomness reveal');
    }
  }

  return SwitchboardReveal(
    signature: Uint8List.fromList(data.sublist(8, 72)),
    recoveryId: data[72],
    value: Uint8List.fromList(data.sublist(73, 105)),
  );
}

/// One weighted SOL payout.
final class LootboxOutcome {
  const LootboxOutcome({
    required this.label,
    required this.weight,
    required this.rewardLamports,
  });

  final String label;
  final BigInt weight;
  final BigInt rewardLamports;
}

/// A checked, immutable lootbox definition.
final class LootboxPlan {
  factory LootboxPlan({
    required BigInt maxSupply,
    required List<LootboxOutcome> outcomes,
  }) {
    if (maxSupply <= BigInt.zero) {
      throw const LootboxPlanException(
        'ZERO_SUPPLY',
        'maxSupply must be greater than zero',
      );
    }
    if (maxSupply > _maxU64) {
      throw const LootboxPlanException(
        'OUT_OF_RANGE',
        'maxSupply exceeds the u64 maximum',
      );
    }
    if (outcomes.isEmpty) {
      throw const LootboxPlanException(
        'NO_OUTCOMES',
        'at least one outcome is required',
      );
    }
    if (outcomes.length > maxOutcomes) {
      throw const LootboxPlanException(
        'TOO_MANY_OUTCOMES',
        'single-reward protocol supports at most 8 outcomes',
      );
    }

    for (final (index, outcome) in outcomes.indexed) {
      if (outcome.weight <= BigInt.zero) {
        throw LootboxPlanException(
          'ZERO_WEIGHT',
          'outcome $index must have a positive weight',
        );
      }
      if (outcome.rewardLamports < BigInt.zero) {
        throw LootboxPlanException(
          'NEGATIVE_REWARD',
          'outcome $index has a negative reward',
        );
      }
      if (outcome.weight > _maxU64 || outcome.rewardLamports > _maxU64) {
        throw LootboxPlanException(
          'OUT_OF_RANGE',
          'outcome $index exceeds the u64 maximum',
        );
      }
    }

    final plan = LootboxPlan._(
      maxSupply: maxSupply,
      outcomes: List.unmodifiable(outcomes),
    );
    if (plan.totalWeight > _maxU64 ||
        plan.requiredCollateralLamports > _maxU64) {
      throw const LootboxPlanException(
        'ARITHMETIC_OVERFLOW',
        'the lootbox plan exceeds the on-chain u64 range',
      );
    }
    if (plan.totalWeight > maxTotalWeight) {
      throw LootboxPlanException(
        'WEIGHT_LIMIT_EXCEEDED',
        'the sum of outcome weights must not exceed $maxTotalWeight',
      );
    }

    return plan;
  }

  const LootboxPlan._({required this.maxSupply, required this.outcomes});

  final BigInt maxSupply;
  final List<LootboxOutcome> outcomes;

  BigInt get totalWeight =>
      outcomes.fold(BigInt.zero, (total, outcome) => total + outcome.weight);

  BigInt get requiredCollateralLamports {
    final maxReward = outcomes
        .map((outcome) => outcome.rewardLamports)
        .reduce((left, right) => left > right ? left : right);

    return maxReward * maxSupply;
  }

  /// Reward paid if an opening reaches the oracle timeout.
  BigInt get minimumRewardLamports => outcomes
      .map((outcome) => outcome.rewardLamports)
      .reduce((left, right) => left < right ? left : right);

  /// Probability in basis points, rounded down exactly like integer clients.
  int probabilityBasisPoints(int index) {
    final outcome = outcomes[index];
    return ((outcome.weight * BigInt.from(10000)) ~/ totalWeight).toInt();
  }
}

/// Invalid developer configuration rejected before transaction construction.
final class LootboxPlanException implements Exception {
  const LootboxPlanException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => 'LootboxPlanException($code): $message';
}
