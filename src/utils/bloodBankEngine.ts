export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export const ALL_BLOOD_GROUPS: BloodGroup[] = [
  'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'
];

export type ComponentType = 'Whole Blood' | 'Packed RBC' | 'Platelets' | 'Fresh Frozen Plasma';

export interface BloodBagUnit {
  id: string;
  bloodGroup: BloodGroup;
  component: ComponentType;
  volumeMl: number;
  collectionDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  storageUnit: string; // e.g. "Cold-Vault R1", "Platelet Agitator P2"
  temperatureC: number;
  facility: string;
  status: 'Available' | 'Reserved' | 'Quarantined' | 'Dispatched';
  donorId: string;
}

export interface DonorRecord {
  id: string;
  fullName: string;
  bloodGroup: BloodGroup;
  age: number;
  lastDonationDate: string; // YYYY-MM-DD
  hemoglobinGdL: number;
  distanceKm: number;
  pastDonationsCount: number;
  responseRatePct: number; // 0-100
  preferredWindow: 'Morning (08:00-12:00)' | 'Afternoon (12:00-17:00)' | 'Evening (17:00-20:00)' | 'Weekend Only';
  district: string;
  contactPhone: string;
  recallStatus: 'Eligible' | 'Recall Sent' | 'Confirmed' | 'In Recovery';
}

export interface DonorPredictionResult {
  donorId: string;
  fullName: string;
  bloodGroup: BloodGroup;
  daysSinceLastDonation: number;
  isMedicallyEligible: boolean;
  availabilityScore: number; // 0 - 100
  readinessTier: 'High Readiness' | 'Moderate Readiness' | 'Cooldown Period';
  recommendedOutreachSlot: string;
  predictedTurnoutDays: number;
  rationale: string;
}

export interface FacilityNode {
  id: string;
  name: string;
  departmentType: 'Central Blood Bank' | 'Trauma & Emergency' | 'Cardiac & Surgical ICU' | 'Oncology & Hematology' | 'Maternity & Neonatal' | 'Regional Partner Hospital';
  location: string;
  distanceKm: number;
  stockByGroup: Record<BloodGroup, number>;
  dailyDemandByGroup: Record<BloodGroup, number>;
  targetDaysOfSupply: number;
  expiringWithin7DaysByGroup: Record<BloodGroup, number>;
}

export interface TransferRecommendation {
  id: string;
  sourceFacilityId: string;
  sourceFacilityName: string;
  targetFacilityId: string;
  targetFacilityName: string;
  bloodGroup: BloodGroup;
  unitsToTransfer: number;
  priority: 'Critical Deficit' | 'Expiry Prevention' | 'Buffer Rebalance';
  estimatedTransitMinutes: number;
  wastagePreventedUnits: number;
  postTransferTargetDaysCover: number;
  rationale: string;
  status: 'Recommended' | 'In Transit' | 'Completed';
}

export interface HospitalRequisition {
  id: string;
  patientName: string;
  patientId: string;
  ward: string;
  hospitalName: string;
  requestedGroup: BloodGroup;
  component: ComponentType;
  unitsRequested: number;
  urgency: 'STAT (Immediate)' | 'Urgent (< 2 hrs)' | 'Routine';
  attendingPhysician: string;
  requestedAt: string;
  status: 'Pending Cross-Match' | 'Cross-Matched' | 'Fulfilled';
  assignedUnitIds: string[];
}

export interface GroupSummaryMetric {
  bloodGroup: BloodGroup;
  availableUnits: number;
  reservedUnits: number;
  expiringSoonUnits: number; // <= 7 days
  targetThreshold: number;
  daysOfSupply: number;
  stockStatus: 'Critical' | 'Low' | 'Optimal' | 'Surplus';
}

/**
 * Red Blood Cell compatibility matrix:
 * Returns compatible donor blood groups for a given recipient blood group,
 * ordered from exact match first to universal fallback (O-).
 */
