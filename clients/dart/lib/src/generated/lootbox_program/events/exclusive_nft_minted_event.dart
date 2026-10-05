// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'dart:typed_data';

import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_core/solana_kit_codecs_core.dart';
import 'package:solana_kit_codecs_data_structures/solana_kit_codecs_data_structures.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

import 'event_log.dart';

/// Event record `ExclusiveNftMintedEvent`.
class ExclusiveNftMintedEventEvent extends LootboxProgramEvent {
  const ExclusiveNftMintedEventEvent({
    required this.discriminator,
    required this.migrationVersion,
    required this.template,
    required this.opening,
    required this.collection,
    required this.attachment,
    required this.beneficiary,
    required this.asset,
    required this.seed,
    required this.serial,
    required this.traits,
    required this.layerCount,
  });

  final int discriminator;
  final int migrationVersion;
  final Address template;
  final Address opening;
  final Address collection;
  final Address attachment;
  final Address beneficiary;
  final Address asset;
  final Uint8List seed;
  final BigInt serial;
  final Uint8List traits;
  final int layerCount;

  @override
  String get name => 'exclusiveNftMintedEvent';

  String toString() =>
      'ExclusiveNftMintedEventEvent(discriminator: ${discriminator}, migrationVersion: ${migrationVersion}, template: ${template}, opening: ${opening}, collection: ${collection}, attachment: ${attachment}, beneficiary: ${beneficiary}, asset: ${asset}, seed: ${seed}, serial: ${serial}, traits: ${traits}, layerCount: ${layerCount})';
}

/// The discriminator this event is emitted under.
const exclusiveNftMintedEventEventDiscriminator = 1;

/// The discriminator bytes as stored at offset zero.
const List<int> _exclusiveNftMintedEventEventDiscriminatorBytes = [1];

/// The migration version this event decodes.
const exclusiveNftMintedEventEventMigrationVersion = 0;

/// Exact current byte length of a `ExclusiveNftMintedEvent` record, envelope included.
const exclusiveNftMintedEventEventSize = 247;

/// Decode one `ExclusiveNftMintedEvent` record.
ExclusiveNftMintedEventEvent decodeExclusiveNftMintedEventEvent(
  Uint8List data,
) {
  if (data.length != exclusiveNftMintedEventEventSize) {
    throw RangeError(
      'expected exactly ${exclusiveNftMintedEventEventSize} bytes, received ${data.length}',
    );
  }
  var cursor = 0;
  final (v0, c0) = getU8Decoder().read(data, cursor);
  cursor = c0;
  if (v0 != 1) {
    throw RangeError(
      'the provided bytes do not match the "ExclusiveNftMintedEvent" event discriminator',
    );
  }
  final (v1, c1) = getU8Decoder().read(data, cursor);
  cursor = c1;
  if (v1 != 0) {
    throw RangeError(
      v1 < 0
          ? 'event migration version mismatch: expected 0, received $v1 (decode it with the event for that version)'
          : 'event migration version mismatch: expected 0, received $v1 (the log was written by a newer program; upgrade this client)',
    );
  }
  final (v2, c2) = getAddressDecoder().read(data, cursor);
  cursor = c2;
  final (v3, c3) = getAddressDecoder().read(data, cursor);
  cursor = c3;
  final (v4, c4) = getAddressDecoder().read(data, cursor);
  cursor = c4;
  final (v5, c5) = getAddressDecoder().read(data, cursor);
  cursor = c5;
  final (v6, c6) = getAddressDecoder().read(data, cursor);
  cursor = c6;
  final (v7, c7) = getAddressDecoder().read(data, cursor);
  cursor = c7;
  final (v8, c8) = fixDecoderSize(getBytesDecoder(), 32).read(data, cursor);
  cursor = c8;
  final (v9, c9) = getU64Decoder().read(data, cursor);
  cursor = c9;
  final (v10, c10) = fixDecoderSize(getBytesDecoder(), 12).read(data, cursor);
  cursor = c10;
  final (v11, c11) = getU8Decoder().read(data, cursor);
  cursor = c11;

  return ExclusiveNftMintedEventEvent(
    discriminator: v0,
    migrationVersion: v1,
    template: v2,
    opening: v3,
    collection: v4,
    attachment: v5,
    beneficiary: v6,
    asset: v7,
    seed: v8,
    serial: v9,
    traits: v10,
    layerCount: v11,
  );
}

/// A decoded `ExclusiveNftMintedEvent` log record.
typedef DecodedExclusiveNftMintedEventEvent = ExclusiveNftMintedEventEvent;

/// Decode a `Program data:` log line, or return null when the line is not
/// this event.
ExclusiveNftMintedEventEvent? parseExclusiveNftMintedEventEventFromLog(
  String log,
) {
  final bytes = decodeProgramDataLog(log);
  if (bytes == null || bytes.length < 2) {
    return null;
  }
  for (var index = 0; index < 1; index++) {
    if (bytes[index] !=
        _exclusiveNftMintedEventEventDiscriminatorBytes[index]) {
      return null;
    }
  }
  if (bytes[1] != exclusiveNftMintedEventEventMigrationVersion) {
    return null;
  }
  return decodeExclusiveNftMintedEventEvent(bytes);
}
