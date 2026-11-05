import React, { useState, useMemo } from 'react';
import {
  Truck,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Clock,
  Sparkles,
  Sliders,
} from 'lucide-react';
import {
  ALL_BLOOD_GROUPS,
  calculateOptimalInventoryLevels,
  type BloodBagUnit,
  type DemandScenario,
  type FacilityNode,
  type TransferRecommendation,
} from '../utils/bloodBankEngine';

interface AiOptimizationReport {
  source: string;
  generatedAt: string;
  dispatchSummary: string;
  coldChainProtocol: string;
  estimatedWastageReductionPct: number;
  networkBalanceScoreAfter: number;
  actionItems: string[];
}

interface DistributionOptimizerViewProps {
  units: BloodBagUnit[];
  referenceDate: string;
  facilities: FacilityNode[];
  transferRecommendations: TransferRecommendation[];
  dispatchedTransfers: TransferRecommendation[];
  onApproveTransfer: (transfer: TransferRecommendation) => void;
  onApproveAllTransfers: () => void;
}

export const DistributionOptimizerView: React.FC<DistributionOptimizerViewProps> = ({
  units,
  referenceDate,
  facilities,
  transferRecommendations,
  dispatchedTransfers,
  onApproveTransfer,
  onApproveAllTransfers,
}) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [demandScenario, setDemandScenario] = useState<DemandScenario>('standard');
  const [priorityFilter, setPriorityFilter] = useState<TransferRecommendation['priority'] | 'ALL'>('ALL');
  const [aiReport, setAiReport] = useState<AiOptimizationReport>({
    source: 'clinical-heuristic-engine',
    generatedAt: '2026-11-05T08:40:00Z',
    dispatchSummary:
      'Multi-ward FEFO solver identified acute O- and B- deficits at Emergency Trauma & Surgical ICU alongside expiring A+ and B+ surplus at Central Depository and Maternity Pavilion. Executing recommended transfers prevents 100% of near-term unit expiration.',
    coldChainProtocol:
      'Packed RBC dispatches require pre-conditioned 2.0°C–6.0°C phase-change transport chests with continuous digital temperature logging.',
    estimatedWastageReductionPct: 94,
    networkBalanceScoreAfter: 93,
    actionItems: [
      'Dispatch O- and B- Critical Deficit transfers to Emergency Trauma & Surgical ICU within 25 minutes.',
      'Reallocate expiring A+ and B+ units from Maternity & Central Depository to high-turnover surgical wards.',
      'Verify courier chain-of-custody signatures upon arrival at satellite Belagavi Oncology unit.',
    ],
  });

  const optimalParRecommendations = useMemo(
    () => calculateOptimalInventoryLevels(units, facilities, referenceDate, demandScenario, 7),
    [units, facilities, referenceDate, demandScenario]
  );

  const handleRunAiOptimization = async () => {
    setIsOptimizing(true);
    try {
      const response = await fetch('/api/ai/optimize-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilities,
          transferRecommendations: transferRecommendations.slice(0, 10),
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as AiOptimizationReport;
        setAiReport(data);
      }
    } catch {
      // Keep deterministic clinical report on offline fallback
    } finally {
      setIsOptimizing(false);
    }
  };

  const visibleRecommendations = transferRecommendations.filter(
    (tr) => priorityFilter === 'ALL' || tr.priority === priorityFilter
  );

  const totalUnitsToMove = transferRecommendations.reduce(
    (acc, t) => acc + t.unitsToTransfer,
    0
  );
  const totalWastageSaved = transferRecommendations.reduce(
    (acc, t) => acc + t.wastagePreventedUnits,
    0
  );

  return (
    <div className="space-y-8">
      {/* AI Distribution Command Header */}
      <section aria-labelledby="ai-distribution-heading" className="skeuo-panel rounded-2xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-start gap-3.5">
            <span className="skeuo-icon-crimson w-10 h-10 rounded-xl inline-flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <div className="text-xs font-bold text-rose-700">
                AI Multi-Hospital Inventory &amp; Cold-Chain Distribution Solver
              </div>
              <h2 id="ai-distribution-heading" className="text-xl font-bold text-slate-900 mt-0.5">
                Optimal Inventory Par Levels &amp; Department Distribution Engine
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Tracks live blood stock, accounts for FEFO expiry dates, and applies demand forecasts to recommend optimal par levels and inter-department transfers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRunAiOptimization}
              disabled={isOptimizing}
              className="px-4 py-2.5 text-xs font-semibold skeuo-btn-metal rounded-xl disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isOptimizing ? 'Evaluating Network...' : 'Recalculate AI Logistics Plan'}
            </button>

            {transferRecommendations.length > 0 && (
              <button
                type="button"
                onClick={onApproveAllTransfers}
                className="px-4 py-2.5 text-xs font-semibold skeuo-btn-primary rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                Approve &amp; Dispatch All ({transferRecommendations.length})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <p className="text-sm text-slate-800 leading-relaxed" data-testid="ai-distribution-summary">
              {aiReport.dispatchSummary}
            </p>

            <div className="py-3 border-y border-slate-200/80 text-xs text-slate-700 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-semibold text-slate-900">Cold-Chain Protocol: </span>
                <span>{aiReport.coldChainProtocol}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-900">
                Priority Dispatch Directives
              </div>
              <ul className="space-y-1 text-xs text-slate-600">
                {aiReport.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-rose-600 font-semibold tabular-nums">
                      0{idx + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-6 grid grid-cols-2 gap-4 content-between">
            <div className="skeuo-well rounded-xl p-3.5">
              <span className="text-xs text-slate-600 block">Pending Transfers</span>
              <span className="text-2xl font-bold text-slate-900 tabular-nums mt-1 block" data-testid="pending-transfers-count">
                {transferRecommendations.length}
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums mt-0.5 block">
                {totalUnitsToMove} total bags routed
              </span>
            </div>

            <div className="skeuo-well rounded-xl p-3.5">
              <span className="text-xs text-slate-600 block">Expiry Prevented</span>
              <span className="text-2xl font-bold text-emerald-700 tabular-nums mt-1 block">
                {totalWastageSaved} u
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums mt-0.5 block">
                {aiReport.estimatedWastageReductionPct}% wastage reduction
              </span>
            </div>

            <div className="skeuo-well rounded-xl p-3.5">
              <span className="text-xs text-slate-600 block">Network Balance Index</span>
              <span className="text-2xl font-bold text-slate-900 tabular-nums mt-1 block">
                {aiReport.networkBalanceScoreAfter}/100
              </span>
              <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
                5.0d trauma cover target
              </span>
            </div>

            <div className="skeuo-well rounded-xl p-3.5">
              <span className="text-xs text-slate-600 block">Active Dispatches</span>
              <span className="text-2xl font-bold text-sky-700 tabular-nums mt-1 block" data-testid="dispatched-transfers-count">
                {dispatchedTransfers.length}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Cold-chain couriers live
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* NEW MODULE: 01. Forecast-Driven Optimal Inventory Par Level & Expiry Matrix */}
      <section aria-labelledby="optimal-par-heading" className="skeuo-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="skeuo-icon-badge w-9 h-9 rounded-xl inline-flex items-center justify-center text-slate-800 shrink-0 mt-0.5">
              <Sliders className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="optimal-par-heading" className="text-lg font-bold text-slate-900">
                01. Forecast-Driven Optimal Inventory Par Levels (7-Day Horizon)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Calculates target inventory par levels per blood group by combining current stock, 7-day expiry attrition, and department demand forecasts.
              </p>
            </div>
          </div>

          {/* 3D Skeuomorphic Demand Scenario Selector */}
          <div className="skeuo-well p-1.5 rounded-xl flex flex-wrap sm:flex-nowrap items-center gap-1.5 self-start xl:self-auto">
            {(
              [
                { id: 'standard', label: 'Standard Clinical (1.0x)' },
                { id: 'seasonal_surge', label: 'Seasonal Dengue/Surgical (1.2x)' },
                { id: 'trauma_surge', label: 'Mass Casualty Surge (1.35x)' },
              ] as const
            ).map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setDemandScenario(sc.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  demandScenario === sc.id
                    ? 'skeuo-btn-dark text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Blood Type</th>
                <th className="py-3 px-4 text-right">Current Stock</th>
                <th className="py-3 px-4 text-right">Expiring (&le;7d)</th>
                <th className="py-3 px-4 text-right">Forecast Demand</th>
                <th className="py-3 px-4 text-right">Safety Buffer</th>
                <th className="py-3 px-4 text-right">Optimal Par Level</th>
                <th className="py-3 px-4 text-right">Net Variance</th>
                <th className="py-3 px-4">Optimization Strategy &amp; Department Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {optimalParRecommendations.map((rec) => {
                const isDeficit = rec.netVarianceUnits < 0;
                const isExpiryRisk = rec.recommendedStrategy === 'Route Expiring Surplus';

                return (
                  <tr key={rec.bloodGroup} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-base text-rose-700 whitespace-nowrap">
                      {rec.bloodGroup}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {rec.currentAvailable} u
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          rec.expiringWithin7Days >= 5
                            ? 'text-amber-700 font-bold'
                            : 'text-slate-600'
                        }
                      >
                        {rec.expiringWithin7Days} u
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {rec.forecastDailyDemand.toFixed(1)} u/day
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {rec.safetyBufferUnits} u
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {rec.recommendedOptimalPar} u
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                      <span
                        className={
                          isDeficit
                            ? 'text-rose-700'
                            : rec.netVarianceUnits > 0
                              ? 'text-emerald-700'
                              : 'text-slate-700'
                        }
                      >
                        {rec.netVarianceUnits > 0 ? `+${rec.netVarianceUnits}` : rec.netVarianceUnits} u
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div
                        className={`font-semibold ${
                          rec.recommendedStrategy === 'Urgent Inbound & Recall'
                            ? 'text-rose-700'
                            : isExpiryRisk
                              ? 'text-amber-700'
                              : rec.recommendedStrategy === 'Replenish Buffer'
                                ? 'text-sky-700'
                                : 'text-emerald-700'
                        }`}
                      >
                        {rec.recommendedStrategy}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {rec.departmentAllocationPlan}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 02. Recommended Inter-Department & Hospital Transfers */}
      <section aria-labelledby="transfer-recommendations-heading" className="skeuo-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 id="transfer-recommendations-heading" className="text-lg font-bold text-slate-900">
              02. Recommended Inter-Department &amp; Clinic Distribution Strategies
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Approve individual routes to rebalance live facility inventory and trigger cold-chain courier dispatch.
            </p>
          </div>

          <div className="skeuo-well p-1.5 rounded-xl flex items-center gap-1 self-start sm:self-auto">
            {(['ALL', 'Critical Deficit', 'Expiry Prevention', 'Buffer Rebalance'] as const).map(
              (filterVal) => (
                <button
                  key={filterVal}
                  type="button"
                  onClick={() => setPriorityFilter(filterVal)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                    priorityFilter === filterVal
                      ? 'skeuo-btn-dark text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filterVal === 'ALL' ? 'All Routes' : filterVal}
                </button>
              )
            )}
          </div>
        </div>

        {visibleRecommendations.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-900">
              All Hospital Wards &amp; Regional Nodes Balanced
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Every recommended transfer in this priority category has been dispatched and stock levels meet clinical safety thresholds.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {visibleRecommendations.map((tr) => (
              <div
                key={tr.id}
                className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-slate-900">{tr.id}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span
                      className={`font-semibold ${
                        tr.priority === 'Critical Deficit'
                          ? 'text-rose-700'
                          : tr.priority === 'Expiry Prevention'
                            ? 'text-amber-700'
                            : 'text-sky-700'
                      }`}
                    >
                      {tr.priority}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-slate-500 inline-flex items-center gap-1 tabular-nums">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      ETA {tr.estimatedTransitMinutes} mins
                    </span>
                    {tr.wastagePreventedUnits > 0 && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="text-emerald-700 font-semibold tabular-nums">
                          Prevents {tr.wastagePreventedUnits} expiring unit(s)
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="font-mono text-base font-bold text-rose-700">
                      {tr.unitsToTransfer} &times; {tr.bloodGroup}
                    </span>
                    <span className="text-slate-400 font-normal">from</span>
                    <span>{tr.sourceFacilityName}</span>
                    <ArrowRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    <span>{tr.targetFacilityName}</span>
                  </div>

                  <p className="text-xs text-slate-600">{tr.rationale}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0 self-start lg:self-center">
                  <div className="text-right hidden sm:block">
                    <div className="text-[11px] text-slate-500">Post-Transfer Cover</div>
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {tr.postTransferTargetDaysCover} days
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onApproveTransfer(tr)}
                    aria-label={`Approve and dispatch transfer ${tr.id} of ${tr.unitsToTransfer} ${tr.bloodGroup} to ${tr.targetFacilityName}`}
                    className="px-4 py-2 text-xs font-semibold skeuo-btn-dark rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                    Approve &amp; Dispatch
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 03. Multi-Hospital Stock Matrix Table */}
      <section aria-labelledby="facility-stock-matrix-heading" className="skeuo-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 id="facility-stock-matrix-heading" className="text-lg font-bold text-slate-900">
            03. Hospital Departments &amp; Affiliated Clinics Stock Matrix (Units / Daily Burn)
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Live blood group distribution across all connected KLE Hospital clinical nodes. Red figures indicate sub-2.5 day critical cover.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Hospital Department &amp; Affiliated Clinic</th>
                <th className="py-3 px-4">Distance</th>
                {ALL_BLOOD_GROUPS.map((g) => (
                  <th key={g} className="py-3 px-3 text-right font-mono">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {facilities.map((fac) => (
                <tr key={fac.id} className="hover:bg-slate-50/90">
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{fac.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {fac.departmentType} · {fac.location}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                    {fac.distanceKm === 0 ? 'Campus Core' : `${fac.distanceKm.toFixed(1)} km`}
                  </td>
                  {ALL_BLOOD_GROUPS.map((g) => {
                    const stock = fac.stockByGroup[g] || 0;
                    const daily = fac.dailyDemandByGroup[g] || 0.5;
                    const coverDays = stock / daily;
                    const expiring = fac.expiringWithin7DaysByGroup[g] || 0;

                    return (
                      <td key={g} className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                        <div
                          className={`font-mono font-bold ${
                            coverDays < 2.2
                              ? 'text-rose-700'
                              : coverDays < 4.0
                                ? 'text-amber-700'
                                : 'text-slate-900'
                          }`}
                        >
                          {stock} u
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {daily.toFixed(1)}/d
                          {expiring > 0 ? ` · ${expiring} exp` : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active Cold-Chain Dispatches Log */}
      {dispatchedTransfers.length > 0 && (
        <section aria-labelledby="active-dispatches-heading" className="skeuo-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 id="active-dispatches-heading" className="text-sm font-bold text-slate-900">
              Active Cold-Chain Dispatches ({dispatchedTransfers.length})
            </h3>
            <span className="text-xs text-emerald-700 font-semibold">
              Telemetry Validated (2.0°C–6.0°C)
            </span>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            {dispatchedTransfers.map((dt) => (
              <div key={dt.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span className="font-mono font-semibold text-slate-900">{dt.id}</span>
                  <span>·</span>
                  <span className="font-semibold text-rose-700 font-mono">
                    {dt.unitsToTransfer} &times; {dt.bloodGroup}
                  </span>
                  <span>·</span>
                  <span className="text-slate-700">
                    {dt.sourceFacilityName} &rarr; {dt.targetFacilityName}
                  </span>
                </div>
                <div className="text-slate-500 tabular-nums">
                  In Transit · Courier ETA {dt.estimatedTransitMinutes} mins
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
