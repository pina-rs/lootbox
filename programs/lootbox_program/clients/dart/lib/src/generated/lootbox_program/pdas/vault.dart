// Auto-generated. Do not edit.
// ignore_for_file: type=lint



import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';


@immutable
class VaultSeeds {
  const VaultSeeds({
    required this.lootbox,
  });

  final Address lootbox;
}

/// Finds the program derived address for [Vault].
Future<(Address, int)> findVaultPda({
  required VaultSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'vault',
    getAddressEncoder().encode(seeds.lootbox),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
