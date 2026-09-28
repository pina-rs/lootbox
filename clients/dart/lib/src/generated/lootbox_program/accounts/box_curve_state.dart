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
class BoxCurveState {
  const BoxCurveState({
    required this.template,
    required this.boxMint,
    required this.authority,
    required this.inventory,
    required this.sold,
    required this.startPrice,
    required this.priceStep,
    required this.reserve,
    required this.closesAt,
    required this.soldOutAt,
    required this.feeBps,
    required this.bump,
  }) : discriminator = 12,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final Address template;
  final Address boxMint;
  final Address authority;
  final BigInt inventory;
  final BigInt sold;
  final BigInt startPrice;
  final BigInt priceStep;
  final BigInt reserve;
  final BigInt closesAt;
  final BigInt soldOutAt;
  final int feeBps;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BoxCurveState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          migrationVersion == other.migrationVersion &&
          template == other.template &&
          boxMint == other.boxMint &&
          authority == other.authority &&
          inventory == other.inventory &&
          sold == other.sold &&
          startPrice == other.startPrice &&
          priceStep == other.priceStep &&
          reserve == other.reserve &&
          closesAt == other.closesAt &&
          soldOutAt == other.soldOutAt &&
          feeBps == other.feeBps &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(
    discriminator,
    migrationVersion,
    template,
    boxMint,
    authority,
    inventory,
    sold,
    startPrice,
    priceStep,
    reserve,
    closesAt,
    soldOutAt,
    feeBps,
    bump,
  );

  @override
  String toString() =>
      'BoxCurveState(discriminator: $discriminator, migrationVersion: $migrationVersion, template: $template, boxMint: $boxMint, authority: $authority, inventory: $inventory, sold: $sold, startPrice: $startPrice, priceStep: $priceStep, reserve: $reserve, closesAt: $closesAt, soldOutAt: $soldOutAt, feeBps: $feeBps, bump: $bump)';
}

Encoder<BoxCurveState> getBoxCurveStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('template', getAddressEncoder()),
    ('boxMint', getAddressEncoder()),
    ('authority', getAddressEncoder()),
    ('inventory', getU64Encoder()),
    ('sold', getU64Encoder()),
    ('startPrice', getU64Encoder()),
    ('priceStep', getU64Encoder()),
    ('reserve', getU64Encoder()),
    ('closesAt', getI64Encoder()),
    ('soldOutAt', getI64Encoder()),
    ('feeBps', getU16Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (BoxCurveState value) => <String, Object?>{
      'discriminator': 12,
      'migrationVersion': 0,
      'template': value.template,
      'boxMint': value.boxMint,
      'authority': value.authority,
      'inventory': value.inventory,
      'sold': value.sold,
      'startPrice': value.startPrice,
      'priceStep': value.priceStep,
      'reserve': value.reserve,
      'closesAt': value.closesAt,
      'soldOutAt': value.soldOutAt,
      'feeBps': value.feeBps,
      'bump': value.bump,
    },
  );
}

Decoder<BoxCurveState> getBoxCurveStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('template', getAddressDecoder()),
    ('boxMint', getAddressDecoder()),
    ('authority', getAddressDecoder()),
    ('inventory', getU64Decoder()),
    ('sold', getU64Decoder()),
    ('startPrice', getU64Decoder()),
    ('priceStep', getU64Decoder()),
    ('reserve', getU64Decoder()),
    ('closesAt', getI64Decoder()),
    ('soldOutAt', getI64Decoder()),
    ('feeBps', getU16Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'boxCurveState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (BoxCurveState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(12)).read(bytes, offset + 0);
    final (storedMigrationVersion, _) = getU8Decoder().read(bytes, offset + 1);
    if (storedMigrationVersion != 0) {
      throw StateError(
        storedMigrationVersion < 0
            ? 'migration version mismatch: expected 0, received $storedMigrationVersion (the data predates this client; migrate it by sending a transaction to the program, or decode it with a client generated from an older IDL)'
            : 'migration version mismatch: expected 0, received $storedMigrationVersion (the data was written by a newer program; upgrade this client)',
      );
    }
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      BoxCurveState(
        template: map['template']! as Address,
        boxMint: map['boxMint']! as Address,
        authority: map['authority']! as Address,
        inventory: map['inventory']! as BigInt,
        sold: map['sold']! as BigInt,
        startPrice: map['startPrice']! as BigInt,
        priceStep: map['priceStep']! as BigInt,
        reserve: map['reserve']! as BigInt,
        closesAt: map['closesAt']! as BigInt,
        soldOutAt: map['soldOutAt']! as BigInt,
        feeBps: map['feeBps']! as int,
        bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() => FixedSizeDecoder<BoxCurveState>(
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
      VariableSizeDecoder<BoxCurveState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<BoxCurveState, BoxCurveState> getBoxCurveStateCodec() {
  return combineCodec(getBoxCurveStateEncoder(), getBoxCurveStateDecoder());
}

Account<BoxCurveState> decodeBoxCurveState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getBoxCurveStateDecoder());
}

/// The account schema version this client was generated from.
const int boxCurveStateMigrationVersion = 0;

/// Cheap envelope check for fetched `BoxCurveState` bytes: returns true only when
/// the bytes carry this account's discriminator and a migration version older
/// than this client's schema — exactly the accounts [getMigrateInstruction]
/// can bring current. Decoding reports every other mismatch.
bool boxCurveStateNeedsMigration(List<int> data) {
  if (data.length < 2) {
    return false;
  }
  if (data[0] != 12) {
    return false;
  }
  return data[1] < 0;
}
