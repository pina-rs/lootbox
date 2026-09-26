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
class ExclusiveAttachmentState {
  const ExclusiveAttachmentState({
    required this.template,
    required this.bundle,
    required this.collection,
    required this.layersHash,
    required this.quantity,
    required this.minted,
    required this.mintFeeLamports,
    required this.assetIndex,
    required this.bump,
    required this.feeVaultBump,
  }) : discriminator = 11,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final Address template;
  final Address bundle;
  final Address collection;
  final Uint8List layersHash;
  final BigInt quantity;
  final BigInt minted;
  final BigInt mintFeeLamports;
  final int assetIndex;
  final int bump;
  final int feeVaultBump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ExclusiveAttachmentState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          migrationVersion == other.migrationVersion &&
          template == other.template &&
          bundle == other.bundle &&
          collection == other.collection &&
          layersHash == other.layersHash &&
          quantity == other.quantity &&
          minted == other.minted &&
          mintFeeLamports == other.mintFeeLamports &&
          assetIndex == other.assetIndex &&
          bump == other.bump &&
          feeVaultBump == other.feeVaultBump;

  @override
  int get hashCode => Object.hash(
    discriminator,
    migrationVersion,
    template,
    bundle,
    collection,
    layersHash,
    quantity,
    minted,
    mintFeeLamports,
    assetIndex,
    bump,
    feeVaultBump,
  );

  @override
  String toString() =>
      'ExclusiveAttachmentState(discriminator: $discriminator, migrationVersion: $migrationVersion, template: $template, bundle: $bundle, collection: $collection, layersHash: $layersHash, quantity: $quantity, minted: $minted, mintFeeLamports: $mintFeeLamports, assetIndex: $assetIndex, bump: $bump, feeVaultBump: $feeVaultBump)';
}

Encoder<ExclusiveAttachmentState> getExclusiveAttachmentStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('template', getAddressEncoder()),
    ('bundle', getAddressEncoder()),
    ('collection', getAddressEncoder()),
    (
      'layersHash',
      fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false),
    ),
    ('quantity', getU64Encoder()),
    ('minted', getU64Encoder()),
    ('mintFeeLamports', getU64Encoder()),
    ('assetIndex', getU8Encoder()),
    ('bump', getU8Encoder()),
    ('feeVaultBump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ExclusiveAttachmentState value) => <String, Object?>{
      'discriminator': 11,
      'migrationVersion': 0,
      'template': value.template,
      'bundle': value.bundle,
      'collection': value.collection,
      'layersHash': value.layersHash,
      'quantity': value.quantity,
      'minted': value.minted,
      'mintFeeLamports': value.mintFeeLamports,
      'assetIndex': value.assetIndex,
      'bump': value.bump,
      'feeVaultBump': value.feeVaultBump,
    },
  );
}

Decoder<ExclusiveAttachmentState> getExclusiveAttachmentStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('template', getAddressDecoder()),
    ('bundle', getAddressDecoder()),
    ('collection', getAddressDecoder()),
    ('layersHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('quantity', getU64Decoder()),
    ('minted', getU64Decoder()),
    ('mintFeeLamports', getU64Decoder()),
    ('assetIndex', getU8Decoder()),
    ('bump', getU8Decoder()),
    ('feeVaultBump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'exclusiveAttachmentState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ExclusiveAttachmentState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(11)).read(bytes, offset + 0);
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
      ExclusiveAttachmentState(
        template: map['template']! as Address,
        bundle: map['bundle']! as Address,
        collection: map['collection']! as Address,
        layersHash: map['layersHash']! as Uint8List,
        quantity: map['quantity']! as BigInt,
        minted: map['minted']! as BigInt,
        mintFeeLamports: map['mintFeeLamports']! as BigInt,
        assetIndex: map['assetIndex']! as int,
        bump: map['bump']! as int,
        feeVaultBump: map['feeVaultBump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ExclusiveAttachmentState>(
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
      VariableSizeDecoder<ExclusiveAttachmentState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ExclusiveAttachmentState, ExclusiveAttachmentState>
getExclusiveAttachmentStateCodec() {
  return combineCodec(
    getExclusiveAttachmentStateEncoder(),
    getExclusiveAttachmentStateDecoder(),
  );
}

Account<ExclusiveAttachmentState> decodeExclusiveAttachmentState(
  EncodedAccount encodedAccount,
) {
  return decodeAccount(encodedAccount, getExclusiveAttachmentStateDecoder());
}

/// The account schema version this client was generated from.
const int exclusiveAttachmentStateMigrationVersion = 0;

/// Cheap envelope check for fetched `ExclusiveAttachmentState` bytes: returns true only when
/// the bytes carry this account's discriminator and a migration version older
/// than this client's schema — exactly the accounts [getMigrateInstruction]
/// can bring current. Decoding reports every other mismatch.
bool exclusiveAttachmentStateNeedsMigration(List<int> data) {
  if (data.length < 2) {
    return false;
  }
  if (data[0] != 11) {
    return false;
  }
  return data[1] < 0;
}
