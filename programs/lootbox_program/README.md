# lootbox_program

The `no_std` Pina program behind the Lootbox primitive.

Use the repository-level Devenv tasks so the program, test oracle, generated clients, and Surfpool environment stay synchronized:

```sh
build:program
generate:clients
test:unit
test:surfpool
lint:all
```

The standalone program ID is `LootKCMiRgk7jcfJiydzgdjEu4WkPce3WdPwepB8J2E`. Protocol architecture, instructions, and security assumptions are documented in the root [`docs`](../../docs) directory.
