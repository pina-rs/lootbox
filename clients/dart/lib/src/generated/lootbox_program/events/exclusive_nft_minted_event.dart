// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'dart:typed_data';

import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_core/solana_kit_codecs_core.dart';
import 'package:solana_kit_codecs_data_structures/solana_kit_codecs_data_structures.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

import 'event_log.dart';

/// Event record `ExclusiveNftMintedEvent`.
class ExclusiveNftMintedEventEvent {
  const ExclusiveNftMintedEventEvent({
    required this.discriminator,
    required this.migrationVersion,
    required this.template,
    required this.opening,
    required this.series,
    required this.beneficiary,
    required this.asset,
    required this.seed,
    required this.serial,
    required this.bonusLamports,
    required this.tier,
    required this.contents,
    required this.background,
    required this.pattern,
  });

  final int discriminator;
  final int migrationVersion;
  final Address template;
  final Address opening;
  final Address series;
  final Address beneficiary;
  final Address asset;
  final Uint8List seed;
  final BigInt serial;
  final BigInt bonusLamports;
  final int tier;
  final int contents;
  final int background;
  final int pattern;

  String get name => 'exclusiveNftMintedEvent';

  String toString() =>
      'ExclusiveNftMintedEventEvent(discriminator: ${discriminator}, migrationVersion: ${migrationVersion}, template: ${template}, opening: ${opening}, series: ${series}, beneficiary: ${beneficiary}, asset: ${asset}, seed: ${seed}, serial: ${serial}, bonusLamports: ${bonusLamports}, tier: ${tier}, contents: ${contents}, background: ${background}, pattern: ${pattern})';
}

/// The discriminator this event is emitted under.
const exclusiveNftMintedEventEventDiscriminator = 1;

/// The discriminator bytes as stored at offset zero.
const List<int> _exclusiveNftMintedEventEventDiscriminatorBytes = [1];

/// The version this client was generated from.
const exclusiveNftMintedEventEventMigrationVersion = 0;

/// Exact current byte length of a `ExclusiveNftMintedEvent` record, envelope included.
const exclusiveNftMintedEventEventSize = 214;

/// Decode one current-version `ExclusiveNftMintedEvent` record.
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
          ? 'event migration version mismatch: expected 0, received $v1 (the log predates this client; project it through the checked-in event history or decode it with a client generated from the schema that wrote it)'
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
  final (v7, c7) = fixDecoderSize(getBytesDecoder(), 32).read(data, cursor);
  cursor = c7;
  final (v8, c8) = getU64Decoder().read(data, cursor);
  cursor = c8;
  final (v9, c9) = getU64Decoder().read(data, cursor);
  cursor = c9;
  final (v10, c10) = getU8Decoder().read(data, cursor);
  cursor = c10;
  final (v11, c11) = getU8Decoder().read(data, cursor);
  cursor = c11;
  final (v12, c12) = getU8Decoder().read(data, cursor);
  cursor = c12;
  final (v13, c13) = getU8Decoder().read(data, cursor);
  cursor = c13;

  return ExclusiveNftMintedEventEvent(
    discriminator: v0,
    migrationVersion: v1,
    template: v2,
    opening: v3,
    series: v4,
    beneficiary: v5,
    asset: v6,
    seed: v7,
    serial: v8,
    bonusLamports: v9,
    tier: v10,
    contents: v11,
    background: v12,
    pattern: v13,
  );
}

/// Event bytes projected into the current shape.
class NormalizedExclusiveNftMintedEventEvent extends LootboxProgramEvent {
  const NormalizedExclusiveNftMintedEventEvent({
    required this.data,
    required this.sourceVersion,
    required this.wasMigrated,
  });

  final ExclusiveNftMintedEventEvent data;

  /// The version carried by the immutable log record, matching the runtime's
  /// `CurrentEventData::source_version`.
  final int sourceVersion;

  /// Whether a historical projection ran.
  final bool wasMigrated;

  @override
  String get name => 'exclusiveNftMintedEvent';
}

