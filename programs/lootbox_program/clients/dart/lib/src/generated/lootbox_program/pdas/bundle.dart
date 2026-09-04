// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

@immutable
class BundleSeeds {
  const BundleSeeds({required this.template, required this.index});

  final Address template;
  final int index;
}

/// Finds the program derived address for [Bundle].
Future<(Address, int)> findBundlePda({
  required BundleSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'bundle',
    getAddressEncoder().encode(seeds.template),
    getU8Encoder().encode(seeds.index),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
