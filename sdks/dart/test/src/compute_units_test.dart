import 'dart:convert';
import 'dart:io';

import 'package:lootbox/lootbox.dart';
import 'package:test/test.dart';

void main() {
  final vectors = jsonDecode(
    File('../../tests/vectors/compute-units.json').readAsStringSync(),
  ) as Map<String, dynamic>;

  group('compute unit budgets', () {
    test('matches the shared vector table', () {
      final instructions = vectors['instructions'] as Map<String, dynamic>;
      final policy = vectors['policy'] as Map<String, dynamic>;

      expect(measuredComputeUnits, instructions);
      expect(computeUnitMarginMultiplier, policy['multiplier']);
      expect(computeUnitMarginAddend, policy['addend']);
      expect(computeUnitMinimum, policy['minimum']);
      expect(computeUnitMaximum, policy['maximum']);
    });

    test('computes the vector limits', () {
      for (final entry in vectors['cases'] as List<dynamic>) {
        final vector = entry as Map<String, dynamic>;
        final names = (vector['instructions'] as List<dynamic>)
            .map((name) => '$name')
            .toList();

        expect(computeUnitLimitByNames(names), vector['expectedLimit']);
      }
    });
  });
}
