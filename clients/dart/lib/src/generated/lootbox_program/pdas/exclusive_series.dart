// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';

@immutable
class ExclusiveSeriesSeeds {
  const ExclusiveSeriesSeeds({required this.template});

  final Address template;
}

/// Finds the program derived address for [ExclusiveSeries].
Future<(Address, int)> findExclusiveSeriesPda({
  required ExclusiveSeriesSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'exclusive-series',
    getAddressEncoder().encode(seeds.template),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
