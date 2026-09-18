// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';

@immutable
class TemplateOpeningSeeds {
  const TemplateOpeningSeeds({
    required this.template,
    required this.randomness,
  });

  final Address template;
  final Address randomness;
}

/// Finds the program derived address for [TemplateOpening].
Future<(Address, int)> findTemplateOpeningPda({
  required TemplateOpeningSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'template-opening',
    getAddressEncoder().encode(seeds.template),
    getAddressEncoder().encode(seeds.randomness),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
