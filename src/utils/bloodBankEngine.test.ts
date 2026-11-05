import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCompatibleDonorGroups,
  computeInventorySummary,
  predictDonorAvailability,
  optimizeInventoryDistribution,
  selectUnitsForRequisition,
  type BloodBagUnit,
  type DonorRecord,
  type FacilityNode,
} from './bloodBankEngine';

test('getCompatibleDonorGroups enforces exact match first and O- universal fallback', () => {
  assert.deepEqual(getCompatibleDonorGroups('O-'), ['O-']);
  assert.deepEqual(getCompatibleDonorGroups('A-'), ['A-', 'O-']);
  const abPlus = getCompatibleDonorGroups('AB+');
  assert.equal(abPlus[0], 'AB+');
  assert.equal(abPlus[abPlus.length - 1], 'O-');
  assert.equal(abPlus.length, 8);
});

test('computeInventorySummary flags Critical, Optimal, and Expiring Soon units accurately', () => {
  const sampleUnits: BloodBagUnit[] = [
    {
      id: 'BAG-101',
      bloodGroup: 'O-',
      component: 'Packed RBC',
      volumeMl: 350,
      collectionDate: '2026-10-05',
      expiryDate: '2026-11-08', // 3 days from 2026-11-05 -> expiring soon
      storageUnit: 'Cold-Vault R1',
      temperatureC: 3.8,
      facility: 'KLE Central Blood Bank',
      status: 'Available',
      donorId: 'DNR-01',
    },
  ];

  const summary = computeInventorySummary(sampleUnits, '2026-11-05');
  const oNeg = summary.find((s) => s.bloodGroup === 'O-');
  assert.ok(oNeg);
  assert.equal(oNeg.availableUnits, 1);
  assert.equal(oNeg.expiringSoonUnits, 1);
  assert.equal(oNeg.stockStatus, 'Critical');
});

test('predictDonorAvailability respects 56-day recovery and hemoglobin thresholds', () => {
  const donors: DonorRecord[] = [
    {
      id: 'D1',
      fullName: 'Aarav Kulkarni',
      bloodGroup: 'O-',
      age: 29,
      lastDonationDate: '2026-07-10', // > 100 days ago -> eligible
      hemoglobinGdL: 14.4,
      distanceKm: 3.2,
      pastDonationsCount: 7,
      responseRatePct: 94,
      preferredWindow: 'Morning (08:00-12:00)',
      district: 'Chikodi',
      contactPhone: '+91 98450 11223',
      recallStatus: 'Eligible',
    },
    {
      id: 'D2',
      fullName: 'Rohan Patil',
      bloodGroup: 'O-',
      age: 34,
      lastDonationDate: '2026-10-20', // 16 days ago -> in recovery cooldown
      hemoglobinGdL: 13.9,
      distanceKm: 2.5,
      pastDonationsCount: 5,
      responseRatePct: 90,
      preferredWindow: 'Evening (17:00-20:00)',
      district: 'Chikodi',
      contactPhone: '+91 98450 44556',
      recallStatus: 'In Recovery',
    },
  ];

  const predictions = predictDonorAvailability(donors, '2026-11-05');
  assert.equal(predictions.length, 2);
  assert.equal(predictions[0].donorId, 'D1');
  assert.equal(predictions[0].isMedicallyEligible, true);
  assert.equal(predictions[0].readinessTier, 'High Readiness');
  assert.ok(predictions[0].availabilityScore >= 80);

  assert.equal(predictions[1].donorId, 'D2');
  assert.equal(predictions[1].isMedicallyEligible, false);
  assert.equal(predictions[1].readinessTier, 'Cooldown Period');
  assert.ok(predictions[1].availabilityScore < 40);
});

