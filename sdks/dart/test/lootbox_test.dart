import 'dart:typed_data';

import 'package:lootbox/lootbox.dart';
import 'package:test/test.dart';

void main() {
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
