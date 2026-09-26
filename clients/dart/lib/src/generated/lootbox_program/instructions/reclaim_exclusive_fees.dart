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
class ReclaimExclusiveFeesInstructionData {
  const ReclaimExclusiveFeesInstructionData({required this.assetIndex})
    : discriminator = 59,
      migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int assetIndex;
}

Encoder<ReclaimExclusiveFeesInstructionData>
getReclaimExclusiveFeesInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('assetIndex', getU8Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (ReclaimExclusiveFeesInstructionData value) => <String, Object?>{
      'discriminator': 59,
      'migrationVersion': 0,
      'assetIndex': value.assetIndex,
    },
  );
}

Decoder<ReclaimExclusiveFeesInstructionData>
getReclaimExclusiveFeesInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('assetIndex', getU8Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'reclaimExclusiveFees instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (ReclaimExclusiveFeesInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(59)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      ReclaimExclusiveFeesInstructionData(
        assetIndex: map['assetIndex']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<ReclaimExclusiveFeesInstructionData>(
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
      VariableSizeDecoder<ReclaimExclusiveFeesInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<ReclaimExclusiveFeesInstructionData, ReclaimExclusiveFeesInstructionData>
getReclaimExclusiveFeesInstructionDataCodec() {
  return combineCodec(
    getReclaimExclusiveFeesInstructionDataEncoder(),
    getReclaimExclusiveFeesInstructionDataDecoder(),
  );
}

/// Creates a [ReclaimExclusiveFees] instruction.
Instruction getReclaimExclusiveFeesInstruction({
  required Address programAddress,
  required Address authority,
  required Address template,
  required Address boxMint,
  required Address bundle,
  required Address exclusiveAttachment,
  required Address feeVault,
  required Address systemProgram,
  required int assetIndex,
}) {
  final instructionData = ReclaimExclusiveFeesInstructionData(
    assetIndex: assetIndex,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: authority, role: AccountRole.writableSigner),
      AccountMeta(address: template, role: AccountRole.readonly),
      AccountMeta(address: boxMint, role: AccountRole.readonly),
      AccountMeta(address: bundle, role: AccountRole.writable),
      AccountMeta(address: exclusiveAttachment, role: AccountRole.writable),
      AccountMeta(address: feeVault, role: AccountRole.writable),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getReclaimExclusiveFeesInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [ReclaimExclusiveFees] instruction from raw instruction data.
ReclaimExclusiveFeesInstructionData parseReclaimExclusiveFeesInstruction(
  Instruction instruction,
) {
  return getReclaimExclusiveFeesInstructionDataDecoder().decode(
    instruction.data!,
  );
}
