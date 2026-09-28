/// Box-curve pricing, matching the program's `buyCurveBoxes` and
/// `sellCurveBoxes` to the lamport.
///
/// The box at sold position `k` costs `startPrice + priceStep * k`. Pinned by
/// `tests/vectors/box-curve.json`, which the program and the Rust and
/// TypeScript SDKs share.
library;

final BigInt _maxU64 = (BigInt.one << 64) - BigInt.one;
final BigInt _two = BigInt.two;
final BigInt _bpsDenominator = BigInt.from(10000);

/// Fewest boxes a curve may sell.
final BigInt minCurveInventory = BigInt.from(20);

/// Cheapest allowed first box, in lamports.
final BigInt minCurveStartPrice = BigInt.from(100000);

/// Highest creator fee on each buy and sell, in basis points.
const int maxCurveFeeBps = 500;

/// Terms the program would reject, or a trade outside the inventory.
final class BoxCurveException implements Exception {
  const BoxCurveException(this.message);

  final String message;

  @override
  String toString() => 'BoxCurveException: $message';
}

/// The terms and live position of a curve.
final class BoxCurve {
  const BoxCurve({
    required this.inventory,
    required this.sold,
    required this.startPrice,
    required this.priceStep,
    required this.feeBps,
  });

  final BigInt inventory;
  final BigInt sold;
  final BigInt startPrice;
  final BigInt priceStep;
  final int feeBps;
}

/// A priced buy or sell.
final class CurveQuote {
  const CurveQuote({
    required this.lamports,
    required this.fee,
    required this.total,
    required this.soldAfter,
    required this.nextPrice,
  });

  /// The curve price of the boxes moved.
  final BigInt lamports;
  final BigInt fee;

  /// What the buyer pays (`lamports + fee`) or the seller receives
  /// (`lamports - fee`).
  final BigInt total;
  final BigInt soldAfter;

  /// The next box's price after the trade, or `null` once sold out.
  final BigInt? nextPrice;
}

/// Terms for a new curve, derived from a first and last price.
final class BoxCurvePlan {
  const BoxCurvePlan({
    required this.inventory,
    required this.startPrice,
    required this.priceStep,
    required this.endPrice,
    required this.feeBps,
    required this.sellOutLamports,
  });

  final BigInt inventory;
  final BigInt startPrice;

  /// Whole lamports per box; the end price floors to a whole step.
  final BigInt priceStep;

  /// The last box's price after flooring.
  final BigInt endPrice;
  final int feeBps;

  /// What the creator receives when every box sells, before fees.
  final BigInt sellOutLamports;
}

BigInt _checked(BigInt value) {
  if (value.isNegative || value > _maxU64) {
    throw const BoxCurveException('curve amount is outside the u64 range');
  }

  return value;
}

/// Price of the box at sold position [position].
BigInt curvePrice(BigInt startPrice, BigInt priceStep, BigInt position) =>
    _checked(startPrice + priceStep * position);

/// Total price of [count] consecutive positions starting at [from].
BigInt curveCost(
  BigInt startPrice,
  BigInt priceStep,
  BigInt from,
  BigInt count,
) {
  if (count == BigInt.zero) return BigInt.zero;

  final positions = count * (_two * from + count - BigInt.one) ~/ _two;

  return _checked(count * startPrice + priceStep * positions);
}

/// Creator fee on a curve amount, rounded up to the next lamport.
BigInt curveFee(BigInt lamports, int feeBps) =>
    (lamports * BigInt.from(feeBps) + _bpsDenominator - BigInt.one) ~/
    _bpsDenominator;

BigInt? _nextPrice(BoxCurve curve, BigInt soldAfter) =>
    soldAfter == curve.inventory
    ? null
    : curvePrice(curve.startPrice, curve.priceStep, soldAfter);

/// Prices a buy of [count] boxes.
CurveQuote quoteCurveBuy(BoxCurve curve, BigInt count) {
  final soldAfter = curve.sold + count;

  if (count <= BigInt.zero || soldAfter > curve.inventory) {
    throw BoxCurveException(
      'cannot buy $count of the ${curve.inventory - curve.sold} boxes left',
    );
  }

  final lamports = curveCost(
    curve.startPrice,
    curve.priceStep,
    curve.sold,
    count,
  );
  final fee = curveFee(lamports, curve.feeBps);

  return CurveQuote(
    lamports: lamports,
    fee: fee,
    total: _checked(lamports + fee),
    soldAfter: soldAfter,
    nextPrice: _nextPrice(curve, soldAfter),
  );
}

/// Prices a sale of [count] boxes back to the curve.
CurveQuote quoteCurveSell(BoxCurve curve, BigInt count) {
  final soldAfter = curve.sold - count;

  if (count <= BigInt.zero || soldAfter.isNegative) {
    throw BoxCurveException(
      'cannot sell $count boxes back when ${curve.sold} are sold',
    );
  }

  final lamports = curveCost(
    curve.startPrice,
    curve.priceStep,
    soldAfter,
    count,
  );
  final fee = curveFee(lamports, curve.feeBps);

  return CurveQuote(
    lamports: lamports,
    fee: fee,
    total: lamports - fee,
    soldAfter: soldAfter,
    nextPrice: _nextPrice(curve, soldAfter),
  );
}

/// Plans a curve from the first and last box prices, mirroring the checks in
/// `openBoxCurve`.
BoxCurvePlan planBoxCurve({
  required BigInt inventory,
  required BigInt startPrice,
  required BigInt endPrice,
  required int feeBps,
}) {
  if (inventory < minCurveInventory) {
    throw BoxCurveException(
      'a curve needs at least $minCurveInventory boxes to find a price',
    );
  }
  if (startPrice < minCurveStartPrice) {
    throw BoxCurveException(
      'the first box must cost at least $minCurveStartPrice lamports',
    );
  }
  if (endPrice < startPrice) {
    throw const BoxCurveException(
      'the last box cannot cost less than the first',
    );
  }
  if (feeBps < 0 || feeBps > maxCurveFeeBps) {
    throw const BoxCurveException(
      'the fee must be 0 to $maxCurveFeeBps basis points',
    );
  }

  final priceStep = (endPrice - startPrice) ~/ (inventory - BigInt.one);
  final sellOutLamports = curveCost(
    startPrice,
    priceStep,
    BigInt.zero,
    inventory,
  );
  _checked(sellOutLamports + curveFee(sellOutLamports, feeBps));

  return BoxCurvePlan(
    inventory: inventory,
    startPrice: startPrice,
    priceStep: priceStep,
    endPrice: curvePrice(startPrice, priceStep, inventory - BigInt.one),
    feeBps: feeBps,
    sellOutLamports: sellOutLamports,
  );
}
