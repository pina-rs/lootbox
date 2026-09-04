// Auto-generated. Do not edit.
// ignore_for_file: type=lint

import 'dart:typed_data';

import 'package:meta/meta.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_codecs_core/solana_kit_codecs_core.dart';
import 'package:solana_kit_codecs_data_structures/solana_kit_codecs_data_structures.dart';
import 'package:solana_kit_codecs_numbers/solana_kit_codecs_numbers.dart';
import 'package:solana_kit_errors/solana_kit_errors.dart';
import 'package:solana_kit_instructions/solana_kit_instructions.dart';

@immutable
class FulfillTemplateOpenInstructionData {
  const FulfillTemplateOpenInstructionData({
    required this.signature,
    required this.recoveryId,
    required this.value,
  }) : discriminator = 17;

  final int discriminator;
  final Uint8List signature;
  final int recoveryId;
  final Uint8List value;
}

Encoder<FulfillTemplateOpenInstructionData>
getFulfillTemplateOpenInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    (
      'signature',
      fixEncoderSize(getBytesEncoder(), 64, allowTruncation: false),
    ),
    ('recoveryId', getU8Encoder()),
    ('value', fixEncoderSize(getBytesEncoder(), 32, allowTruncation: false)),
  ]);

  return transformEncoder(
    structEncoder,
    (FulfillTemplateOpenInstructionData value) => <String, Object?>{
      'discriminator': 17,
      'signature': value.signature,
      'recoveryId': value.recoveryId,
      'value': value.value,
    },
  );
}

Decoder<FulfillTemplateOpenInstructionData>
getFulfillTemplateOpenInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('signature', fixDecoderSize(getBytesDecoder(), 64)),
    ('recoveryId', getU8Decoder()),
    ('value', fixDecoderSize(getBytesDecoder(), 32)),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'fulfillTemplateOpen instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (FulfillTemplateOpenInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(17)).read(bytes, offset + 0);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      FulfillTemplateOpenInstructionData(
        signature: map['signature']! as Uint8List,
        recoveryId: map['recoveryId']! as int,
        value: map['value']! as Uint8List,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<FulfillTemplateOpenInstructionData>(
        fixedSize: structDecoder.fixedSize,
        read: (bytes, offset) {
          final bytesLength = bytes.length - offset;
          if (bytesLength != structDecoder.fixedSize) {
            throwInvalidByteLength(structDecoder.fixedSize, bytesLength);
          }
          return readTopLevel(bytes, offset);
        },
      ),
    VariableSizeDecoder<Map<String, Object?>>() =>
      VariableSizeDecoder<FulfillTemplateOpenInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<FulfillTemplateOpenInstructionData, FulfillTemplateOpenInstructionData>
getFulfillTemplateOpenInstructionDataCodec() {
  return combineCodec(
    getFulfillTemplateOpenInstructionDataEncoder(),
    getFulfillTemplateOpenInstructionDataDecoder(),
  );
}

/// Creates a [FulfillTemplateOpen] instruction.
Instruction getFulfillTemplateOpenInstruction({
  required Address programAddress,
  required Address payer,
  required Address template,
  required Address opening,
  required Address randomness,
  required Address oracleQueue,
  required Address oracle,
  required Address oracleStats,
  required Address recentSlotHashes,
  required Address oracleProgram,
  required Address rewardEscrow,
  required Address oracleProgramState,
  required Address systemProgram,
  required Address tokenProgram,
  required Address wrappedSolMint,
  required Uint8List signature,
  required int recoveryId,
  required Uint8List value,
}) {
  final instructionData = FulfillTemplateOpenInstructionData(
    signature: signature,
    recoveryId: recoveryId,
    value: value,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: payer, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: opening, role: AccountRole.writable),
      AccountMeta(address: randomness, role: AccountRole.writable),
      AccountMeta(address: oracleQueue, role: AccountRole.readonly),
      AccountMeta(address: oracle, role: AccountRole.readonly),
      AccountMeta(address: oracleStats, role: AccountRole.writable),
      AccountMeta(address: recentSlotHashes, role: AccountRole.readonly),
      AccountMeta(address: oracleProgram, role: AccountRole.readonly),
      AccountMeta(address: rewardEscrow, role: AccountRole.writable),
      AccountMeta(address: oracleProgramState, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
      AccountMeta(address: tokenProgram, role: AccountRole.readonly),
      AccountMeta(address: wrappedSolMint, role: AccountRole.readonly),
    ],
    data: getFulfillTemplateOpenInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [FulfillTemplateOpen] instruction from raw instruction data.
FulfillTemplateOpenInstructionData parseFulfillTemplateOpenInstruction(
  Instruction instruction,
) {
  return getFulfillTemplateOpenInstructionDataDecoder().decode(
    instruction.data!,
  );
}