/// Adjacent projections from the checked-in migration manifest: `(from, to,
/// automatic, source payload size, destination payload size, moves)`.
const List<(int, int, bool, int, int, List<(int, int, int)>)>
_exclusiveNftMintedEventProjectionSteps = [];

/// Project current or historical bytes into the current shape, mirroring the
/// runtime's `normalize_event_data`. Unknown, future, non-exact, and manual
/// transitions fail closed.
NormalizedExclusiveNftMintedEventEvent normalizeExclusiveNftMintedEventEvent(
  Uint8List data,
) {
  if (data.length < 2) {
    throw RangeError(
      'the provided data is too short for the "ExclusiveNftMintedEvent" event envelope',
    );
  }
  for (var index = 0; index < 1; index++) {
    if (data[index] != _exclusiveNftMintedEventEventDiscriminatorBytes[index]) {
      throw RangeError(
        'the provided data does not match the "ExclusiveNftMintedEvent" event discriminator',
      );
    }
  }
  final sourceVersion = data[1];
  if (sourceVersion > 0) {
    throw RangeError(
      'event migration version mismatch: expected 0, received $sourceVersion (the log was written by a newer program; upgrade this client)',
    );
  }
  if (sourceVersion == 0) {
    return NormalizedExclusiveNftMintedEventEvent(
      data: decodeExclusiveNftMintedEventEvent(data),
      sourceVersion: sourceVersion,
      wasMigrated: false,
    );
  }
  final projected = _projectExclusiveNftMintedEventEvent(data, sourceVersion);
  return NormalizedExclusiveNftMintedEventEvent(
    data: decodeExclusiveNftMintedEventEvent(projected),
    sourceVersion: sourceVersion,
    wasMigrated: true,
  );
}

Uint8List _projectExclusiveNftMintedEventEvent(
  Uint8List data,
  int sourceVersion,
) {
  var version = sourceVersion;
  var payload = Uint8List.fromList(data.sublist(2));
  while (version != 0) {
    (int, int, bool, int, int, List<(int, int, int)>)? step;
    for (final candidate in _exclusiveNftMintedEventProjectionSteps) {
      if (candidate.$1 == version) {
        step = candidate;
        break;
      }
    }
    if (step == null) {
      throw RangeError(
        'event migration version mismatch: expected 0, received $version (this client has no checked-in projection for it)',
      );
    }
    if (!step.$3) {
      throw RangeError(
        'event migration version mismatch: expected 0, received ${step.$1} (the v${step.$1} to v${step.$2} transition is manual, so only an on-chain projection or a client generated from that schema can represent it)',
      );
    }
    if (payload.length != step.$4) {
      throw RangeError(
        'event migration version mismatch: expected 0, received $version (the log length does not match the v$version schema)',
      );
    }
    final destination = Uint8List(step.$5);
    for (final (sourceOffset, destinationOffset, size) in step.$6) {
      destination.setRange(
        destinationOffset,
        destinationOffset + size,
        payload,
        sourceOffset,
      );
    }
    payload = destination;
    version = step.$2;
  }

  final projected = Uint8List(2 + payload.length);
  projected.setRange(0, 1, _exclusiveNftMintedEventEventDiscriminatorBytes);
  projected[1] = 0;
  projected.setRange(2, projected.length, payload);
  return projected;
}

/// A decoded `ExclusiveNftMintedEvent` log record.
typedef DecodedExclusiveNftMintedEventEvent =
    NormalizedExclusiveNftMintedEventEvent;

/// Decode a `Program data:` log line, or return null when the line is not
/// this event.
NormalizedExclusiveNftMintedEventEvent?
parseExclusiveNftMintedEventEventFromLog(String log) {
  final bytes = decodeProgramDataLog(log);
  if (bytes == null || bytes.length < 1) {
    return null;
  }
  for (var index = 0; index < 1; index++) {
    if (bytes[index] !=
        _exclusiveNftMintedEventEventDiscriminatorBytes[index]) {
      return null;
    }
  }
  return normalizeExclusiveNftMintedEventEvent(bytes);
}
