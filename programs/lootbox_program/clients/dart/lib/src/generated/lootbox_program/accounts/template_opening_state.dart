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
    required this.recipient,
    required this.randomness,
    required this.sequence,
    required this.seedSlot,
    required this.entropy,
    required this.status,
    required this.selectedOutcome,
    required this.claimedMask,
    required this.bump,
  }) : discriminator = 6;

  final int discriminator;
  final Address template;
  final Address recipient;
  final Address randomness;
  final BigInt sequence;
  final BigInt seedSlot;
  final Uint8List entropy;
  final int status;
  final int selectedOutcome;
  final int claimedMask;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TemplateOpeningState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          template == other.template &&
          recipient == other.recipient &&
          randomness == other.randomness &&
          sequence == other.sequence &&
          seedSlot == other.seedSlot &&
          entropy == other.entropy &&
          status == other.status &&
          selectedOutcome == other.selectedOutcome &&
          claimedMask == other.claimedMask &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(
    discriminator,
    template,
    recipient,
    randomness,
    sequence,
    seedSlot,
    entropy,
    status,
    selectedOutcome,
    claimedMask,
    bump,
  );

  @override
  String toString() =>
      'TemplateOpeningState(discriminator: $discriminator, template: $template, recipient: $recipient, randomness: $randomness, sequence: $sequence, seedSlot: $seedSlot, entropy: $entropy, status: $status, selectedOutcome: $selectedOutcome, claimedMask: $claimedMask, bump: $bump)';
}

Encoder<TemplateOpeningState> getTemplateOpeningStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('template', getAddressEncoder()),
    ('recipient', getAddressEncoder()),
    ('randomness', getAddressEncoder()),
    ('sequence', getU64Encoder()),
    ('seedSlot', getU64Encoder()),
    ('entropy', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('status', getU8Encoder()),
    ('selectedOutcome', getU8Encoder()),
    ('claimedMask', getU8Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (TemplateOpeningState value) => <String, Object?>{
      'discriminator': 6,
      'template': value.template,
      'recipient': value.recipient,
      'randomness': value.randomness,
      'sequence': value.sequence,
      'seedSlot': value.seedSlot,
      'entropy': value.entropy,
      'status': value.status,
      'selectedOutcome': value.selectedOutcome,
      'claimedMask': value.claimedMask,
      'bump': value.bump,
    },
  );
}

Decoder<TemplateOpeningState> getTemplateOpeningStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('template', getAddressDecoder()),
    ('recipient', getAddressDecoder()),
    ('randomness', getAddressDecoder()),
    ('sequence', getU64Decoder()),
    ('seedSlot', getU64Decoder()),
    ('entropy', fixDecoderSize(getBytesDecoder(), 32)),
    ('status', getU8Decoder()),
    ('selectedOutcome', getU8Decoder()),
    ('claimedMask', getU8Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'templateOpeningState account decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (TemplateOpeningState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(getU8Encoder().encode(6)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      TemplateOpeningState(
        template: map['template']! as Address,
        recipient: map['recipient']! as Address,
        randomness: map['randomness']! as Address,
        sequence: map['sequence']! as BigInt,
        seedSlot: map['seedSlot']! as BigInt,
        entropy: map['entropy']! as Uint8List,
        status: map['status']! as int,
        selectedOutcome: map['selectedOutcome']! as int,
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

Codec<TemplateOpeningState, TemplateOpeningState>
getTemplateOpeningStateCodec() {
  return combineCodec(
    getTemplateOpeningStateEncoder(),
    getTemplateOpeningStateDecoder(),
  );
}

Account<TemplateOpeningState> decodeTemplateOpeningState(
  EncodedAccount encodedAccount,
) {
  return decodeAccount(encodedAccount, getTemplateOpeningStateDecoder());
}
