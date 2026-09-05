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
class ResultReceiptState {
  const ResultReceiptState({
    required this.template,
    required this.opening,
    required this.boxAuthority,
    required this.beneficiary,
    required this.consumerProgram,
    required this.consumerContext,
    required this.manifestHash,
    required this.randomness,
    required this.sequence,
    required this.selectedBundle,
    required this.bump,
  }) :
      discriminator = 7;

  final int discriminator;
  final Address template;
  final Address opening;
  final Address boxAuthority;
  final Address beneficiary;
  final Address consumerProgram;
  final Uint8List consumerContext;
  final Uint8List manifestHash;
  final Address randomness;
  final BigInt sequence;
  final int selectedBundle;
  final int bump;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ResultReceiptState &&
          runtimeType == other.runtimeType &&
          discriminator == other.discriminator &&
          template == other.template &&
          opening == other.opening &&
          boxAuthority == other.boxAuthority &&
          beneficiary == other.beneficiary &&
          consumerProgram == other.consumerProgram &&
          consumerContext == other.consumerContext &&
          manifestHash == other.manifestHash &&
          randomness == other.randomness &&
          sequence == other.sequence &&
          selectedBundle == other.selectedBundle &&
          bump == other.bump;

  @override
  int get hashCode => Object.hash(discriminator, template, opening, boxAuthority, beneficiary, consumerProgram, consumerContext, manifestHash, randomness, sequence, selectedBundle, bump);

  @override
  String toString() => 'ResultReceiptState(discriminator: $discriminator, template: $template, opening: $opening, boxAuthority: $boxAuthority, beneficiary: $beneficiary, consumerProgram: $consumerProgram, consumerContext: $consumerContext, manifestHash: $manifestHash, randomness: $randomness, sequence: $sequence, selectedBundle: $selectedBundle, bump: $bump)';
}


Encoder<ResultReceiptState> getResultReceiptStateEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('template', getAddressEncoder()),
    ('opening', getAddressEncoder()),
    ('boxAuthority', getAddressEncoder()),
    ('beneficiary', getAddressEncoder()),
    ('consumerProgram', getAddressEncoder()),
    ('consumerContext', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('manifestHash', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
    ('randomness', getAddressEncoder()),
    ('sequence', getU64Encoder()),
    ('selectedBundle', getU32Encoder()),
    ('bump', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ResultReceiptState value) => <String, Object?>{
      'discriminator': 7,
      'template': value.template,
      'opening': value.opening,
      'boxAuthority': value.boxAuthority,
      'beneficiary': value.beneficiary,
      'consumerProgram': value.consumerProgram,
      'consumerContext': value.consumerContext,
      'manifestHash': value.manifestHash,
      'randomness': value.randomness,
      'sequence': value.sequence,
      'selectedBundle': value.selectedBundle,
      'bump': value.bump,
    },
  );
}

Decoder<ResultReceiptState> getResultReceiptStateDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('template', getAddressDecoder()),
    ('opening', getAddressDecoder()),
    ('boxAuthority', getAddressDecoder()),
    ('beneficiary', getAddressDecoder()),
    ('consumerProgram', getAddressDecoder()),
    ('consumerContext', fixDecoderSize(getBytesDecoder(), 32)),
    ('manifestHash', fixDecoderSize(getBytesDecoder(), 32)),
    ('randomness', getAddressDecoder()),
    ('sequence', getU64Decoder()),
    ('selectedBundle', getU32Decoder()),
    ('bump', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(
      SolanaErrorCode.codecsInvalidByteLength,
      {
        'codecDescription': 'resultReceiptState account decoder',
        'expected': expected,
        'bytesLength': bytesLength,
      },
    );
  }

  (ResultReceiptState, int) readTopLevel(Uint8List bytes, int offset) {
    getConstantDecoder(
      getU8Encoder().encode(7),
    ).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);

    return (
      ResultReceiptState(
      template: map['template']! as Address,
      opening: map['opening']! as Address,
      boxAuthority: map['boxAuthority']! as Address,
      beneficiary: map['beneficiary']! as Address,
      consumerProgram: map['consumerProgram']! as Address,
      consumerContext: map['consumerContext']! as Uint8List,
      manifestHash: map['manifestHash']! as Uint8List,
      randomness: map['randomness']! as Address,
      sequence: map['sequence']! as BigInt,
      selectedBundle: map['selectedBundle']! as int,
      bump: map['bump']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ResultReceiptState>(
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
      VariableSizeDecoder<ResultReceiptState>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ResultReceiptState, ResultReceiptState> getResultReceiptStateCodec() {
  return combineCodec(getResultReceiptStateEncoder(), getResultReceiptStateDecoder());
}

Account<ResultReceiptState> decodeResultReceiptState(EncodedAccount encodedAccount) {
  return decodeAccount(encodedAccount, getResultReceiptStateDecoder());
}
