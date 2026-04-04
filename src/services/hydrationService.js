/**
 * @file hydrationService.js
 * @description Dehydration Detection Engine — Sigmoid HR-to-CBT Strain Model.
 *
 * Upgrade §6.1: The HR-to-CBT relationship under thermal/hydration strain is
 * non-linear. We use the inverted Epstein-Roberts sigmoid:
 *   HR = 41 + 152·(1 + 0.06·e^{-0.89·(CBT-37.84)})^{1/0.07}
 * Predict CBT from HR, compare to measured CBT.
 * If measured > predicted → thermoregulation failing → dehydration.
 *
 * medianStrainDev thresholds:
 *   < 0.05  → LOW_RISK
 *   < 0.15  → MILD_RISK
 *   ≥ 0.15  → HIGH_RISK
 *
 * NOTE: `epochs` here must include `avgCBT` and `avgHR` fields,
 * which are stored on each epoch by sleepStageService.classifySleepStages().
 */

const AGE_CBT_OFFSET = {
  child: 0.10, teen: 0.05, young: 0.0, mid: -0.05, older: -0.10, elderly: -0.15,
};

/**
 * Predicts the expected Core Body Temperature for a given heart rate using
 * the inverted Epstein-Roberts sigmoid model.
 *
 * @param {number} hr        - Raw heart rate in BPM
 * @param {string} ageGroup  - Age group key (e.g. 'young', 'older')
 * @returns {number|null}    - Predicted CBT in °C, or null if calculation fails
 */
const predictedCBTFromHR = (hr, ageGroup = 'young') => {
  try {
    const offset = AGE_CBT_OFFSET[ageGroup.toLowerCase()] ?? 0;
    const hrAdj = Math.max(hr - 41, 0.5) / 152;
    const inner = Math.pow(hrAdj, 0.07) - 1;
    if (inner <= 0) return null;
    const logVal = Math.log(inner / 0.06);
    return (37.84 - logVal / 0.89) + offset;
  } catch {
    return null;
  }
};

/**
 * Assesses nocturnal hydration strain from classified sleep epochs.
 *
 * Each epoch in `epochs` must have:
 *   - `avgCBT`  (number) — mean CBT of the 30-sec epoch window
 *   - `avgHR`   (number) — mean heart rate of the 30-sec epoch window
 *
 * These fields are populated by sleepStageService.classifySleepStages().
 *
 * @param {Array}  epochs    - Classified epoch objects from the stage engine
 * @param {string} ageGroup  - Age group key for CBT offset adjustment
 * @returns {{ hydration_status: string, medianStrainDev: number, indicators: object }}
 */
const assessHydration = (epochs, ageGroup = 'young') => {
  const strainDevs = epochs
    .map((e) => {
      // Use the raw averages stored on the epoch by sleepStageService
      const hr        = e.avgHR;
      const measured  = e.avgCBT;

      if (hr == null || measured == null) return null;

      const predicted = predictedCBTFromHR(hr, ageGroup);
      return predicted !== null ? measured - predicted : null;
    })
    .filter((v) => v !== null);

  if (strainDevs.length === 0) {
    return { hydration_status: 'LOW_RISK', medianStrainDev: 0, indicators: {} };
  }

  const sorted          = [...strainDevs].sort((a, b) => a - b);
  const medianStrainDev = sorted[Math.floor(sorted.length / 2)];

  let hydration_status;
  if (medianStrainDev >= 0.15)      hydration_status = 'HIGH_RISK';
  else if (medianStrainDev >= 0.05) hydration_status = 'MILD_RISK';
  else                               hydration_status = 'LOW_RISK';

  return {
    hydration_status,
    medianStrainDev: parseFloat(medianStrainDev.toFixed(4)),
    indicators: {
      sigmoidStrainExceeded: medianStrainDev >= 0.05,
      strainLevel:           medianStrainDev.toFixed(4),
    },
  };
};

module.exports = { assessHydration, predictedCBTFromHR };
