/**
 * @file ageThresholdsService.js
 * @description Age-Based Threshold Anchor Engine (6-Group Thesis Model).
 *
 * Provides physiological threshold anchors based on six demographic
 * age groups per the thesis specification. Used by the sleep stage
 * engine to normalize sensor deviations against adaptive baselines.
 *
 * Age Groups (Thesis §2.2):
 *   - CHILD   : ≤ 12
 *   - TEEN    : 13–19
 *   - YOUNG   : 20–39  (Default)
 *   - MID     : 40–59
 *   - OLDER   : 60–75
 *   - ELDERLY : > 75
 */

const THRESHOLDS = {
  child: {
    CBT_drop_th:  0.25,
    HR_drop_th:   7,
    RR_range:     2.5,
    Skin_rise_th: 0.4,
    Move_th:      0.07,
  },
  teen: {
    CBT_drop_th:  0.30,
    HR_drop_th:   6,
    RR_range:     2.3,
    Skin_rise_th: 0.50,
    Move_th:      0.07,
  },
  young: {
    CBT_drop_th:  0.40,
    HR_drop_th:   5,
    RR_range:     2.0,
    Skin_rise_th: 0.65,
    Move_th:      0.05,
  },
  mid: {
    CBT_drop_th:  0.30,
    HR_drop_th:   4,
    RR_range:     2.2,
    Skin_rise_th: 0.55,
    Move_th:      0.085,
  },
  older: {
    CBT_drop_th:  0.25,
    HR_drop_th:   3.5,
    RR_range:     2.5,
    Skin_rise_th: 0.45,
    Move_th:      0.085,
  },
  elderly: {
    CBT_drop_th:  0.20,
    HR_drop_th:   3,
    RR_range:     2.8,
    Skin_rise_th: 0.35,
    Move_th:      0.10,
  },
};

const getAgeGroup = (age) => {
  if (age <= 12) return 'CHILD';
  if (age <= 19) return 'TEEN';
  if (age <= 39) return 'YOUNG';
  if (age <= 59) return 'MID';
  if (age <= 75) return 'OLDER';
  return 'ELDERLY';
};

const getThresholds = (age) => {
  const group = getAgeGroup(age).toLowerCase();
  return { ageGroup: getAgeGroup(age), ...THRESHOLDS[group] };
};

module.exports = { getThresholds, getAgeGroup, THRESHOLDS };
