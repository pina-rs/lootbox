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
class TemplateOpeningState {
  const TemplateOpeningState({
    required this.template,
    required this.boxAuthority,
    required this.beneficiary,
    required this.rentRefund,
    required this.consumerProgram,
    required this.consumerContext,
    required this.randomness,
    required this.sequence,
    required this.seedSlot,
    required this.entropy,
    required this.treasuryRevision,
    required this.eligibleBundleCount,
    required this.status,
    required this.selectedBundle,
    required this.claimedMask,
    required this.bump,
  }) :
      discriminator = 6;

  final int discriminator;
  final Address template;
  final Address boxAuthority;
  final Address beneficiary;
  final Address rentRefund;
  final Address consumerProgram;
  final Uint8List consumerContext;
  final Address randomness;
  final BigInt sequence;
  final BigInt seedSlot;
  final Uint8List entropy;
  final BigInt treasuryRevision;
  final int eligibleBundleCount;
  final int status;
  final int selectedBundle;
  final int claimedMask;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TemplateOpeningState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          template == other.template &&
          boxAuthority == other.boxAuthority &&
          beneficiary == other.beneficiary &&
          rentRefund == other.rentRefund &&
          consumerProgram == other.consumerProgram &&
          consumerContext == other.consumerContext &&
          randomness == other.randomness &&
          sequence == other.sequence &&
          seedSlot == other.seedSlot &&
          entropy == other.entropy &&
          treasuryRevision == other.treasuryRevision &&
          eligibleBundleCount == other.eligibleBundleCount &&
          status == other.status &&
          selectedBundle == other.selectedBundle &&
          claimedMask == other.claimedMask &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(discriminator, template, boxAuthority, beneficiary, rentRefund, consumerProgram, consumerContext, randomness, sequence, seedSlot, entropy, treasuryRevision, eligibleBundleCount, status, selectedBundle, claimedMask, bump);

  @override
  String toString() => 'TemplateOpeningState(discriminator: $discriminator, template: $template, boxAuthority: $boxAuthority, beneficiary: $beneficiary, rentRefund: $rentRefund, consumerProgram: $consumerProgram, consumerContext: $consumerContext, randomness: $randomness, sequence: $sequence, seedSlot: $seedSlot, entropy: $entropy, treasuryRevision: $treasuryRevision, eligibleBundleCount: $eligibleBundleCount, status: $status, selectedBundle: $selectedBundle, claimedMask: $claimedMask, bump: $bump)';
}


Encoder<TemplateOpeningState> getTemplateOpeningStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('template', getAddressEncoder()),
    ('boxAuthority', getAddressEncoder()),
    ('beneficiary', getAddressEncoder()),
    ('rentRefund', getAddressEncoder()),
    ('consumerProgram', getAddressEncoder()),
    ('consumerContext', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('randomness', getAddressEncoder()),
    ('sequence', getU64Encoder()),
    ('seedSlot', getU64Encoder()),
    ('entropy', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('treasuryRevision', getU64Encoder()),
    ('eligibleBundleCount', getU32Encoder()),
    ('status', getU8Encoder()),
    ('selectedBundle', getU32Encoder()),
    ('claimedMask', getU8Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (TemplateOpeningState value) => <String, Object?>{
      'discriminator': 6,
      'template': value.template,
      'boxAuthority': value.boxAuthority,
      'beneficiary': value.beneficiary,
      'rentRefund': value.rentRefund,
      'consumerProgram': value.consumerProgram,
      'consumerContext': value.consumerContext,
      'randomness': value.randomness,
      'sequence': value.sequence,
      'seedSlot': value.seedSlot,
      'entropy': value.entropy,
      'treasuryRevision': value.treasuryRevision,
      'eligibleBundleCount': value.eligibleBundleCount,
      'status': value.status,
      'selectedBundle': value.selectedBundle,
      'claimedMask': value.claimedMask,
      'bump': value.bump,
    },
  );
}

Decoder<TemplateOpeningState> getTemplateOpeningStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('template', getAddressDecoder()),
    ('boxAuthority', getAddressDecoder()),
    ('beneficiary', getAddressDecoder()),
    ('rentRefund', getAddressDecoder()),
    ('consumerProgram', getAddressDecoder()),
    ('consumerContext', fixDecoderSize(getBytesDecoder(), 32)),
    ('randomness', getAddressDecoder()),
    ('sequence', getU64Decoder()),
    ('seedSlot', getU64Decoder()),
    ('entropy', fixDecoderSize(getBytesDecoder(), 32)),
    ('treasuryRevision', getU64Decoder()),
    ('eligibleBundleCount', getU32Decoder()),
    ('status', getU8Decoder()),
    ('selectedBundle', getU32Decoder()),
    ('claimedMask', getU8Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'templateOpeningState account decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (TemplateOpeningState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(6),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      TemplateOpeningState(
      template: map['template']! as Address,
      boxAuthority: map['boxAuthority']! as Address,
      beneficiary: map['beneficiary']! as Address,
      rentRefund: map['rentRefund']! as Address,
      consumerProgram: map['consumerProgram']! as Address,
      consumerContext: map['consumerContext']! as Uint8List,
      randomness: map['randomness']! as Address,
      sequence: map['sequence']! as BigInt,
      seedSlot: map['seedSlot']! as BigInt,
      entropy: map['entropy']! as Uint8List,
      treasuryRevision: map['treasuryRevision']! as BigInt,
      eligibleBundleCount: map['eligibleBundleCount']! as int,
      status: map['status']! as int,
      selectedBundle: map['selectedBundle']! as int,
      claimedMask: map['claimedMask']! as int,
      bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<TemplateOpeningState>(
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
      VariableSizeDecoder<TemplateOpeningState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<TemplateOpeningState, TemplateOpeningState> getTemplateOpeningStateCodec() {
  return combineCodec(getTemplateOpeningStateEncoder(), getTemplateOpeningStateDecoder());
}

Account<TemplateOpeningState> decodeTemplateOpeningState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getTemplateOpeningStateDecoder());
}
