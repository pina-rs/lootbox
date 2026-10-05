import 'dart:convert';
import 'dart:io';

import 'package:lootbox/lootbox.dart';
import 'package:test/test.dart';

BigInt _big(Object? value) => BigInt.parse('$value');

void main() {
  final vectors = jsonDecode(
    File('../../tests/vectors/box-curve.json').readAsStringSync(),
  ) as Map<String, dynamic>;

  group('box curve pricing', () {
    test('publishes the program bounds', () {
      expect(minCurveInventory, _big(vectors['minInventory']));
      expect(minCurveStartPrice, _big(vectors['minStartPrice']));
      expect(maxCurveFeeBps, vectors['maxFeeBps']);
    });

    test('matches the shared quote vectors', () {
      for (final entry in vectors['quotes'] as List<dynamic>) {
        final vector = entry as Map<String, dynamic>;
        final terms = vector['curve'] as Map<String, dynamic>;
        final curve = BoxCurve(
          inventory: _big(terms['inventory']),
          sold: _big(terms['sold']),
          startPrice: _big(terms['startPrice']),
          priceStep: _big(terms['priceStep']),
          feeBps: int.parse('${terms['feeBps']}'),
        );
        final count = _big(vector['count']);
        CurveQuote quote() => vector['side'] == 'buy'
            ? quoteCurveBuy(curve, count)
            : quoteCurveSell(curve, count);
        final expected = vector['expected'] as Map<String, dynamic>;

        if (expected.containsKey('error')) {
          expect(
            quote,
            throwsA(isA<BoxCurveException>()),
            reason: '${vector['name']}',
          );
          continue;
        }

        final result = quote();
        expect(result.lamports, _big(expected['lamports']));
        expect(result.fee, _big(expected['fee']));
        expect(result.total, _big(expected['total']));
        expect(result.soldAfter, _big(expected['soldAfter']));
        expect(
          result.nextPrice,
          expected['nextPrice'] == null ? null : _big(expected['nextPrice']),
          reason: '${vector['name']}',
        );
      }
    });

    test('matches the shared plan vectors', () {
      for (final entry in vectors['plans'] as List<dynamic>) {
        final vector = entry as Map<String, dynamic>;
        final input = vector['input'] as Map<String, dynamic>;
        BoxCurvePlan plan() => planBoxCurve(
          inventory: _big(input['inventory']),
          startPrice: _big(input['startPrice']),
          endPrice: _big(input['endPrice']),
          feeBps: int.parse('${input['feeBps']}'),
        );
        final expected = vector['expected'] as Map<String, dynamic>;

        if (expected.containsKey('error')) {
          expect(
            plan,
            throwsA(isA<BoxCurveException>()),
            reason: '${vector['name']}',
          );
          continue;
        }

        final result = plan();
        expect(result.priceStep, _big(expected['priceStep']));
        expect(result.endPrice, _big(expected['endPrice']));
        expect(result.sellOutLamports, _big(expected['sellOutLamports']));
      }
    });
  });
}
