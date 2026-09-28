// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'dart:typed_data';

import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';

import 'event_log.dart';

/// Event record `BoxCurveTradedEvent`.
class BoxCurveTradedEventEvent extends LootboxProgramEvent {
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

  @override
  String get name => 'boxCurveTradedEvent';

  String toString() =>
      'BoxCurveTradedEventEvent(discriminator: ${discriminator}, migrationVersion: ${migrationVersion}, curve: ${curve}, trader: ${trader}, count: ${count}, lamports: ${lamports}, fee: ${fee}, soldAfter: ${soldAfter}, side: ${side})';
}

/// The discriminator this event is emitted under.
const boxCurveTradedEventEventDiscriminator = 2;

/// The discriminator bytes as stored at offset zero.
const List<int> _boxCurveTradedEventEventDiscriminatorBytes = [2];

/// The migration version this event decodes.
const boxCurveTradedEventEventMigrationVersion = 0;

/// Exact current byte length of a `BoxCurveTradedEvent` record, envelope included.
const boxCurveTradedEventEventSize = 99;

/// Decode one `BoxCurveTradedEvent` record.
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
          ? 'event migration version mismatch: expected 0, received $v1 (decode it with the event for that version)'
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

/// A decoded `BoxCurveTradedEvent` log record.
typedef DecodedBoxCurveTradedEventEvent = BoxCurveTradedEventEvent;

/// Decode a `Program data:` log line, or return null when the line is not
/// this event.
BoxCurveTradedEventEvent? parseBoxCurveTradedEventEventFromLog(String log) {
  final bytes = decodeProgramDataLog(log);
  if (bytes == null || bytes.length < 2) {
    return null;
  }
  for (var index = 0; index < 1; index++) {
    if (bytes[index] != _boxCurveTradedEventEventDiscriminatorBytes[index]) {
      return null;
    }
  }
  if (bytes[1] != boxCurveTradedEventEventMigrationVersion) {
    return null;
  }
  return decodeBoxCurveTradedEventEvent(bytes);
}
