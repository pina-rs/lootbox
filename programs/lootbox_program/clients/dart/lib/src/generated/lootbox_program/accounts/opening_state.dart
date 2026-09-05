// Auto-generated. Do not edit.
// ignore_for_file: type=lint


import 'dart:typed_data';

import 'package:meta/meta.dart';
import 'package:solana_kit_accounts/solana_kit_accounts.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_core/solana_kit_codecs_core.dart';
import 'package:solana_kit_codecs_data_structures/solana_kit_codecs_data_structures.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';
import 'package:solana_kit_errors/solana_kit_errors.dart';


@immutable
class OpeningState {
  const OpeningState({
    required this.lootbox,
    required this.recipient,
    required this.randomness,
    required this.seedSlot,
    required this.rewardLamports,
    required this.selectedOutcome,
    required this.status,
    required this.bump,
  }) :
      discriminator = 3;

  final int discriminator;
  final Address lootbox;
  final Address recipient;
  final Address randomness;
  final BigInt seedSlot;
  final BigInt rewardLamports;
  final int selectedOutcome;
  final int status;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OpeningState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          lootbox == other.lootbox &&
          recipient == other.recipient &&
          randomness == other.randomness &&
          seedSlot == other.seedSlot &&
          rewardLamports == other.rewardLamports &&
          selectedOutcome == other.selectedOutcome &&
          status == other.status &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(discriminator, lootbox, recipient, randomness, seedSlot, rewardLamports, selectedOutcome, status, bump);

  @override
  String toString() => 'OpeningState(discriminator: $discriminator, lootbox: $lootbox, recipient: $recipient, randomness: $randomness, seedSlot: $seedSlot, rewardLamports: $rewardLamports, selectedOutcome: $selectedOutcome, status: $status, bump: $bump)';
}


Encoder<OpeningState> getOpeningStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('lootbox', getAddressEncoder()),
    ('recipient', getAddressEncoder()),
    ('randomness', getAddressEncoder()),
    ('seedSlot', getU64Encoder()),
    ('rewardLamports', getU64Encoder()),
    ('selectedOutcome', getU8Encoder()),
    ('status', getU8Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (OpeningState value) => <String, Object?>{
      'discriminator': 3,
      'lootbox': value.lootbox,
      'recipient': value.recipient,
      'randomness': value.randomness,
      'seedSlot': value.seedSlot,
      'rewardLamports': value.rewardLamports,
      'selectedOutcome': value.selectedOutcome,
      'status': value.status,
      'bump': value.bump,
    },
  );
}

Decoder<OpeningState> getOpeningStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('lootbox', getAddressDecoder()),
    ('recipient', getAddressDecoder()),
    ('randomness', getAddressDecoder()),
    ('seedSlot', getU64Decoder()),
    ('rewardLamports', getU64Decoder()),
    ('selectedOutcome', getU8Decoder()),
    ('status', getU8Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'openingState account decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (OpeningState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(3),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      OpeningState(
      lootbox: map['lootbox']! as Address,
      recipient: map['recipient']! as Address,
      randomness: map['randomness']! as Address,
      seedSlot: map['seedSlot']! as BigInt,
      rewardLamports: map['rewardLamports']! as BigInt,
      selectedOutcome: map['selectedOutcome']! as int,
      status: map['status']! as int,
      bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<OpeningState>(
        fixedSize: structDecoder.fixedSize,
        read: (bytes, offset) {
          final bytesLength = bytes.length - offset;
          if (bytesLength < structDecoder.fixedSize) {
            throwInvalidByteLength(structDecoder.fixedSize, bytesLength);
          }
          return readTopLevel(bytes, offset);
        },
      ),
    VariableSizeDecoder<Map<String, Object?>>() =>
      VariableSizeDecoder<OpeningState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<OpeningState, OpeningState> getOpeningStateCodec() {
  return combineCodec(getOpeningStateEncoder(), getOpeningStateDecoder());
}

Account<OpeningState> decodeOpeningState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getOpeningStateDecoder());
}
