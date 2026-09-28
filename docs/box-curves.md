# Box curves

Status: implemented and tested on local Surfpool. This is an experimental development build, not an independently audited mainnet release.

## Product

Once a lootbox is locked, its creator decides how the boxes reach people. There are two ways, and they combine:

1. **Airdrop.** The creator sends boxes to a list of wallets and pays the network cost of each delivery. Boxes are plain Token-2022 tokens, so this is a batch of transfers; no program instruction is involved.
2. **Box curve.** The creator deposits some of the boxes into a bonding curve. Anyone can buy boxes from it, and anyone holding a box can sell one back, until the curve sells out. Each box costs a little more than the one before, so the price finds its level as people trade.

A curve sells whole boxes on a straight line:

```text
price(k) = start_price + price_step × k      (k = boxes the curve has sold, from 0)
```

Buying `n` boxes when `s` are sold costs `price(s) + … + price(s + n − 1)`. Selling `n` back when `s` are sold returns `price(s − n) + … + price(s − 1)`: exactly what the most recent buyers paid for those positions. The curve's SOL reserve therefore always equals the sum of the sold positions, so every sold box can always be bought back until trading ends.

```text
reserve = price(0) + price(1) + … + price(sold − 1)
```

A creator fee, at most 5%, is added to every buy and taken from every sell. It goes straight to the creator's wallet and never touches the reserve. Fees round up to the next lamport.

## Lifecycle

```text
Locked lootbox --openBoxCurve (inventory ≥ 20)--> Trading
Trading --buy / sell--> Trading
Trading --last box bought--> Sold out: reserve paid to the creator, buybacks end
Trading --reveal time passes--> Closed to trading
Sold out, closed, or nothing sold --closeBoxCurve--> reserve and unsold boxes returned, accounts closed
```

- **Opening a curve** requires a locked, live lootbox whose reveal time is still in the future, and at least `MIN_CURVE_INVENTORY` (20) boxes. With fewer boxes there's nothing to discover: the "curve" is just a short price list. The creator's boxes move into a token account owned by the curve PDA. A creator can run one curve per lootbox at a time and keep the rest of the supply to airdrop.
- **Trading** runs until the curve sells out or the lootbox's reveal time arrives, whichever is first. At reveal, boxes become openable and each draw changes what the remaining boxes are worth, which a count-based price cannot see. So trading closes and price discovery happens before anyone opens.
- **Selling out** is the threshold. The buy that takes the last box pays the whole reserve to the creator in the same transaction. There is no inventory left to sell back into, so buybacks end. Anyone can trigger this, including the creator. For the creator, buying the last boxes costs only fees, because the price comes straight back as reserve, so graduation is really "the creator can end the sale once most of it has sold".
- **Closing** is creator-signed. It is allowed once the curve has sold out, once trading has closed at reveal, or at any time while nothing is sold. It pays any reserve to the creator, returns every box left in the curve's token account to the creator, and closes the curve's token account and state account, refunding their rent.

Boxes a buyer holds are ordinary boxes. They open after the reveal time like any other and can be transferred or sold anywhere. Boxes still inside a curve cannot open, because no one can sign for the PDA. A lootbox's prizes stay escrowed exactly as before: a curve never touches the treasury.

## Accounts and instructions

| Account           | Seeds                                               | Holds                                                                                                                                                  |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BoxCurveState`   | `["box-curve", template]`                           | template, box mint, creator, inventory, sold, start price, price step, reserve, trading deadline (the lootbox's reveal time), sold-out time, fee, bump |
| Curve box account | the curve PDA's Token-2022 associated token account | the unsold inventory                                                                                                                                   |

| Discriminator | Instruction      | Signer  | Effect                                                                                                                    |
| ------------- | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `60`          | `openBoxCurve`   | creator | Creates the curve and moves `inventory` boxes from the creator into the curve's token account.                            |
| `61`          | `buyCurveBoxes`  | buyer   | Pays `cost` into the curve and `fee` to the creator, receives `count` boxes. Fails if the total exceeds `maxLamports`.    |
| `62`          | `sellCurveBoxes` | seller  | Returns `count` boxes to the curve and receives `proceeds − fee`, paying `fee` to the creator. Fails below `minLamports`. |
| `63`          | `closeBoxCurve`  | creator | Pays out any reserve, returns unsold boxes, and closes both curve accounts.                                               |

Buyers may direct boxes to any Token-2022 account for the box mint, so buying a box for a friend is one transaction. The curve's own token account is refused as a destination and a source.

Every buy and sell emits a `BoxCurveTraded` event with the trader, count, lamports moved, fee, and the resulting sold count, so a page can draw the trade feed and the price history from transaction logs.

## Parameters

| Constant                | Value            | Why                                                                                  |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `MIN_CURVE_INVENTORY`   | 20 boxes         | Below this there are too few steps for a price to form.                              |
| `MIN_CURVE_START_PRICE` | 100,000 lamports | A curve is a sale. A zero or dust price lets one wallet sweep the curve for nothing. |
| `MAX_CURVE_FEE_BPS`     | 500 (5%)         | Caps the round-trip cost of a buy and sell at about 10%.                             |

The total reserve at sell-out, `inventory × start_price + price_step × inventory × (inventory − 1) / 2`, must fit in a `u64`.

## Invariants

- `sold ≤ inventory`, and only a buy increases `sold`.
- While trading, `reserve == Σ price(k) for k < sold`, and the curve account holds at least `reserve` plus its rent-exempt minimum.
- A sell of `n` requires `n ≤ sold`, so buybacks are always covered. Boxes that arrive from outside the curve, for example airdropped ones, can be sold into it only up to the sold count. Any wallet selling before a buyer moves the price down for everyone, as in any bonding curve.
- After sell-out, `reserve == 0` and no buy or sell succeeds.
- A closed curve's leftover boxes return to the creator, never to the treasury. Supply is unchanged, so the lootbox's odds and its reclaim rules are exactly as if the creator had kept those boxes.

## Planners and shared vectors

The Rust, TypeScript, and Dart SDKs each expose the same pure functions:

- `curvePrice(startPrice, priceStep, position)`
- `curveCost(startPrice, priceStep, from, count)` using the closed form `count × start + step × count × (2·from + count − 1) / 2`
- `curveFee(lamports, feeBps)`
- `quoteCurveBuy` and `quoteCurveSell`, which return cost, fee, total, and the next price
- `planBoxCurve`, which validates parameters and derives the price step from a start and end price

`tests/vectors/box-curve.json` holds worked quotes and rejected plans that all three SDKs and the program's unit tests replay.

The Rust SDK uses the snake_case equivalents: `curve_price`, `curve_cost`, `curve_fee`, `quote_curve_buy`, `quote_curve_sell`, and `plan_box_curve`.

## Compliance note

A curve sells a chance at prizes for money. In many places, including the United Kingdom, that is a lottery or gambling, and it needs a licence or an exemption. The protocol does not decide who may trade. The web platform keeps curves behind a feature flag (`FEATURE_BOX_CURVES`) so an operator can offer them only where they are lawful.
