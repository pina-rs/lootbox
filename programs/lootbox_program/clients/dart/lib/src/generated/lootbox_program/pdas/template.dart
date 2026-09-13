// Auto-generated. Do not edit.
// ignore_for_file: type=lint



import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';


@immutable
class TemplateSeeds {
  const TemplateSeeds({
    required this.authority,
    required this.id,
  });

  final Address authority;
  final BigInt id;
}

/// Finds the program derived address for [Template].
Future<(Address, int)> findTemplatePda({
  required TemplateSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'template',
    getAddressEncoder().encode(seeds.authority),
    getU64Encoder().encode(seeds.id),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
