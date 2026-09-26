// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

@immutable
class ExclusiveAttachmentSeeds {
  const ExclusiveAttachmentSeeds({
    required this.bundle,
    required this.assetIndex,
  });

  final Address bundle;
  final int assetIndex;
}

/// Finds the program derived address for [ExclusiveAttachment].
Future<(Address, int)> findExclusiveAttachmentPda({
  required ExclusiveAttachmentSeeds seeds,
  required Address programAddress,
}) async {
  final seedValues = <Object>[
    'exclusive-attachment',
    getAddressEncoder().encode(seeds.bundle),
    getU8Encoder().encode(seeds.assetIndex),
  ];

  return getProgramDerivedAddress(
    programAddress: programAddress,
    seeds: seedValues,
  );
}
