// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'dart:typed_data';

import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

import 'event_log.dart';

/// Event record `BoxCurveTradedEvent`.
class BoxCurveTradedEventEvent {
  const BoxCurveTradedEventEvent({
    required this.discriminator,
    required this.migrationVersion,
    required this.curve,
    required this.trader,
    required this.count,
    required this.lamports,
    required this.fee,
    required this.soldAfter,
    required this.side,
  });

  final int discriminator;
  final int migrationVersion;
  final Address curve;
  final Address trader;
  final BigInt count;
  final BigInt lamports;
  final BigInt fee;
  final BigInt soldAfter;
  final int side;

  String get name => 'boxCurveTradedEvent';

  String toString() =>
      'BoxCurveTradedEventEvent(discriminator: ${discriminator}, migrationVersion: ${migrationVersion}, curve: ${curve}, trader: ${trader}, count: ${count}, lamports: ${lamports}, fee: ${fee}, soldAfter: ${soldAfter}, side: ${side})';
}

/// The discriminator this event is emitted under.
const boxCurveTradedEventEventDiscriminator = 2;

/// The discriminator bytes as stored at offset zero.
const List<int> _boxCurveTradedEventEventDiscriminatorBytes = [2];

/// The version this client was generated from.
const boxCurveTradedEventEventMigrationVersion = 0;

/// Exact current byte length of a `BoxCurveTradedEvent` record, envelope included.
const boxCurveTradedEventEventSize = 99;

/// Decode one current-version `BoxCurveTradedEvent` record.
BoxCurveTradedEventEvent decodeBoxCurveTradedEventEvent(Uint8List data) {
  if (data.length != boxCurveTradedEventEventSize) {
    throw RangeError(
      'expected exactly ${boxCurveTradedEventEventSize} bytes, received ${data.length}',
    );
  }
  var cursor = 0;
  final (v0, c0) = getU8Decoder().read(data, cursor);
  cursor = c0;
  if (v0 != 2) {
    throw RangeError(
      'the provided bytes do not match the "BoxCurveTradedEvent" event discriminator',
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
  final (v4, c4) = getU64Decoder().read(data, cursor);
  cursor = c4;
  final (v5, c5) = getU64Decoder().read(data, cursor);
  cursor = c5;
  final (v6, c6) = getU64Decoder().read(data, cursor);
  cursor = c6;
  final (v7, c7) = getU64Decoder().read(data, cursor);
  cursor = c7;
  final (v8, c8) = getU8Decoder().read(data, cursor);
  cursor = c8;

  return BoxCurveTradedEventEvent(
    discriminator: v0,
    migrationVersion: v1,
    curve: v2,
    trader: v3,
    count: v4,
    lamports: v5,
    fee: v6,
    soldAfter: v7,
    side: v8,
  );
}

/// Event bytes projected into the current shape.
class NormalizedBoxCurveTradedEventEvent extends LootboxProgramEvent {
  const NormalizedBoxCurveTradedEventEvent({
    required this.data,
    required this.sourceVersion,
    required this.wasMigrated,
  });

  final BoxCurveTradedEventEvent data;

  /// The version carried by the immutable log record, matching the runtime's
  /// `CurrentEventData::source_version`.
  final int sourceVersion;

  /// Whether a historical projection ran.
  final bool wasMigrated;

  @override
  String get name => 'boxCurveTradedEvent';
}

/// Adjacent projections from the checked-in migration manifest: `(from, to,
/// automatic, source payload size, destination payload size, moves)`.
const List<(int, int, bool, int, int, List<(int, int, int)>)>
_boxCurveTradedEventProjectionSteps = [];

/// Project current or historical bytes into the current shape, mirroring the
/// runtime's `normalize_event_data`. Unknown, future, non-exact, and manual
/// transitions fail closed.
NormalizedBoxCurveTradedEventEvent normalizeBoxCurveTradedEventEvent(
  Uint8List data,
) {
  if (data.length < 2) {
    throw RangeError(
      'the provided data is too short for the "BoxCurveTradedEvent" event envelope',
    );
  }
  for (var index = 0; index < 1; index++) {
    if (data[index] != _boxCurveTradedEventEventDiscriminatorBytes[index]) {
      throw RangeError(
        'the provided data does not match the "BoxCurveTradedEvent" event discriminator',
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
    return NormalizedBoxCurveTradedEventEvent(
      data: decodeBoxCurveTradedEventEvent(data),
      sourceVersion: sourceVersion,
      wasMigrated: false,
    );
  }
  final projected = _projectBoxCurveTradedEventEvent(data, sourceVersion);
  return NormalizedBoxCurveTradedEventEvent(
    data: decodeBoxCurveTradedEventEvent(projected),
    sourceVersion: sourceVersion,
    wasMigrated: true,
  );
}

Uint8List _projectBoxCurveTradedEventEvent(Uint8List data, int sourceVersion) {
  var version = sourceVersion;
  var payload = Uint8List.fromList(data.sublist(2));
  while (version != 0) {
    (int, int, bool, int, int, List<(int, int, int)>)? step;
    for (final candidate in _boxCurveTradedEventProjectionSteps) {
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
  projected.setRange(0, 1, _boxCurveTradedEventEventDiscriminatorBytes);
  projected[1] = 0;
  projected.setRange(2, projected.length, payload);
  return projected;
}

/// A decoded `BoxCurveTradedEvent` log record.
typedef DecodedBoxCurveTradedEventEvent = NormalizedBoxCurveTradedEventEvent;

/// Decode a `Program data:` log line, or return null when the line is not
/// this event.
NormalizedBoxCurveTradedEventEvent? parseBoxCurveTradedEventEventFromLog(
  String log,
) {
  final bytes = decodeProgramDataLog(log);
  if (bytes == null || bytes.length < 1) {
    return null;
  }
  for (var index = 0; index < 1; index++) {
    if (bytes[index] != _boxCurveTradedEventEventDiscriminatorBytes[index]) {
      return null;
    }
  }
  return normalizeBoxCurveTradedEventEvent(bytes);
}
