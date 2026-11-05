import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Moon, Sun } from 'lucide-react';
import {
  ALL_BLOOD_GROUPS,
  computeInventorySummary,
  optimizeInventoryDistribution,
  type BloodBagUnit,
  type BloodGroup,
  type ComponentType,
  type DonorRecord,
  type FacilityNode,
  type HospitalRequisition,
  type TransferRecommendation,
} from './utils/bloodBankEngine';
import {
  REFERENCE_DATE,
  INITIAL_BLOOD_UNITS,
  INITIAL_DONORS,
  INITIAL_FACILITIES,
  INITIAL_REQUISITIONS,
} from './data/seedData';
import { OverviewAndInventoryView } from './components/OverviewAndInventoryView';
import { DonorForecastView } from './components/DonorForecastView';
import { DistributionOptimizerView } from './components/DistributionOptimizerView';
import { RequisitionsView } from './components/RequisitionsView';
import { HospitalFooter } from './components/HospitalFooter';

type ActiveTab = 'overview' | 'donors' | 'distribution' | 'requisitions';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isNightShift, setIsNightShift] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hemopulse_night_shift') === 'true';
    } catch {
      return false;
    }
  });
  const [units, setUnits] = useState<BloodBagUnit[]>(INITIAL_BLOOD_UNITS);
  const [donors, setDonors] = useState<DonorRecord[]>(INITIAL_DONORS);
  const [facilities, setFacilities] = useState<FacilityNode[]>(INITIAL_FACILITIES);
  const [requisitions, setRequisitions] = useState<HospitalRequisition[]>(INITIAL_REQUISITIONS);
  const [dispatchedTransfers, setDispatchedTransfers] = useState<TransferRecommendation[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<BloodGroup | 'ALL'>('ALL');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Sync Tailwind 'dark' class on document.documentElement for Night Shift mode
  useEffect(() => {
    const root = document.documentElement;
    if (isNightShift) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('hemopulse_night_shift', String(isNightShift));
    } catch {
      // Ignore storage errors in restricted frames
    }
  }, [isNightShift]);

  // Log New Blood Bag Unit Modal state
  const [showLogUnitModal, setShowLogUnitModal] = useState(false);
  const [newBagGroup, setNewBagGroup] = useState<BloodGroup>('O-');
  const [newBagComponent, setNewBagComponent] = useState<ComponentType>('Packed RBC');
  const [newBagVolume, setNewBagVolume] = useState('350');
  const [newBagDonorId, setNewBagDonorId] = useState('DNR-101');
  const [newBagVault, setNewBagVault] = useState('Cold-Vault R1 (2–6°C)');
  const [newBagFacility, setNewBagFacility] = useState('KLE Central Blood Depository');
  const [newBagExpiry, setNewBagExpiry] = useState('2026-12-10');
  const [logBagError, setLogBagError] = useState<string | null>(null);

  const summaryMetrics = useMemo(
    () => computeInventorySummary(units, REFERENCE_DATE),
    [units]
  );

  const transferRecommendations = useMemo(
    () => optimizeInventoryDistribution(facilities),
    [facilities]
  );

  const pendingRequisitionsCount = useMemo(
    () => requisitions.filter((r) => r.status === 'Pending Cross-Match').length,
    [requisitions]
  );

  const showNotice = (msg: string) => {
    setStatusBanner(msg);
  };

  const handleUpdateUnitStatus = (unitId: string, nextStatus: BloodBagUnit['status']) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === unitId ? { ...u, status: nextStatus } : u))
    );
    showNotice(`Blood bag ${unitId} status updated to ${nextStatus}.`);
  };

  const handleLogNewUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBagDonorId.trim() || !newBagExpiry.trim()) {
      setLogBagError('Donor ID and Expiration Date are required.');
      return;
    }
    const vol = Number(newBagVolume);
    if (Number.isNaN(vol) || vol < 100 || vol > 600) {
      setLogBagError('Bag volume must be between 100 mL and 600 mL.');
      return;
    }

    const nextId = `BAG-2611-${String(units.length + 801)}`;
    const newUnit: BloodBagUnit = {
      id: nextId,
      bloodGroup: newBagGroup,
      component: newBagComponent,
      volumeMl: vol,
      collectionDate: REFERENCE_DATE,
      expiryDate: newBagExpiry,
      storageUnit: newBagVault,
      temperatureC: newBagComponent === 'Platelets' ? 22.0 : 3.7,
      facility: newBagFacility,
      status: 'Available',
      donorId: newBagDonorId.trim(),
    };

    setUnits((prev) => [newUnit, ...prev]);

    setFacilities((prev) =>
      prev.map((f) => {
        if (f.name !== newBagFacility) return f;
        return {
          ...f,
          stockByGroup: {
            ...f.stockByGroup,
            [newBagGroup]: (f.stockByGroup[newBagGroup] || 0) + 1,
          },
        };
      })
    );

    setLogBagError(null);
    setShowLogUnitModal(false);
    showNotice(`Logged new ${newBagGroup} (${newBagComponent}) unit ${nextId} into ${newBagFacility}.`);
  };

  const handleTriggerRecall = (donorId: string) => {
    const target = donors.find((d) => d.id === donorId);
    setDonors((prev) =>
      prev.map((d) => (d.id === donorId ? { ...d, recallStatus: 'Recall Sent' } : d))
    );
    if (target) {
      showNotice(
        `Recall SMS & appointment link dispatched to ${target.fullName} (${target.bloodGroup}) for ${target.preferredWindow}.`
      );
    }
  };

  const handleAddDonor = (newDonorData: Omit<DonorRecord, 'id' | 'recallStatus'>) => {
    const newId = `DNR-${111 + donors.length}`;
    const created: DonorRecord = {
      ...newDonorData,
      id: newId,
      recallStatus: 'Eligible',
    };
    setDonors((prev) => [created, ...prev]);
    showNotice(`Registered donor ${created.fullName} (${created.bloodGroup}) with ID ${newId}.`);
  };

  const handleApproveTransfer = (transfer: TransferRecommendation) => {
    setFacilities((prev) =>
      prev.map((fac) => {
        if (fac.id === transfer.sourceFacilityId) {
          const currentStock = fac.stockByGroup[transfer.bloodGroup] || 0;
          const currentExp = fac.expiringWithin7DaysByGroup[transfer.bloodGroup] || 0;
          return {
            ...fac,
            stockByGroup: {
              ...fac.stockByGroup,
              [transfer.bloodGroup]: Math.max(0, currentStock - transfer.unitsToTransfer),
            },
            expiringWithin7DaysByGroup: {
              ...fac.expiringWithin7DaysByGroup,
              [transfer.bloodGroup]: Math.max(0, currentExp - transfer.wastagePreventedUnits),
            },
          };
        }
        if (fac.id === transfer.targetFacilityId) {
          const currentStock = fac.stockByGroup[transfer.bloodGroup] || 0;
          return {
            ...fac,
            stockByGroup: {
              ...fac.stockByGroup,
              [transfer.bloodGroup]: currentStock + transfer.unitsToTransfer,
            },
          };
        }
        return fac;
      })
    );

    setDispatchedTransfers((prev) => [
      { ...transfer, status: 'In Transit' },
      ...prev,
    ]);
    showNotice(
      `Dispatched ${transfer.unitsToTransfer} × ${transfer.bloodGroup} from ${transfer.sourceFacilityName} to ${transfer.targetFacilityName}.`
    );
  };

  const handleApproveAllTransfers = () => {
    const currentBatch = [...transferRecommendations];
    if (currentBatch.length === 0) return;

    setFacilities((prev) => {
      const next = prev.map((f) => ({
        ...f,
        stockByGroup: { ...f.stockByGroup },
        expiringWithin7DaysByGroup: { ...f.expiringWithin7DaysByGroup },
      }));

      for (const tr of currentBatch) {
        const src = next.find((f) => f.id === tr.sourceFacilityId);
        const dst = next.find((f) => f.id === tr.targetFacilityId);
        if (src && dst) {
          src.stockByGroup[tr.bloodGroup] = Math.max(
            0,
            (src.stockByGroup[tr.bloodGroup] || 0) - tr.unitsToTransfer
          );
          src.expiringWithin7DaysByGroup[tr.bloodGroup] = Math.max(
            0,
            (src.expiringWithin7DaysByGroup[tr.bloodGroup] || 0) - tr.wastagePreventedUnits
          );
          dst.stockByGroup[tr.bloodGroup] =
            (dst.stockByGroup[tr.bloodGroup] || 0) + tr.unitsToTransfer;
        }
      }
      return next;
    });

    setDispatchedTransfers((prev) => [
      ...currentBatch.map((t) => ({ ...t, status: 'In Transit' as const })),
      ...prev,
    ]);
    showNotice(`Approved and dispatched all ${currentBatch.length} inter-hospital transfer routes.`);
  };

  const handleFulfillRequisition = (reqId: string, assignedBagIds: string[]) => {
    setRequisitions((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? { ...r, status: 'Fulfilled', assignedUnitIds: assignedBagIds }
          : r
      )
    );
    setUnits((prev) =>
      prev.map((u) =>
        assignedBagIds.includes(u.id) ? { ...u, status: 'Dispatched' } : u
      )
    );
    showNotice(
      `Requisition ${reqId} cross-matched and fulfilled with ${assignedBagIds.length} unit(s): ${assignedBagIds.join(', ')}.`
    );
  };

  const handleCreateRequisition = (
    newReqData: Omit<HospitalRequisition, 'id' | 'requestedAt' | 'status' | 'assignedUnitIds'>
  ) => {
    const newId = `REQ-2611-${885 + requisitions.length}`;
    const created: HospitalRequisition = {
      ...newReqData,
      id: newId,
      requestedAt: '2026-11-05 09:30',
      status: 'Pending Cross-Match',
      assignedUnitIds: [],
    };
    setRequisitions((prev) => [created, ...prev]);
    showNotice(
      `Logged ${created.urgency} requisition ${newId} for ${created.unitsRequested} × ${created.requestedGroup} (${created.ward}).`
    );
  };

  return (
    <div
      data-theme={isNightShift ? 'night-shift' : 'day-shift'}
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isNightShift ? 'dark text-slate-100' : 'text-slate-900'
      }`}
    >
      {/* Top Bar Contract: Zone 1 (1-line Brand) — Zone 2 (4 single-line Nav Links) — Zone 3 (1 Primary CTA) */}
      <header className="skeuo-panel border-t-0 border-x-0">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 py-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            HemoPulse Clinical
          </a>

          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'overview'
                  ? 'text-slate-900 dark:text-white font-bold border-rose-600 dark:border-rose-500'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Inventory Reserve
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('donors')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'donors'
                  ? 'text-slate-900 dark:text-white font-bold border-rose-600 dark:border-rose-500'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Donor Forecast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('distribution')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'distribution'
                  ? 'text-slate-900 dark:text-white font-bold border-rose-600 dark:border-rose-500'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Distribution Optimizer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('requisitions')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'requisitions'
                  ? 'text-slate-900 dark:text-white font-bold border-rose-600 dark:border-rose-500'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ward Requisitions
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowLogUnitModal(true)}
              className="px-4 py-2 text-xs font-semibold skeuo-btn-primary rounded-xl whitespace-nowrap shrink-0"
            >
              + Log Blood Unit
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Cross-Device Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden bg-slate-100/90 dark:bg-slate-900/95 border-b border-slate-300 dark:border-slate-800 px-4 py-2.5 flex items-center gap-2 overflow-x-auto"
      >
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
            activeTab === 'overview'
              ? 'skeuo-btn-dark text-white'
              : 'skeuo-btn-metal text-slate-700 dark:text-slate-200'
          }`}
        >
          Inventory Reserve
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('donors')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
            activeTab === 'donors'
              ? 'skeuo-btn-dark text-white'
              : 'skeuo-btn-metal text-slate-700 dark:text-slate-200'
          }`}
        >
          Donor Forecast
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('distribution')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
            activeTab === 'distribution'
              ? 'skeuo-btn-dark text-white'
              : 'skeuo-btn-metal text-slate-700 dark:text-slate-200'
          }`}
        >
          Distribution Optimizer
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('requisitions')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 ${
            activeTab === 'requisitions'
              ? 'skeuo-btn-dark text-white'
              : 'skeuo-btn-metal text-slate-700 dark:text-slate-200'
          }`}
        >
          Ward Requisitions ({pendingRequisitionsCount})
        </button>
      </nav>

      {/* Main Clinical Workspace */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Contextual Workspace Header, Night Shift Toggle & Institutional Kicker */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span>KLE Hospital Transfusion Network</span>
              <span aria-hidden="true">·</span>
              <span>AI Donor Forecasting &amp; Cold-Chain Distribution</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Ref Date: {REFERENCE_DATE}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {activeTab === 'overview' && 'Hospital Blood Reserve & Cold-Chain Command'}
              {activeTab === 'donors' && 'AI Donor Availability & Turnout Prediction'}
              {activeTab === 'distribution' && 'Multi-Ward & Regional Inventory Distribution Optimizer'}
              {activeTab === 'requisitions' && 'Emergency & Ward Cross-Match Requisition Queue'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <div className="flex flex-wrap items-center gap-2">
              <span>Cold-Chain: <strong className="font-mono text-emerald-700 dark:text-emerald-400">2.0°C–6.0°C Nominal</strong></span>
              <span aria-hidden="true">·</span>
              <span>Pending Requisitions: <strong className="font-mono text-slate-900 dark:text-white">{pendingRequisitionsCount}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Optimization Routes: <strong className="font-mono text-rose-700 dark:text-rose-400">{transferRecommendations.length}</strong></span>
            </div>

            {/* Tactile 3D Night Shift Toggle Button */}
            <button
              type="button"
              onClick={() => setIsNightShift((prev) => !prev)}
              aria-pressed={isNightShift}
              aria-label={isNightShift ? 'Switch to Day Shift theme' : 'Switch to Night Shift dark theme'}
              data-testid="night-shift-toggle"
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                isNightShift
                  ? 'skeuo-btn-dark text-amber-300'
                  : 'skeuo-btn-metal text-slate-800'
              }`}
            >
              {isNightShift ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  <span>Night Shift Active</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                  <span>Night Shift Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Action Feedback Banner */}
        {statusBanner && (
          <div
            role="status"
            aria-live="polite"
            className="p-3.5 rounded-2xl skeuo-panel bg-emerald-50/90 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-xs text-emerald-950 dark:text-emerald-200 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold">{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="px-2.5 py-1 text-xs font-semibold skeuo-btn-metal rounded-lg whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active View Content with SwiftUI Spring Animation */}
        <div key={activeTab} className="swift-view-enter">
          {activeTab === 'overview' && (
            <OverviewAndInventoryView
              units={units}
              summaryMetrics={summaryMetrics}
              referenceDate={REFERENCE_DATE}
              selectedGroupFilter={selectedGroupFilter}
              onSelectGroupFilter={setSelectedGroupFilter}
              onOpenLogUnitModal={() => setShowLogUnitModal(true)}
              onUpdateUnitStatus={handleUpdateUnitStatus}
              onNavigateTab={setActiveTab}
              pendingRequisitionsCount={pendingRequisitionsCount}
              recommendedTransfersCount={transferRecommendations.length}
            />
          )}

          {activeTab === 'donors' && (
            <DonorForecastView
              donors={donors}
              summaryMetrics={summaryMetrics}
              referenceDate={REFERENCE_DATE}
              onTriggerRecall={handleTriggerRecall}
              onAddDonor={handleAddDonor}
            />
          )}

          {activeTab === 'distribution' && (
            <DistributionOptimizerView
              units={units}
              referenceDate={REFERENCE_DATE}
              facilities={facilities}
              transferRecommendations={transferRecommendations}
              dispatchedTransfers={dispatchedTransfers}
              onApproveTransfer={handleApproveTransfer}
              onApproveAllTransfers={handleApproveAllTransfers}
            />
          )}

          {activeTab === 'requisitions' && (
            <RequisitionsView
              requisitions={requisitions}
              units={units}
              referenceDate={REFERENCE_DATE}
              onFulfillRequisition={handleFulfillRequisition}
              onCreateRequisition={handleCreateRequisition}
            />
          )}
        </div>
      </main>

      {/* Log New Blood Bag Unit Modal */}
      {showLogUnitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-unit-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="skeuo-panel rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h2 id="log-unit-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Log Sterile Blood Bag Unit into Cold-Chain Reserve
              </h2>
              <button
                type="button"
                onClick={() => setShowLogUnitModal(false)}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                Close
              </button>
            </div>

            {logBagError && (
              <div role="alert" className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{logBagError}</span>
              </div>
            )}

            <form onSubmit={handleLogNewUnit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bag-group" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    ABO / Rh Blood Group
                  </label>
                  <select
                    id="bag-group"
                    value={newBagGroup}
                    onChange={(e) => setNewBagGroup(e.target.value as BloodGroup)}
                    className="w-full px-3 py-2 skeuo-input rounded-lg text-slate-900 dark:text-white font-mono"
                  >
                    {ALL_BLOOD_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="bag-component" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Component Type
                  </label>
                  <select
                    id="bag-component"
                    value={newBagComponent}
                    onChange={(e) => setNewBagComponent(e.target.value as ComponentType)}
                    className="w-full px-3 py-2 skeuo-input rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Packed RBC">Packed RBC</option>
                    <option value="Whole Blood">Whole Blood</option>
                    <option value="Platelets">Platelets</option>
                    <option value="Fresh Frozen Plasma">Fresh Frozen Plasma</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="bag-volume" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Volume (mL)
                  </label>
                  <input
                    id="bag-volume"
                    type="number"
                    min={100}
                    max={600}
                    value={newBagVolume}
                    onChange={(e) => setNewBagVolume(e.target.value)}
                    className="w-full px-3 py-2 skeuo-input rounded-lg text-slate-900 dark:text-white tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="bag-donor-id" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Verified Donor ID
                  </label>
                  <input
                    id="bag-donor-id"
                    type="text"
                    required
                    value={newBagDonorId}
                    onChange={(e) => setNewBagDonorId(e.target.value)}
                    className="w-full px-3 py-2 skeuo-input rounded-lg text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="bag-vault" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cold-Chain Storage Unit
                  </label>
                  <select
                    id="bag-vault"
                    value={newBagVault}
                    onChange={(e) => setNewBagVault(e.target.value)}
                    className="w-full px-3 py-2 skeuo-input rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Cold-Vault R1 (2–6°C)">Cold-Vault R1 (2–6°C)</option>
                    <option value="Cold-Vault R2 (2–6°C)">Cold-Vault R2 (2–6°C)</option>
                    <option value="Trauma Sub-Vault T1">Trauma Sub-Vault T1</option>
                    <option value="Platelet Agitator P1 (22°C)">Platelet Agitator P1 (22°C)</option>
                    <option value="Cryo-Freezer F1 (-30°C)">Cryo-Freezer F1 (-30°C)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="bag-expiry" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Expiration Date
                  </label>
                  <input
                    id="bag-expiry"
                    type="date"
                    required
                    value={newBagExpiry}
                    onChange={(e) => setNewBagExpiry(e.target.value)}
                    className="w-full px-3 py-2 skeuo-input rounded-lg text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bag-facility" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Receiving Hospital Depository
                </label>
                <select
                  id="bag-facility"
                  value={newBagFacility}
                  onChange={(e) => setNewBagFacility(e.target.value)}
                  className="w-full px-3 py-2 skeuo-input rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="KLE Central Blood Depository">KLE Central Blood Depository</option>
                  <option value="Emergency Trauma & Surgical ICU">Emergency Trauma &amp; Surgical ICU</option>
                  <option value="Maternity & Neonatal Care Center">Maternity &amp; Neonatal Care Center</option>
                  <option value="Regional Oncology & Dialysis Unit">Regional Oncology &amp; Dialysis Unit</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowLogUnitModal(false)}
                  className="px-4 py-2 text-xs font-semibold skeuo-btn-metal rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold skeuo-btn-primary rounded-xl"
                >
                  Confirm &amp; Add to Reserve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Hospital Footer at the very bottom of the project */}
      <HospitalFooter />
    </div>
  );
}

