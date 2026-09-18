// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

@immutable
class PrizePoolSeeds {
  const PrizePoolSeeds({required this.bundle, required this.assetIndex});

  final Address bundle;
  final int assetIndex;
}

/// Finds the program derived address for [PrizePool].
Future<(Address, int)> findPrizePoolPda({
  required PrizePoolSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'prize-pool',
    getAddressEncoder().encode(seeds.bundle),
    getU8Encoder().encode(seeds.assetIndex),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
