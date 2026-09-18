// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

@immutable
class PrizePoolItemSeeds {
  const PrizePoolItemSeeds({required this.pool, required this.poolIndex});

  final Address pool;
  final int poolIndex;
}

/// Finds the program derived address for [PrizePoolItem].
Future<(Address, int)> findPrizePoolItemPda({
  required PrizePoolItemSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'prize-pool-item',
    getAddressEncoder().encode(seeds.pool),
    getU32Encoder().encode(seeds.poolIndex),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
