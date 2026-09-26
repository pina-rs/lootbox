import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:lootbox/lootbox.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:test/test.dart';

List<int> _bytes(String hex) => [
  for (var index = 0; index < hex.length; index += 2)
    int.parse(hex.substring(index, index + 2), radix: 16),
];

String _hex(List<int> bytes) =>
    bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();

void main() {
  final vectors =
      jsonDecode(
            File('../../tests/vectors/exclusive-nft.json').readAsStringSync(),
          )
          as Map<String, dynamic>;
  final decoder = getAddressDecoder();
  Address addressOf(String hex) =>
      decoder.decode(Uint8List.fromList(_bytes(hex)));
  List<List<int>> layersOf(Map<String, dynamic> draw) => [
    for (final layer in draw['layers'] as List<dynamic>)
      [for (final weight in layer as List<dynamic>) weight as int],
  ];

  group('Exclusive Lootbox NFT derivation', () {
    test('matches the shared seed vectors', () {
      for (final seed in vectors['seeds'] as List<dynamic>) {
        final entry = seed as Map<String, dynamic>;
        expect(
          _hex(
            exclusiveNftSeed(
              addressOf(entry['templateHex'] as String),
              addressOf(entry['openingHex'] as String),
              _bytes(entry['entropyHex'] as String),
            ),
          ),
          entry['seedHex'],
        );
      }
    });

    test('matches the shared per-layer trait, name, and URI vectors', () {
      for (final draw in vectors['draws'] as List<dynamic>) {
        final entry = draw as Map<String, dynamic>;
        final traits = exclusiveTraits(
          _bytes(entry['seedHex'] as String),
          layersOf(entry),
        );
        expect(traits, entry['traits'], reason: entry['label'] as String);
        final serial = BigInt.parse(entry['serial'] as String);
        expect(
          exclusiveUri(entry['baseUri'] as String, traits, serial),
          entry['uri'],
        );
        expect(
          exclusiveName(entry['namePrefix'] as String, serial),
          entry['name'],
        );
      }
    });

    test('derives traits from the opening like the program', () {
      final seed =
          (vectors['seeds'] as List<dynamic>).first as Map<String, dynamic>;
      final draw =
          (vectors['draws'] as List<dynamic>).first as Map<String, dynamic>;
      final derived = deriveExclusiveTraits(
        addressOf(seed['templateHex'] as String),
        addressOf(seed['openingHex'] as String),
        _bytes(seed['entropyHex'] as String),
        layersOf(draw),
      );
      expect(_hex(derived.seed), seed['seedHex']);
      expect(derived.traits, draw['traits']);
    });

    test('rejects layer tables the program rejects', () {
      expect(
        () => validateExclusiveLayers([]),
        throwsA(isA<ExclusiveNftException>()),
      );
      expect(
        () => validateExclusiveLayers([[]]),
        throwsA(isA<ExclusiveNftException>()),
      );
      expect(
        () => validateExclusiveLayers([
          [0, 0],
        ]),
        throwsA(isA<ExclusiveNftException>()),
      );
      expect(
        () => validateExclusiveLayers([
          [0xffffffff, 1],
        ]),
        throwsA(isA<ExclusiveNftException>()),
      );
      expect(
        () => validateExclusiveLayers([List.filled(65, 1)]),
        throwsA(isA<ExclusiveNftException>()),
      );
      expect(
        () => validateExclusiveLayers(List.filled(13, [1])),
        throwsA(isA<ExclusiveNftException>()),
      );
      expect(
        () => exclusiveName('A' * 21, BigInt.parse('9999999999')),
        throwsA(isA<ExclusiveNftException>()),
      );
    });

    test('plans many attachments to one collection and their fee escrow', () {
      final planner = vectors['planner'] as Map<String, dynamic>;
      final quantity = BigInt.parse(planner['quantity'] as String);
      expect(
        exclusiveMintFeeEscrow(quantity),
        BigInt.parse(planner['expectedMintFeeEscrowLamports'] as String),
      );
      const collection = Address('LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E');
      final plan = TemplatePlan(
        bundles: [
          PrizeBundle(
            label: 'Exclusive plus SOL',
            quantity: quantity,
            assets: [
              PrizeAsset.exclusiveNft(collection),
              PrizeAsset.sol(BigInt.from(1000)),
            ],
          ),
          PrizeBundle(
            label: 'Exclusive',
            quantity: BigInt.two,
            assets: [PrizeAsset.exclusiveNft(collection)],
          ),
        ],
      );
      expect(plan.treasury[collection], quantity + BigInt.two);
      expect(plan.treasury[null], quantity * BigInt.from(1000));
    });
  });
}