export function getCompatibleDonorGroups(recipient: BloodGroup): BloodGroup[] {
  const map: Record<BloodGroup, BloodGroup[]> = {
    'O-': ['O-'],
    'O+': ['O+', 'O-'],
    'A-': ['A-', 'O-'],
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'AB-': ['AB-', 'A-', 'B-', 'O-'],
    'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
  };
  return map[recipient];
}

/**
 * Calculates days between two YYYY-MM-DD dates (target - reference).
 */
export function diffDays(targetDateStr: string, referenceDateStr: string): number {
  const t = new Date(targetDateStr + 'T00:00:00Z').getTime();
  const r = new Date(referenceDateStr + 'T00:00:00Z').getTime();
  return Math.round((t - r) / (1000 * 60 * 60 * 24));
}

/**
 * Computes aggregated inventory health metrics across all 8 blood groups.
 */
export function computeInventorySummary(
  units: BloodBagUnit[],
  referenceDate: string,
  dailyBurnRates: Record<BloodGroup, number> = {
    'O-': 3.5,
    'O+': 6.0,
    'A-': 2.0,
    'A+': 5.5,
    'B-': 1.5,
    'B+': 4.5,
    'AB-': 1.0,
    'AB+': 2.5,
  }
): GroupSummaryMetric[] {
  return ALL_BLOOD_GROUPS.map((bloodGroup) => {
    const groupUnits = units.filter((u) => u.bloodGroup === bloodGroup);
    const available = groupUnits.filter((u) => u.status === 'Available');
    const reserved = groupUnits.filter((u) => u.status === 'Reserved');

    const expiringSoon = available.filter((u) => {
      const daysLeft = diffDays(u.expiryDate, referenceDate);
      return daysLeft >= 0 && daysLeft <= 7;
    });

    const dailyRate = Math.max(0.5, dailyBurnRates[bloodGroup] || 2.0);
    const targetThreshold = Math.ceil(dailyRate * 5); // 5-day safety baseline
    const daysOfSupply = Number((available.length / dailyRate).toFixed(1));

    let stockStatus: GroupSummaryMetric['stockStatus'] = 'Optimal';
    if (available.length <= Math.ceil(targetThreshold * 0.45)) {
      stockStatus = 'Critical';
    } else if (available.length < targetThreshold) {
      stockStatus = 'Low';
    } else if (available.length >= Math.ceil(targetThreshold * 1.7)) {
      stockStatus = 'Surplus';
    }

    return {
      bloodGroup,
      availableUnits: available.length,
      reservedUnits: reserved.length,
      expiringSoonUnits: expiringSoon.length,
      targetThreshold,
      daysOfSupply,
      stockStatus,
    };
  });
}

/**
 * Predicts donor availability likelihood using clinical eligibility criteria
 * (minimum 56 days recovery for whole blood, Hb >= 12.5 g/dL), historical
 * response rate, proximity to hospital, and donation regularity.
 */
