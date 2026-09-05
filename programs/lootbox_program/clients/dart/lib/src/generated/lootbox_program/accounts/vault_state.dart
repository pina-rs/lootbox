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
class VaultState {
  const VaultState({
    required this.lootbox,
    required this.rentReserve,
    required this.bump,
  }) :
      discriminator = 2;

  final int discriminator;
  final Address lootbox;
  final BigInt rentReserve;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is VaultState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          lootbox == other.lootbox &&
          rentReserve == other.rentReserve &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(discriminator, lootbox, rentReserve, bump);

  @override
  String toString() => 'VaultState(discriminator: $discriminator, lootbox: $lootbox, rentReserve: $rentReserve, bump: $bump)';
}


Encoder<VaultState> getVaultStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('lootbox', getAddressEncoder()),
    ('rentReserve', getU64Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (VaultState value) => <String, Object?>{
      'discriminator': 2,
      'lootbox': value.lootbox,
      'rentReserve': value.rentReserve,
      'bump': value.bump,
    },
  );
}

Decoder<VaultState> getVaultStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('lootbox', getAddressDecoder()),
    ('rentReserve', getU64Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'vaultState account decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (VaultState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(2),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      VaultState(
      lootbox: map['lootbox']! as Address,
      rentReserve: map['rentReserve']! as BigInt,
      bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<VaultState>(
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
      VariableSizeDecoder<VaultState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<VaultState, VaultState> getVaultStateCodec() {
  return combineCodec(getVaultStateEncoder(), getVaultStateDecoder());
}

Account<VaultState> decodeVaultState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getVaultStateDecoder());
}
