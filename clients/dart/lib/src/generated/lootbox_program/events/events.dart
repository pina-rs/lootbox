// Auto-generated. Do not edit.
// ignore_for_file: type=lint

export 'event_log.dart';
export 'exclusive_nft_minted_event.dart';

import 'event_log.dart';
import 'exclusive_nft_minted_event.dart';

/// Decode every `Program data:` line that names one of this program's events.
///
/// Unrelated lines and programs are skipped. A log that names an event but
/// carries an unknown, future, or non-projectable version throws instead of
/// being silently dropped.
List<LootboxProgramEvent> parseLootboxProgramEventsFromLogs(List<String> logs) {
  final discovered = <LootboxProgramEvent>[];
  for (final log in logs) {
    final exclusiveNftMintedEvent = parseExclusiveNftMintedEventEventFromLog(
      log,
    );
    if (exclusiveNftMintedEvent != null) {
      discovered.add(exclusiveNftMintedEvent);
      continue;
    }
  }
  return discovered;
}
