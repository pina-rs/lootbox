/// Ergonomic planning helpers over the generated lootbox program client.
library;

import 'dart:typed_data';

export 'package:lootbox_program_client/lootbox_program.dart';

export 'src/compute_units.dart';
export 'src/curve.dart';
export 'src/exclusive.dart';
export 'src/templates.dart';

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
