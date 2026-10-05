// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';

@immutable
class FeeVaultSeeds {
  const FeeVaultSeeds({required this.attachment});

  final Address attachment;
}

/// Finds the program derived address for [FeeVault].
Future<(Address, int)> findFeeVaultPda({
  required FeeVaultSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'exclusive-fee-vault',
    getAddressEncoder().encode(seeds.attachment),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
