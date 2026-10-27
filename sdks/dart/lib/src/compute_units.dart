// Compute-unit budgets for lootbox transactions.
//
// The measured figures come from the deterministic Surfpool journeys in
// `docs/performance.md` and are pinned across the TypeScript, Dart, and Rust
// planners by `tests/vectors/compute-units.json`. The journeys use fixture
// keys whose canonical bumps sit near 255; real keys can land further down the
// bump search and shift an instruction by thousands of units, so the budget
// applies a generous margin. Priority fees are charged on the compute units a
// transaction consumes, never on the requested limit, so the margin only
// guards against limit exhaustion.

/// Multiplier applied to the summed measured compute units.
const int computeUnitMarginMultiplier = 2;

/// Flat compute units added after the multiplier.
const int computeUnitMarginAddend = 10000;

/// Lowest compute-unit limit the policy ever requests.
const int computeUnitMinimum = 50000;

/// Highest compute-unit limit the policy ever requests, under the 1.4M cap.
const int computeUnitMaximum = 1398000;

/// Measured compute units per lootbox instruction, keyed by instruction name.
const Map<String, int> measuredComputeUnits = {
  'activateBundle': 6000,
  'addBundle': 6590,
  'allocatePrizePoolOpen': 19497,
  'allocateTemplateOpen': 21204,
  'appendExclusiveTree': 115407,
  'attachExclusiveNft': 13663,
  'buyCurveBoxes': 11369,
  'cancelBundle': 3813,
  'cancelPrizePoolItem': 7564,
  'claimCoreAssetPrize': 12135,
  'claimExclusiveNft': 125489,
  'claimMintPrize': 13525,
  'claimPrizePoolItem': 15249,
  'claimSolPrize': 5469,
  'claimStrandedPrizePoolItem': 20434,
  'claimTokenPrize': 15025,
  'closeBoxCurve': 10490,
  'closePrizePool': 5767,
  'closeServiceVault': 5359,
  'closeTemplateOpening': 7642,
  'createExclusiveCollection': 23905,
  'createPrizePool': 15002,
  'createTemplate': 11931,
  'depositPrizePoolItem': 14979,
  'forfeitTemplateOpen': 8997,
  'fulfillTemplateOpen': 13579,
  'fundCoreAssetPrize': 10246,
  'fundMintPrize': 5338,
  'fundQuoteSolPrize': 5097,
  'fundQuoteTokenPrize': 8559,
  'fundSolPrize': 5098,
  'fundTokenPrize': 8639,
  'lockTreasury': 11693,
  'mintTemplateBoxes': 7379,
  'openBoxCurve': 11654,
  'preparePrizePoolItem': 14874,
  'publishExclusiveCollection': 21409,
  'reclaimCoreAssetPrize': 10654,
  'reclaimExclusiveFees': 9328,
  'reclaimMintPrize': 5615,
  'reclaimPrizePoolItem': 15504,
  'reclaimSolPrize': 4297,
  'reclaimTokenPrize': 13422,
  'requestTemplateOpen': 23972,
  'retireTemplate': 2328,
  'sealPrizePool': 6170,
  'sealTemplate': 2172,
  'sellCurveBoxes': 9014,
  'setExclusiveLayer': 3231,
};

/// Apply the shared margin policy to a summed measured budget.
int computeUnitLimitForSum(int summedUnits) {
  final scaled =
      summedUnits * computeUnitMarginMultiplier + computeUnitMarginAddend;

  return scaled < computeUnitMinimum
      ? computeUnitMinimum
      : (scaled > computeUnitMaximum ? computeUnitMaximum : scaled);
}

/// Compute-unit limit for one transaction of lootbox instructions, or `null`
/// when the caller must not set a limit: the transaction is empty or names an
/// instruction outside the measured tables.
int? computeUnitLimitByNames(List<String> names) {
  if (names.isEmpty) return null;

  var sum = 0;

  for (final name in names) {
    final units = measuredComputeUnits[name];

    if (units == null) return null;

    sum += units;
  }

  return computeUnitLimitForSum(sum);
}
