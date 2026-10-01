import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_instructions/solana_kit_instructions.dart';

/// Largest proof tail accepted by the on-chain Bubblegum adapter.
const int maxBubblegumProofAccounts = 16;

/// Replaces the scalar placeholder emitted for a Pina `remaining` account with
/// the real Bubblegum proof. Empty proofs are valid for full-canopy trees.
Instruction withBubblegumProofAccounts(
  Instruction instruction,
  Iterable<Address> proofAccounts,
) {
  final proof = List<Address>.unmodifiable(proofAccounts);
  if (proof.length > maxBubblegumProofAccounts) {
    throw RangeError.range(
      proof.length,
      0,
      maxBubblegumProofAccounts,
      'proofAccounts',
    );
  }
  final accounts = instruction.accounts;
  if (accounts == null || accounts.isEmpty) {
    throw StateError('instruction has no generated proof placeholder');
  }
  return Instruction(
    programAddress: instruction.programAddress,
    accounts: <AccountMeta>[
      ...accounts.take(accounts.length - 1),
      for (final address in proof)
        AccountMeta(address: address, role: AccountRole.readonly),
    ],
    data: instruction.data,
  );
}
