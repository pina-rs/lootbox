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
class AppendExclusiveTreeInstructionData {
  const AppendExclusiveTreeInstructionData({
    required this.maxDepth,
    required this.maxBufferSize,
  }) : discriminator = 55,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int maxDepth;
  final int maxBufferSize;
}

Encoder<AppendExclusiveTreeInstructionData>
getAppendExclusiveTreeInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('maxDepth', getU8Encoder()),
    ('maxBufferSize', getU32Encoder()),
  ]);

  return transformEncoder(
    structEncoder,
    (AppendExclusiveTreeInstructionData value) => <String, Object?>{
      'discriminator': 55,
      'migrationVersion': 0,
      'maxDepth': value.maxDepth,
      'maxBufferSize': value.maxBufferSize,
    },
  );
}

Decoder<AppendExclusiveTreeInstructionData>
getAppendExclusiveTreeInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('maxDepth', getU8Decoder()),
    ('maxBufferSize', getU32Decoder()),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'appendExclusiveTree instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (AppendExclusiveTreeInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(55)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      AppendExclusiveTreeInstructionData(
        maxDepth: map['maxDepth']! as int,
        maxBufferSize: map['maxBufferSize']! as int,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<AppendExclusiveTreeInstructionData>(
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
      VariableSizeDecoder<AppendExclusiveTreeInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<AppendExclusiveTreeInstructionData, AppendExclusiveTreeInstructionData>
getAppendExclusiveTreeInstructionDataCodec() {
  return combineCodec(
    getAppendExclusiveTreeInstructionDataEncoder(),
    getAppendExclusiveTreeInstructionDataDecoder(),
  );
}

/// Creates a [AppendExclusiveTree] instruction.
Instruction getAppendExclusiveTreeInstruction({
  required Address programAddress,
  required Address admin,
  required Address exclusiveCollection,
  required Address treeConfig,
  required Address merkleTree,
  required Address bubblegumProgram,
  required Address logWrapper,
  required Address compressionProgram,
  required Address systemProgram,
  required int maxDepth,
  required int maxBufferSize,
}) {
  final instructionData = AppendExclusiveTreeInstructionData(
    maxDepth: maxDepth,
    maxBufferSize: maxBufferSize,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: admin, role: AccountRole.writableSigner),
      AccountMeta(address: exclusiveCollection, role: AccountRole.writable),
      AccountMeta(address: treeConfig, role: AccountRole.writable),
      AccountMeta(address: merkleTree, role: AccountRole.writable),
      AccountMeta(address: bubblegumProgram, role: AccountRole.readonly),
      AccountMeta(address: logWrapper, role: AccountRole.readonly),
      AccountMeta(address: compressionProgram, role: AccountRole.readonly),
      AccountMeta(address: systemProgram, role: AccountRole.readonly),
    ],
    data: getAppendExclusiveTreeInstructionDataEncoder().encode(
      instructionData,
    ),
  );
}

/// Parses a [AppendExclusiveTree] instruction from raw instruction data.
AppendExclusiveTreeInstructionData parseAppendExclusiveTreeInstruction(
  Instruction instruction,
) {
  return getAppendExclusiveTreeInstructionDataDecoder().decode(
    instruction.data!,
  );
}