test('optimizeInventoryDistribution resolves critical hospital deficits and prevents expiry wastage', () => {
  const emptyMap = { 'O-': 0, 'O+': 0, 'A-': 0, 'A+': 0, 'B-': 0, 'B+': 0, 'AB-': 0, 'AB+': 0 };
  const facilities: FacilityNode[] = [
    {
      id: 'FAC-CENTRAL',
      name: 'KLE Central Blood Depository',
      departmentType: 'Central Blood Bank',
      location: 'Campus Core',
      distanceKm: 0,
      stockByGroup: { ...emptyMap, 'O-': 24, 'A+': 30 },
      dailyDemandByGroup: { ...emptyMap, 'O-': 2, 'A+': 3 },
      targetDaysOfSupply: 5,
      expiringWithin7DaysByGroup: { ...emptyMap, 'A+': 14 },
    },
    {
      id: 'FAC-TRAUMA',
      name: 'Emergency Trauma & Surgical ICU',
      departmentType: 'Trauma & Emergency',
      location: 'East Wing',
      distanceKm: 4.5,
      stockByGroup: { ...emptyMap, 'O-': 2, 'A+': 8 },
      dailyDemandByGroup: { ...emptyMap, 'O-': 4, 'A+': 5 },
      targetDaysOfSupply: 5,
      expiringWithin7DaysByGroup: { ...emptyMap },
    },
  ];

  const transfers = optimizeInventoryDistribution(facilities);
  assert.ok(transfers.length >= 2);
  const oNegTransfer = transfers.find((t) => t.bloodGroup === 'O-');
  assert.ok(oNegTransfer);
  assert.equal(oNegTransfer.priority, 'Critical Deficit');
  assert.equal(oNegTransfer.sourceFacilityId, 'FAC-CENTRAL');
  assert.equal(oNegTransfer.targetFacilityId, 'FAC-TRAUMA');
  assert.ok(oNegTransfer.unitsToTransfer >= 10);

  const aPlusExpiryTransfer = transfers.find((t) => t.bloodGroup === 'A+' && t.priority === 'Expiry Prevention');
  assert.ok(aPlusExpiryTransfer);
  assert.ok(aPlusExpiryTransfer.wastagePreventedUnits > 0);
});

test('selectUnitsForRequisition prioritizes exact blood group and FEFO earliest expiry', () => {
  const pool: BloodBagUnit[] = [
    {
      id: 'BAG-O-NEG',
      bloodGroup: 'O-',
      component: 'Packed RBC',
      volumeMl: 350,
      collectionDate: '2026-10-01',
      expiryDate: '2026-11-07',
      storageUnit: 'Cold-Vault R1',
      temperatureC: 3.5,
      facility: 'Central',
      status: 'Available',
      donorId: 'D1',
    },
    {
      id: 'BAG-A-LATER',
      bloodGroup: 'A+',
      component: 'Packed RBC',
      volumeMl: 350,
      collectionDate: '2026-10-15',
      expiryDate: '2026-11-22',
      storageUnit: 'Cold-Vault R1',
      temperatureC: 3.5,
      facility: 'Central',
      status: 'Available',
      donorId: 'D2',
    },
    {
      id: 'BAG-A-SOONER',
      bloodGroup: 'A+',
      component: 'Packed RBC',
      volumeMl: 350,
      collectionDate: '2026-10-02',
      expiryDate: '2026-11-09',
      storageUnit: 'Cold-Vault R1',
      temperatureC: 3.5,
      facility: 'Central',
      status: 'Available',
      donorId: 'D3',
    },
  ];

  const selected = selectUnitsForRequisition(pool, 'A+', 2, '2026-11-05');
  assert.equal(selected.length, 2);
  assert.equal(selected[0].id, 'BAG-A-SOONER');
  assert.equal(selected[1].id, 'BAG-A-LATER');
});

test('calculateOptimalInventoryLevels computes recommended par levels and scales with trauma surge', async () => {
  const { calculateOptimalInventoryLevels } = await import('./bloodBankEngine');
  const emptyMap = { 'O-': 0, 'O+': 0, 'A-': 0, 'A+': 0, 'B-': 0, 'B+': 0, 'AB-': 0, 'AB+': 0 };
  const facilities: FacilityNode[] = [
    {
      id: 'FAC-1',
      name: 'Trauma ICU',
      departmentType: 'Trauma & Emergency',
      location: 'East Wing',
      distanceKm: 1.5,
      stockByGroup: { ...emptyMap, 'O-': 4, 'A+': 35 },
      dailyDemandByGroup: { ...emptyMap, 'O-': 4.0, 'A+': 2.0 },
      targetDaysOfSupply: 5,
      expiringWithin7DaysByGroup: { ...emptyMap, 'O-': 0, 'A+': 18 },
    },
  ];

  const standardRecs = calculateOptimalInventoryLevels([], facilities, '2026-11-05', 'standard', 7);
  const traumaRecs = calculateOptimalInventoryLevels([], facilities, '2026-11-05', 'trauma_surge', 7);

  const oNegStd = standardRecs.find((r) => r.bloodGroup === 'O-')!;
  const oNegTrauma = traumaRecs.find((r) => r.bloodGroup === 'O-')!;
  assert.equal(oNegStd.recommendedStrategy, 'Urgent Inbound & Recall');
  assert.ok(oNegTrauma.recommendedOptimalPar > oNegStd.recommendedOptimalPar);

  const aPlusStd = standardRecs.find((r) => r.bloodGroup === 'A+')!;
  assert.equal(aPlusStd.recommendedStrategy, 'Route Expiring Surplus');
  assert.ok(aPlusStd.expiryRiskUnits > 0);
});

