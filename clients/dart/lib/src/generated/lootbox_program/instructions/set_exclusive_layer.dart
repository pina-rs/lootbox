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
class SetExclusiveLayerInstructionData {
  const SetExclusiveLayerInstructionData({
    required this.layerIndex,
    required this.traitCount,
    required this.weights,
  }) : discriminator = 54,
       migrationVersion = 0;

  final int discriminator;
  final int migrationVersion;
  final int layerIndex;
  final int traitCount;
  final Uint8List weights;
}

Encoder<SetExclusiveLayerInstructionData>
getSetExclusiveLayerInstructionDataEncoder() {
  final structEncoder = getStructEncoder(<(String, Encoder<Object?>)>[
    ('discriminator', getU8Encoder()),
    ('migrationVersion', getU8Encoder()),
    ('layerIndex', getU8Encoder()),
    ('traitCount', getU8Encoder()),
    ('weights', fixEncoderSize(getBytesEncoder(), 256, allowTruncation: false)),
  ]);

  return transformEncoder(
    structEncoder,
    (SetExclusiveLayerInstructionData value) => <String, Object?>{
      'discriminator': 54,
      'migrationVersion': 0,
      'layerIndex': value.layerIndex,
      'traitCount': value.traitCount,
      'weights': value.weights,
    },
  );
}

Decoder<SetExclusiveLayerInstructionData>
getSetExclusiveLayerInstructionDataDecoder() {
  final structDecoder = getStructDecoder(<(String, Decoder<Object?>)>[
    ('discriminator', getU8Decoder()),
    ('migrationVersion', getU8Decoder()),
    ('layerIndex', getU8Decoder()),
    ('traitCount', getU8Decoder()),
    ('weights', fixDecoderSize(getBytesDecoder(), 256)),
  ]);

  Never throwInvalidByteLength(int expected, int bytesLength) {
    throw SolanaError(SolanaErrorCode.codecsInvalidByteLength, {
      'codecDescription': 'setExclusiveLayer instruction decoder',
      'expected': expected,
      'bytesLength': bytesLength,
    });
  }

  (SetExclusiveLayerInstructionData, int) readTopLevel(
    Uint8List bytes,
    int offset,
  ) {
    getConstantDecoder(getU8Encoder().encode(54)).read(bytes, offset + 0);
    getConstantDecoder(getU8Encoder().encode(0)).read(bytes, offset + 1);
    final (map, newOffset) = structDecoder.read(bytes, offset);
    if (newOffset != bytes.length) {
      throwInvalidByteLength(newOffset - offset, bytes.length - offset);
    }

    return (
      SetExclusiveLayerInstructionData(
        layerIndex: map['layerIndex']! as int,
        traitCount: map['traitCount']! as int,
        weights: map['weights']! as Uint8List,
      ),
      newOffset,
    );
  }

  return switch (structDecoder) {
    FixedSizeDecoder<Map<String, Object?>>() =>
      FixedSizeDecoder<SetExclusiveLayerInstructionData>(
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
      VariableSizeDecoder<SetExclusiveLayerInstructionData>(
        read: readTopLevel,
        maxSize: structDecoder.maxSize,
      ),
  };
}

Codec<SetExclusiveLayerInstructionData, SetExclusiveLayerInstructionData>
getSetExclusiveLayerInstructionDataCodec() {
  return combineCodec(
    getSetExclusiveLayerInstructionDataEncoder(),
    getSetExclusiveLayerInstructionDataDecoder(),
  );
}

/// Creates a [SetExclusiveLayer] instruction.
Instruction getSetExclusiveLayerInstruction({
  required Address programAddress,
  required Address admin,
  required Address exclusiveCollection,
  required int layerIndex,
  required int traitCount,
  required Uint8List weights,
}) {
  final instructionData = SetExclusiveLayerInstructionData(
    layerIndex: layerIndex,
    traitCount: traitCount,
    weights: weights,
  );

  return Instruction(
    programAddress: programAddress,
    accounts: [
      AccountMeta(address: admin, role: AccountRole.readonlySigner),
      AccountMeta(address: exclusiveCollection, role: AccountRole.writable),
    ],
    data: getSetExclusiveLayerInstructionDataEncoder().encode(instructionData),
  );
}

/// Parses a [SetExclusiveLayer] instruction from raw instruction data.
SetExclusiveLayerInstructionData parseSetExclusiveLayerInstruction(
  Instruction instruction,
) {
  return getSetExclusiveLayerInstructionDataDecoder().decode(instruction.data!);
}
