// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

@immutable
class ExclusiveCollectionSeeds {
  const ExclusiveCollectionSeeds({
    required this.admin,
    required this.collectionId,
  });

  final Address admin;
  final BigInt collectionId;
}

/// Finds the program derived address for [ExclusiveCollection].
Future<(Address, int)> findExclusiveCollectionPda({
  required ExclusiveCollectionSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'exclusive-collection',
    getAddressEncoder().encode(seeds.admin),
    getU64Encoder().encode(seeds.collectionId),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