export function predictDonorAvailability(
  donors: DonorRecord[],
  referenceDate: string
): DonorPredictionResult[] {
  return donors
    .map((donor) => {
      const daysSince = Math.max(0, diffDays(referenceDate, donor.lastDonationDate));
      const recoveryPassed = daysSince >= 56;
      const hbPassed = donor.hemoglobinGdL >= 12.5;
      const isMedicallyEligible = recoveryPassed && hbPassed;

      let score = 0;
      if (!isMedicallyEligible) {
        // Partial score reflecting how close they are to eligibility
        const recoveryRatio = Math.min(1, daysSince / 56);
        const hbRatio = Math.min(1, donor.hemoglobinGdL / 12.5);
        score = Math.round(recoveryRatio * hbRatio * 38);
      } else {
        // Weighted clinical & behavioral availability model (40..99)
        const recencyBonus = Math.min(20, Math.round((daysSince - 56) / 6));
        const responseComponent = Math.round(donor.responseRatePct * 0.42);
        const proximityComponent = Math.max(0, Math.round((25 - Math.min(25, donor.distanceKm)) * 0.9));
        const loyaltyComponent = Math.min(15, donor.pastDonationsCount * 2);
        const hbMarginBonus = donor.hemoglobinGdL >= 13.8 ? 6 : 3;

        score = Math.min(
          99,
          Math.max(42, 18 + recencyBonus + responseComponent + proximityComponent + loyaltyComponent + hbMarginBonus)
        );
      }

      let readinessTier: DonorPredictionResult['readinessTier'] = 'Cooldown Period';
      if (isMedicallyEligible && score >= 75) {
        readinessTier = 'High Readiness';
      } else if (isMedicallyEligible) {
        readinessTier = 'Moderate Readiness';
      }

      const cooldownRemaining = Math.max(0, 56 - daysSince);
      const predictedTurnoutDays = isMedicallyEligible
        ? Math.max(1, Math.round((100 - score) / 14) + (donor.distanceKm > 12 ? 1 : 0))
        : cooldownRemaining + 2;

      const rationale = isMedicallyEligible
        ? `${daysSince}d post-donation · Hb ${donor.hemoglobinGdL.toFixed(1)} g/dL · ${donor.responseRatePct}% historical response · ${donor.distanceKm.toFixed(1)} km from hospital`
        : !recoveryPassed
          ? `In 56-day clinical recovery (${cooldownRemaining}d remaining) · Last donated ${daysSince}d ago`
          : `Hemoglobin below 12.5 g/dL threshold (${donor.hemoglobinGdL.toFixed(1)} g/dL) · Iron supplementation advised`;

      return {
        donorId: donor.id,
        fullName: donor.fullName,
        bloodGroup: donor.bloodGroup,
        daysSinceLastDonation: daysSince,
        isMedicallyEligible,
        availabilityScore: score,
        readinessTier,
        recommendedOutreachSlot: donor.preferredWindow,
        predictedTurnoutDays,
        rationale,
      };
    })
    .sort((a, b) => b.availabilityScore - a.availabilityScore);
}

/**
 * Optimizes blood inventory distribution across hospital wards and regional partner facilities.
 * Solves two coupled objectives:
 * 1. Prevent wastage of units expiring within 7 days at low-burn facilities by routing them to high-burn trauma/ICU centers.
 * 2. Rebalance acute stock deficits (< targetDaysOfSupply) from surplus facilities while retaining safety buffers.
 */
