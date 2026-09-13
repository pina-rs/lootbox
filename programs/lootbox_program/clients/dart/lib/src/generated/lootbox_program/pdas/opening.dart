// Auto-generated. Do not edit.
// ignore_for_file: type=lint



import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';


@immutable
class OpeningSeeds {
  const OpeningSeeds({
    required this.lootbox,
    required this.randomness,
  });

  final Address lootbox;
  final Address randomness;
}

/// Finds the program derived address for [Opening].
Future<(Address, int)> findOpeningPda({
  required OpeningSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'opening',
    getAddressEncoder().encode(seeds.lootbox),
    getAddressEncoder().encode(seeds.randomness),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
