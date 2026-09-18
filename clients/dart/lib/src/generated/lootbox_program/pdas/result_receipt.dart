// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

@immutable
class ResultReceiptSeeds {
  const ResultReceiptSeeds({required this.opening, required this.sequence});

  final Address opening;
  final BigInt sequence;
}

/// Finds the program derived address for [ResultReceipt].
Future<(Address, int)> findResultReceiptPda({
  required ResultReceiptSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'result-receipt',
    getAddressEncoder().encode(seeds.opening),
    getU64Encoder().encode(seeds.sequence),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