export function optimizeInventoryDistribution(
  facilities: FacilityNode[]
): TransferRecommendation[] {
  const recommendations: TransferRecommendation[] = [];
  // Clone mutable stock and expiry maps so multiple transfers don't double-spend units
  const workingStock: Record<string, Record<BloodGroup, number>> = {};
  const workingExpiring: Record<string, Record<BloodGroup, number>> = {};

  for (const fac of facilities) {
    workingStock[fac.id] = { ...fac.stockByGroup };
    workingExpiring[fac.id] = { ...fac.expiringWithin7DaysByGroup };
  }

  let seq = 1;

  for (const group of ALL_BLOOD_GROUPS) {
    // Pass 1: Expiry Prevention (facilities holding expiring units exceeding their 3-day burn)
    for (const source of facilities) {
      const expCount = workingExpiring[source.id][group] || 0;
      const threeDayBurn = Math.ceil((source.dailyDemandByGroup[group] || 0.5) * 3);
      const excessExpiring = expCount - threeDayBurn;

      if (excessExpiring > 0) {
        // Find facility with highest daily burn rate for this blood group that can absorb before expiry
        const candidates = facilities
          .filter((f) => f.id !== source.id && (f.dailyDemandByGroup[group] || 0) >= 1.5)
          .sort((a, b) => b.dailyDemandByGroup[group] - a.dailyDemandByGroup[group]);

        if (candidates.length > 0) {
          const target = candidates[0];
          const safeTransfer = Math.min(
            excessExpiring,
            Math.max(1, workingStock[source.id][group] - threeDayBurn)
          );

          if (safeTransfer > 0) {
            workingStock[source.id][group] -= safeTransfer;
            workingExpiring[source.id][group] -= safeTransfer;
            workingStock[target.id][group] += safeTransfer;

            const distanceDelta = Math.max(3, Math.abs(target.distanceKm - source.distanceKm));
            const transitMins = Math.round(12 + distanceDelta * 2.2);
            const postCover = Number(
              (workingStock[target.id][group] / Math.max(0.5, target.dailyDemandByGroup[group])).toFixed(1)
            );

            recommendations.push({
              id: `TR-OPT-${String(seq++).padStart(3, '0')}`,
              sourceFacilityId: source.id,
              sourceFacilityName: source.name,
              targetFacilityId: target.id,
              targetFacilityName: target.name,
              bloodGroup: group,
              unitsToTransfer: safeTransfer,
              priority: 'Expiry Prevention',
              estimatedTransitMinutes: transitMins,
              wastagePreventedUnits: safeTransfer,
              postTransferTargetDaysCover: postCover,
              rationale: `Prevents expiration of ${safeTransfer} ${group} unit(s) within 7 days by routing to high-turnover ${target.name} (${target.dailyDemandByGroup[group].toFixed(1)} u/day).`,
              status: 'Recommended',
            });
          }
        }
      }
    }

    // Pass 2: Critical Deficit & Buffer Rebalance
    const deficitFacilities = facilities
      .filter((f) => {
        const current = workingStock[f.id][group];
        const daily = Math.max(0.5, f.dailyDemandByGroup[group]);
        const daysCover = current / daily;
        return daysCover < f.targetDaysOfSupply * 0.75;
      })
      .sort((a, b) => {
        const coverA = workingStock[a.id][group] / Math.max(0.5, a.dailyDemandByGroup[group]);
        const coverB = workingStock[b.id][group] / Math.max(0.5, b.dailyDemandByGroup[group]);
        return coverA - coverB;
      });

    for (const target of deficitFacilities) {
      const targetDaily = Math.max(0.5, target.dailyDemandByGroup[group]);
      const neededUnits = Math.max(
        1,
        Math.ceil(target.targetDaysOfSupply * targetDaily - workingStock[target.id][group])
      );

      // Find donor facility with surplus above its target days of supply
      const donors = facilities
        .filter((f) => {
          if (f.id === target.id) return false;
          const donorDaily = Math.max(0.5, f.dailyDemandByGroup[group]);
          const keepBuffer = Math.ceil(donorDaily * f.targetDaysOfSupply);
          return workingStock[f.id][group] > keepBuffer;
        })
        .sort((a, b) => {
          const surplusA =
            workingStock[a.id][group] - Math.ceil(a.dailyDemandByGroup[group] * a.targetDaysOfSupply);
          const surplusB =
            workingStock[b.id][group] - Math.ceil(b.dailyDemandByGroup[group] * b.targetDaysOfSupply);
          return surplusB - surplusA;
        });

      for (const donor of donors) {
        const donorDaily = Math.max(0.5, donor.dailyDemandByGroup[group]);
        const keepBuffer = Math.ceil(donorDaily * donor.targetDaysOfSupply);
        const availableSurplus = workingStock[donor.id][group] - keepBuffer;

        if (availableSurplus <= 0) continue;

        const transferQty = Math.min(neededUnits, availableSurplus);
        if (transferQty <= 0) continue;

        const preCover = workingStock[target.id][group] / targetDaily;
        workingStock[donor.id][group] -= transferQty;
        workingStock[target.id][group] += transferQty;

        const postCover = Number((workingStock[target.id][group] / targetDaily).toFixed(1));
        const distanceDelta = Math.max(2, Math.abs(target.distanceKm - donor.distanceKm));
        const transitMins = Math.round(10 + distanceDelta * 2.1);

        recommendations.push({
          id: `TR-OPT-${String(seq++).padStart(3, '0')}`,
          sourceFacilityId: donor.id,
          sourceFacilityName: donor.name,
          targetFacilityId: target.id,
          targetFacilityName: target.name,
          bloodGroup: group,
          unitsToTransfer: transferQty,
          priority: preCover < 2.0 ? 'Critical Deficit' : 'Buffer Rebalance',
          estimatedTransitMinutes: transitMins,
          wastagePreventedUnits: Math.min(transferQty, workingExpiring[donor.id][group] || 0),
          postTransferTargetDaysCover: postCover,
          rationale: `Restores ${target.name} ${group} reserve from ${preCover.toFixed(1)}d to ${postCover}d cover using surplus from ${donor.name}.`,
          status: 'Recommended',
        });

        break;
      }
    }
  }

  const priorityOrder: Record<TransferRecommendation['priority'], number> = {
    'Critical Deficit': 0,
    'Expiry Prevention': 1,
    'Buffer Rebalance': 2,
  };

  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Selects optimal compatible blood bags to fulfill a hospital requisition using FEFO
 * (First-Expired, First-Out) while preferring exact blood group match before compatible fallbacks.
 */
export function selectUnitsForRequisition(
  units: BloodBagUnit[],
  requestedGroup: BloodGroup,
  unitsNeeded: number,
  referenceDate: string
): BloodBagUnit[] {
  const compatibleGroups = getCompatibleDonorGroups(requestedGroup);
  const eligiblePool = units.filter(
    (u) =>
      u.status === 'Available' &&
      compatibleGroups.includes(u.bloodGroup) &&
      diffDays(u.expiryDate, referenceDate) >= 0
  );

  eligiblePool.sort((a, b) => {
    const groupRankA = compatibleGroups.indexOf(a.bloodGroup);
    const groupRankB = compatibleGroups.indexOf(b.bloodGroup);
    if (groupRankA !== groupRankB) return groupRankA - groupRankB;
    // FEFO: earliest expiry first
    return a.expiryDate.localeCompare(b.expiryDate);
  });

  return eligiblePool.slice(0, unitsNeeded);
}

export type DemandScenario = 'standard' | 'seasonal_surge' | 'trauma_surge';

export interface OptimalInventoryLevelRecommendation {
  bloodGroup: BloodGroup;
  currentAvailable: number;
  expiringWithin7Days: number;
  effectiveUsableStock: number;
  forecastDailyDemand: number;
  safetyBufferUnits: number;
  recommendedOptimalPar: number;
  netVarianceUnits: number; // currentAvailable - recommendedOptimalPar
  expiryRiskUnits: number; // units likely to expire before being consumed
  recommendedStrategy: 'Urgent Inbound & Recall' | 'Route Expiring Surplus' | 'Replenish Buffer' | 'Optimal Par Maintained';
  departmentAllocationPlan: string;
}

/**
 * Calculates recommended optimal inventory par levels for each blood group
 * by combining current stock, 7-day expiry attrition, and forecasted department demand.
 */
export function calculateOptimalInventoryLevels(
  units: BloodBagUnit[],
  facilities: FacilityNode[],
  referenceDate: string,
  scenario: DemandScenario = 'standard',
  horizonDays: number = 7
): OptimalInventoryLevelRecommendation[] {
  const scenarioMultiplier =
    scenario === 'trauma_surge' ? 1.35 : scenario === 'seasonal_surge' ? 1.2 : 1.0;

  return ALL_BLOOD_GROUPS.map((group) => {
    // Aggregate across all connected hospital facilities + central depository
    const facilityStockSum = facilities.reduce(
      (sum, f) => sum + (f.stockByGroup[group] || 0),
      0
    );
    const unitAvailableCount = units.filter(
      (u) => u.bloodGroup === group && u.status === 'Available'
    ).length;

    const currentAvailable = Math.max(facilityStockSum, unitAvailableCount);

    const facilityExpiringSum = facilities.reduce(
      (sum, f) => sum + (f.expiringWithin7DaysByGroup[group] || 0),
      0
    );
    const unitExpiringCount = units.filter((u) => {
      if (u.bloodGroup !== group || u.status !== 'Available') return false;
      const d = diffDays(u.expiryDate, referenceDate);
      return d >= 0 && d <= 7;
    }).length;

    const expiringWithin7Days = Math.max(facilityExpiringSum, unitExpiringCount);

    const baseDailyDemand = facilities.reduce(
      (sum, f) => sum + (f.dailyDemandByGroup[group] || 0),
      0
    );
    const forecastDailyDemand = Number((Math.max(1.0, baseDailyDemand) * scenarioMultiplier).toFixed(1));

    // Units that can be consumed within 7 days vs expiring within 7 days
    const sevenDayConsumption = Math.floor(forecastDailyDemand * 7);
    const expiryRiskUnits = Math.max(0, expiringWithin7Days - sevenDayConsumption);
    const effectiveUsableStock = Math.max(0, currentAvailable - expiryRiskUnits);

    // Safety buffer = 3 days of demand (4 days for universal O-)
    const safetyDays = group === 'O-' || group === 'O+' ? 4 : 3;
    const safetyBufferUnits = Math.ceil(forecastDailyDemand * safetyDays);

    // Optimal Par Level = horizon demand + 40% of safety buffer
    const recommendedOptimalPar = Math.ceil(
      forecastDailyDemand * Math.min(horizonDays, 7) + safetyBufferUnits * 0.4
    );

    const netVarianceUnits = currentAvailable - recommendedOptimalPar;

    let recommendedStrategy: OptimalInventoryLevelRecommendation['recommendedStrategy'] =
      'Optimal Par Maintained';
    if (expiryRiskUnits > 0 || (expiringWithin7Days >= 5 && netVarianceUnits > 0)) {
      recommendedStrategy = 'Route Expiring Surplus';
    } else if (currentAvailable <= safetyBufferUnits) {
      recommendedStrategy = 'Urgent Inbound & Recall';
    } else if (netVarianceUnits < 0) {
      recommendedStrategy = 'Replenish Buffer';
    }

    // Identify highest-need department for this blood group
    const sortedDepts = [...facilities].sort((a, b) => {
      const coverA = (a.stockByGroup[group] || 0) / Math.max(0.5, a.dailyDemandByGroup[group] || 0.5);
      const coverB = (b.stockByGroup[group] || 0) / Math.max(0.5, b.dailyDemandByGroup[group] || 0.5);
      return coverA - coverB;
    });
    const priorityDept = sortedDepts[0]?.name || 'Emergency Trauma & Surgical ICU';

    const departmentAllocationPlan =
      recommendedStrategy === 'Route Expiring Surplus'
        ? `Rotate ${expiringWithin7Days} near-expiry ${group} units to ${priorityDept} for immediate FEFO utilization.`
        : recommendedStrategy === 'Urgent Inbound & Recall'
          ? `Prioritize ${priorityDept} reserve; trigger ${Math.abs(netVarianceUnits)} u donor recall & inter-ward transfer.`
          : recommendedStrategy === 'Replenish Buffer'
            ? `Schedule +${Math.abs(netVarianceUnits)} u replenishment to ${priorityDept} before surgical peak.`
            : `Maintain current cold-chain allocation across ${priorityDept} and satellite clinics.`;

    return {
      bloodGroup: group,
      currentAvailable,
      expiringWithin7Days,
      effectiveUsableStock,
      forecastDailyDemand,
      safetyBufferUnits,
      recommendedOptimalPar,
      netVarianceUnits,
      expiryRiskUnits,
      recommendedStrategy,
      departmentAllocationPlan,
    };
  });
}

