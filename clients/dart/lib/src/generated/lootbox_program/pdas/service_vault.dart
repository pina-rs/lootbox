// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';

@immutable
class ServiceVaultSeeds {
  const ServiceVaultSeeds({required this.template});

  final Address template;
}

/// Finds the program derived address for [ServiceVault].
Future<(Address, int)> findServiceVaultPda({
  required ServiceVaultSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'service-vault',
    getAddressEncoder().encode(seeds.template),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
