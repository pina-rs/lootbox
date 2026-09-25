import 'dart:typed_data';

import 'package:lootbox_program_client/lootbox_program.dart';
import 'package:solana_kit_addresses/solana_kit_addresses.dart';
import 'package:solana_kit_instructions/solana_kit_instructions.dart';
import 'package:test/test.dart';

const program = Address('11111111111111111111111111111111');
const fixed = Address('LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E');
const placeholder = Address('7RmhMqtG3kB4JqQKkTQNdMhPDox4ErAoXPiNiPtwJ1hV');

Instruction instruction(List<AccountMeta>? accounts) => Instruction(
  programAddress: program,
  accounts: accounts,
  data: Uint8List.fromList(<int>[1]),
);

void main() {
  test('replaces the generated placeholder with zero or many proof nodes', () {
    final base = instruction(const <AccountMeta>[
      AccountMeta(address: fixed, role: AccountRole.writableSigner),
      AccountMeta(address: placeholder, role: AccountRole.readonly),
    ]);

    expect(
      withBubblegumProofAccounts(base, const <Address>[]).accounts,
      <AccountMeta>[
        const AccountMeta(address: fixed, role: AccountRole.writableSigner),
      ],
    );
    final expanded = withBubblegumProofAccounts(base, const <Address>[
      placeholder,
      program,
    ]);
    expect(expanded.accounts, <AccountMeta>[
      const AccountMeta(address: fixed, role: AccountRole.writableSigner),
      const AccountMeta(address: placeholder, role: AccountRole.readonly),
      const AccountMeta(address: program, role: AccountRole.readonly),
    ]);
  });

  test('rejects missing placeholders and oversized proofs', () {
    expect(
      () => withBubblegumProofAccounts(instruction(null), const <Address>[]),
      throwsStateError,
    );
    expect(
      () => withBubblegumProofAccounts(
        instruction(const <AccountMeta>[
          AccountMeta(address: placeholder, role: AccountRole.readonly),
        ]),
        List<Address>.filled(maxBubblegumProofAccounts + 1, fixed),
      ),
      throwsRangeError,
    );
  });
}
