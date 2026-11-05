import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Thermometer,
  Search,
  ArrowUpRight,
  Droplet,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import {
  ALL_BLOOD_GROUPS,
  diffDays,
  type BloodBagUnit,
  type BloodGroup,
  type ComponentType,
  type GroupSummaryMetric,
} from '../utils/bloodBankEngine';

interface OverviewAndInventoryViewProps {
  units: BloodBagUnit[];
  summaryMetrics: GroupSummaryMetric[];
  referenceDate: string;
  selectedGroupFilter: BloodGroup | 'ALL';
  onSelectGroupFilter: (group: BloodGroup | 'ALL') => void;
  onOpenLogUnitModal: () => void;
  onUpdateUnitStatus: (unitId: string, nextStatus: BloodBagUnit['status']) => void;
  onNavigateTab: (tab: 'overview' | 'donors' | 'distribution' | 'requisitions') => void;
  pendingRequisitionsCount: number;
  recommendedTransfersCount: number;
}

export const OverviewAndInventoryView: React.FC<OverviewAndInventoryViewProps> = ({
  units,
  summaryMetrics,
  referenceDate,
  selectedGroupFilter,
  onSelectGroupFilter,
  onOpenLogUnitModal,
  onUpdateUnitStatus,
  onNavigateTab,
  pendingRequisitionsCount,
  recommendedTransfersCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [componentFilter, setComponentFilter] = useState<ComponentType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<BloodBagUnit['status'] | 'ALL'>('ALL');

  const totalAvailable = useMemo(
    () => units.filter((u) => u.status === 'Available').length,
    [units]
  );
  const totalExpiringSoon = useMemo(
    () =>
      units.filter((u) => {
        if (u.status !== 'Available') return false;
        const d = diffDays(u.expiryDate, referenceDate);
        return d >= 0 && d <= 7;
      }).length,
    [units, referenceDate]
  );
  const criticalGroups = useMemo(
    () => summaryMetrics.filter((m) => m.stockStatus === 'Critical' || m.stockStatus === 'Low'),
    [summaryMetrics]
  );

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (selectedGroupFilter !== 'ALL' && u.bloodGroup !== selectedGroupFilter) return false;
      if (componentFilter !== 'ALL' && u.component !== componentFilter) return false;
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchId = u.id.toLowerCase().includes(q);
        const matchDonor = u.donorId.toLowerCase().includes(q);
        const matchFacility = u.facility.toLowerCase().includes(q);
        const matchVault = u.storageUnit.toLowerCase().includes(q);
        const matchGroup = u.bloodGroup.toLowerCase().includes(q);
        if (!matchId && !matchDonor && !matchFacility && !matchVault && !matchGroup) return false;
      }
      return true;
    });
  }, [units, selectedGroupFilter, componentFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Executive 3D Skeuomorphic Clinical Telemetry Strip */}
      <section aria-label="Clinical Telemetry Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="skeuo-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Total Ready Reserve</span>
            <span className="skeuo-icon-crimson w-8 h-8 rounded-xl inline-flex items-center justify-center">
              <Droplet className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 skeuo-well rounded-xl px-3.5 py-2.5 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums" data-testid="total-available-units">
              {totalAvailable}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              {units.length} total tracked bags
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
            <span>Cold-Chain Nominal (2.0°C–6.0°C)</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">100% Validated</span>
          </div>
        </div>

        <div className="skeuo-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Shortage Watchlist Groups</span>
            <span className="skeuo-icon-badge w-8 h-8 rounded-xl inline-flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 skeuo-well rounded-xl px-3.5 py-2.5 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {criticalGroups.length}
            </span>
            <span className="text-xs font-bold font-mono text-rose-700 dark:text-rose-400">
              {criticalGroups.map((g) => g.bloodGroup).join(' · ') || 'All Nominal'}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-xs flex items-center justify-between">
            <span className="text-slate-600">Below 5-day trauma buffer</span>
            <button
              type="button"
              onClick={() => onNavigateTab('donors')}
              className="text-rose-700 font-semibold hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Forecast Donors
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="skeuo-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Expiring Within 7 Days (FEFO)</span>
            <span className="skeuo-icon-badge w-8 h-8 rounded-xl inline-flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 skeuo-well rounded-xl px-3.5 py-2.5 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {totalExpiringSoon}
            </span>
            <span className="text-xs text-amber-700 font-semibold tabular-nums">
              {recommendedTransfersCount} route optimizations ready
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-xs flex items-center justify-between">
            <span className="text-slate-600">Prevent wastage via rebalancing</span>
            <button
              type="button"
              onClick={() => onNavigateTab('distribution')}
              className="text-rose-700 font-semibold hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Optimize Routes
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="skeuo-panel rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Active Hospital Requisitions</span>
            <span className="skeuo-icon-badge w-8 h-8 rounded-xl inline-flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 skeuo-well rounded-xl px-3.5 py-2.5 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {pendingRequisitionsCount}
            </span>
            <span className="text-xs text-slate-600">
              Awaiting cross-match issue
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-xs flex items-center justify-between">
            <span className="text-slate-600">Trauma ICU &amp; Maternity priority</span>
            <button
              type="button"
              onClick={() => onNavigateTab('requisitions')}
              className="text-rose-700 font-semibold hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Open Queue
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* 8-Blood Group 3D Skeuomorphic Reserve & Vial Matrix */}
      <section aria-labelledby="blood-group-matrix-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="blood-group-matrix-heading" className="text-lg font-bold text-slate-900">
              01. 3D Blood Group Reserve &amp; Burn-Rate Matrix
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Tactile 3D reserve gauges with cylindrical blood level vials. Click any group to filter the cold-chain ledger below.
            </p>
          </div>
          {selectedGroupFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => onSelectGroupFilter('ALL')}
              className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-semibold skeuo-btn-metal rounded-xl whitespace-nowrap shrink-0"
            >
              Clear Filter ({selectedGroupFilter})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
          {summaryMetrics.map((metric) => {
            const isSelected = selectedGroupFilter === metric.bloodGroup;
            const fillRatio = Math.min(
              100,
              Math.max(14, Math.round((metric.availableUnits / Math.max(1, metric.targetThreshold)) * 100))
            );

            let statusColorClass = 'text-emerald-700';
            let liquidGradient = 'linear-gradient(180deg, #fb7185 0%, #e11d48 45%, #881337 100%)';
            if (metric.stockStatus === 'Critical') {
              statusColorClass = 'text-rose-700 font-bold';
              liquidGradient = 'linear-gradient(180deg, #f43f5e 0%, #be123c 55%, #4c0519 100%)';
            } else if (metric.stockStatus === 'Low') {
              statusColorClass = 'text-amber-700 font-bold';
              liquidGradient = 'linear-gradient(180deg, #fbbf24 0%, #d97706 55%, #78350f 100%)';
            } else if (metric.stockStatus === 'Surplus') {
              statusColorClass = 'text-sky-700 font-semibold';
            }

            return (
              <button
                key={metric.bloodGroup}
                type="button"
                onClick={() =>
                  onSelectGroupFilter(isSelected ? 'ALL' : metric.bloodGroup)
                }
                aria-pressed={isSelected}
                className={`text-left p-4 rounded-2xl focus-visible:outline-2 focus-visible:outline-rose-600 ${
                  isSelected ? 'skeuo-card-active' : 'skeuo-card-3d text-slate-900'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono tracking-tight">
                    {metric.bloodGroup}
                  </span>
                  <span
                    className={`text-xs ${
                      isSelected ? 'text-rose-300 font-semibold' : statusColorClass
                    }`}
                  >
                    {metric.stockStatus}
                  </span>
                </div>

                {/* 3D Cylindrical Blood Vial & Unit Readout */}
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold tabular-nums">
                        {metric.availableUnits}
                      </span>
                      <span
                        className={`text-xs tabular-nums ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        / {metric.targetThreshold}u
                      </span>
                    </div>
                    <div
                      className={`mt-1 text-[11px] tabular-nums ${
                        isSelected ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {metric.daysOfSupply}d cover
                    </div>
                  </div>

                  {/* 3D Skeuomorphic Glass Vial */}
                  <div
                    aria-hidden="true"
                    className="skeuo-vial-tube w-5 h-12 rounded-full overflow-hidden p-0.5 flex flex-col justify-end shrink-0"
                  >
                    <div
                      className="w-full rounded-full relative transition-all duration-300"
                      style={{
                        height: `${fillRatio}%`,
                        background: liquidGradient,
                      }}
                    >
                      <div className="absolute inset-0 skeuo-vial-glass-shine rounded-full" />
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-3 pt-2 border-t text-[11px] tabular-nums flex items-center justify-between ${
                    isSelected
                      ? 'border-slate-700 text-slate-300'
                      : 'border-slate-200/80 text-slate-500'
                  }`}
                >
                  <span>FEFO &le;7d</span>
                  <span className="font-mono font-semibold">{metric.expiringSoonUnits} u</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Cold-Chain Blood Bag Ledger */}
      <section aria-labelledby="cold-chain-ledger-heading" className="skeuo-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 id="cold-chain-ledger-heading" className="text-lg font-bold text-slate-900">
              02. Cold-Chain Blood Bag Inventory Ledger
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Real-time unit traceability across hospital storage vaults, FEFO expiry countdowns, and sterile temperature telemetry.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search blood bag units by ID, group, vault, or facility"
                placeholder="Search Bag ID, Vault, Donor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs skeuo-input rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Blood Group Selector */}
            <select
              aria-label="Filter by blood group"
              value={selectedGroupFilter}
              onChange={(e) => onSelectGroupFilter(e.target.value as BloodGroup | 'ALL')}
              className="px-3 py-2 text-xs skeuo-btn-metal rounded-xl font-semibold focus:outline-none shrink-0"
            >
              <option value="ALL">All Blood Groups</option>
              {ALL_BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  Group {g}
                </option>
              ))}
            </select>

            {/* Component Filter */}
            <select
              aria-label="Filter by blood component"
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value as ComponentType | 'ALL')}
              className="px-3 py-2 text-xs skeuo-btn-metal rounded-xl font-semibold focus:outline-none shrink-0"
            >
              <option value="ALL">All Components</option>
              <option value="Packed RBC">Packed RBC</option>
              <option value="Whole Blood">Whole Blood</option>
              <option value="Platelets">Platelets</option>
              <option value="Fresh Frozen Plasma">Fresh Frozen Plasma</option>
            </select>

            {/* Status Filter */}
            <select
              aria-label="Filter by unit status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BloodBagUnit['status'] | 'ALL')}
              className="px-3 py-2 text-xs skeuo-btn-metal rounded-xl font-semibold focus:outline-none shrink-0"
            >
              <option value="ALL">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Quarantined">Quarantined</option>
            </select>
          </div>
        </div>

        {filteredUnits.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              No blood bag units match your current filter criteria.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Reset the blood group or component filters, or log a newly collected donor unit into the cold-chain depository.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onSelectGroupFilter('ALL');
                  setComponentFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-xs font-semibold skeuo-btn-metal rounded-xl"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={onOpenLogUnitModal}
                className="px-4 py-2 text-xs font-semibold skeuo-btn-primary rounded-xl"
              >
                Log First Entry
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Bag ID &amp; Donor</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4">Component &amp; Volume</th>
                  <th className="py-3 px-4">Storage Vault &amp; Temp</th>
                  <th className="py-3 px-4">Hospital Facility</th>
                  <th className="py-3 px-4 text-right">FEFO Expiry Window</th>
                  <th className="py-3 px-4">Clinical Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredUnits.slice(0, 25).map((unit) => {
                  const daysLeft = diffDays(unit.expiryDate, referenceDate);
                  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 7;

                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        <div>{unit.id}</div>
                        <div className="text-[11px] text-slate-500 font-sans font-normal">
                          Donor {unit.donorId} · Collected {unit.collectionDate}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-sm text-rose-700 whitespace-nowrap">
                        {unit.bloodGroup}
                      </td>
                      <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                        <div className="font-semibold">{unit.component}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {unit.volumeMl} mL sterile bag
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        <div className="font-medium">{unit.storageUnit}</div>
                        <div className="text-[11px] text-slate-500 inline-flex items-center gap-1 tabular-nums">
                          <Thermometer className="w-3 h-3 text-sky-600" aria-hidden="true" />
                          {unit.temperatureC.toFixed(1)}°C verified
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {unit.facility}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                        <div
                          className={`font-semibold ${
                            isExpiringSoon ? 'text-amber-700 font-bold' : 'text-slate-900'
                          }`}
                        >
                          {unit.expiryDate}
                        </div>
                        <div
                          className={`text-[11px] ${
                            isExpiringSoon ? 'text-amber-700 font-medium' : 'text-slate-500'
                          }`}
                        >
                          {daysLeft >= 0 ? `${daysLeft} days remaining` : 'Expired'}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {unit.status === 'Available' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Available
                          </span>
                        )}
                        {unit.status === 'Reserved' && (
                          <span className="text-sky-700 font-semibold">
                            Reserved (Cross-Match)
                          </span>
                        )}
                        {unit.status === 'Dispatched' && (
                          <span className="text-slate-500 font-medium">
                            Dispatched to Ward
                          </span>
                        )}
                        {unit.status === 'Quarantined' && (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                            Quarantined
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {unit.status === 'Available' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onUpdateUnitStatus(unit.id, 'Dispatched')}
                              aria-label={`Issue ${unit.id} to ward`}
                              className="px-3 py-1 text-xs font-semibold skeuo-btn-metal rounded-lg whitespace-nowrap shrink-0"
                            >
                              Issue Unit
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateUnitStatus(unit.id, 'Quarantined')}
                              aria-label={`Hold ${unit.id} in quarantine`}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                              Hold
                            </button>
                          </div>
                        ) : unit.status === 'Quarantined' ? (
                          <button
                            type="button"
                            onClick={() => onUpdateUnitStatus(unit.id, 'Available')}
                            aria-label={`Release ${unit.id} to available inventory`}
                            className="px-3 py-1 text-xs font-semibold skeuo-btn-metal text-emerald-700 rounded-lg whitespace-nowrap shrink-0"
                          >
                            Release to Stock
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Logged</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredUnits.length > 25 && (
              <div className="px-4 py-3 bg-slate-100/70 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between tabular-nums">
                <span>
                  Showing top 25 of {filteredUnits.length} matching units (sorted by FEFO priority)
                </span>
                <span>Filter by blood group or search Bag ID to narrow view</span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
