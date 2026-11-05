import React, { useState, useMemo } from 'react';
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  PhoneCall,
  UserPlus,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react';
import {
  ALL_BLOOD_GROUPS,
  predictDonorAvailability,
  type BloodGroup,
  type DonorRecord,
  type GroupSummaryMetric,
} from '../utils/bloodBankEngine';
import { FOURTEEN_DAY_FORECAST } from '../data/seedData';

interface AiForecastResponse {
  source: string;
  generatedAt: string;
  executiveBrief: string;
  predictedTurnoutRatePct: number;
  expectedUnitsYield: number;
  highRiskShortageGroups: string[];
  outreachWindows: {
    windowLabel: string;
    targetCohort: string;
    expectedConversionPct: number;
    recommendedChannel: string;
  }[];
  clinicalRecommendations: string[];
}

interface DonorForecastViewProps {
  donors: DonorRecord[];
  summaryMetrics: GroupSummaryMetric[];
  referenceDate: string;
  onTriggerRecall: (donorId: string) => void;
  onAddDonor: (newDonor: Omit<DonorRecord, 'id' | 'recallStatus'>) => void;
}

export const DonorForecastView: React.FC<DonorForecastViewProps> = ({
  donors,
  summaryMetrics,
  referenceDate,
  onTriggerRecall,
  onAddDonor,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup | 'ALL'>('ALL');
  const [eligibilityFilter, setEligibilityFilter] = useState<'ALL' | 'ELIGIBLE' | 'HIGH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isForecasting, setIsForecasting] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [showAddDonorModal, setShowAddDonorModal] = useState(false);

  // New donor form state
  const [fullName, setFullName] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O-');
  const [age, setAge] = useState('28');
  const [lastDonationDate, setLastDonationDate] = useState('2026-07-15');
  const [hemoglobinGdL, setHemoglobinGdL] = useState('14.2');
  const [distanceKm, setDistanceKm] = useState('3.5');
  const [district, setDistrict] = useState('Chikodi Campus Area');
  const [contactPhone, setContactPhone] = useState('+91 98450 12345');
  const [preferredWindow, setPreferredWindow] = useState<DonorRecord['preferredWindow']>('Morning (08:00-12:00)');
  const [formError, setFormError] = useState<string | null>(null);

  const [aiForecast, setAiForecast] = useState<AiForecastResponse>({
    source: 'clinical-heuristic-engine',
    generatedAt: '2026-11-05T08:30:00Z',
    executiveBrief:
      'Over the next 14 days, universal O- and rare B- reserves require targeted donor recall to sustain the 5.0-day surgical and trauma buffer across KLE Hospital departments. High-probability repeat donors within 6 km show an 84% predicted morning turnout.',
    predictedTurnoutRatePct: 82,
    expectedUnitsYield: 18,
    highRiskShortageGroups: ['O-', 'B-', 'A-'],
    outreachWindows: [
      {
        windowLabel: 'Morning Clinical Slot (08:30 – 11:30)',
        targetCohort: 'Eligible O- & B- repeat donors (< 5 km radius, Hb >= 13.8 g/dL)',
        expectedConversionPct: 88,
        recommendedChannel: 'Direct Transfusion Desk Call + SMS Appointment Token',
      },
      {
        windowLabel: 'Afternoon Campus & Polytechnic Drive (14:00 – 17:00)',
        targetCohort: 'Eligible O+ & A+ voluntary donors (> 90 days since last donation)',
        expectedConversionPct: 74,
        recommendedChannel: 'Automated WhatsApp Slot Confirmation',
      },
    ],
    clinicalRecommendations: [
      'Dispatch immediate priority recall to 4 High-Readiness O- and B- donors to cover upcoming trauma and hematology requisitions.',
      'Pre-book weekend mobile collection slots for donors completing their 56-day whole-blood recovery window next week.',
      'Provide oral iron supplementation follow-up for deferred donors with hemoglobin < 12.5 g/dL.',
    ],
  });

  const predictions = useMemo(
    () => predictDonorAvailability(donors, referenceDate),
    [donors, referenceDate]
  );

  const donorLookup = useMemo(() => {
    const map = new Map<string, DonorRecord>();
    donors.forEach((d) => map.set(d.id, d));
    return map;
  }, [donors]);

  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      if (selectedGroup !== 'ALL' && p.bloodGroup !== selectedGroup) return false;
      if (eligibilityFilter === 'ELIGIBLE' && !p.isMedicallyEligible) return false;
      if (eligibilityFilter === 'HIGH' && p.availabilityScore < 75) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const d = donorLookup.get(p.donorId);
        const matchName = p.fullName.toLowerCase().includes(q);
        const matchId = p.donorId.toLowerCase().includes(q);
        const matchDistrict = d?.district.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchId && !matchDistrict) return false;
      }
      return true;
    });
  }, [predictions, selectedGroup, eligibilityFilter, searchQuery, donorLookup]);

  const chartGroup: BloodGroup = selectedGroup === 'ALL' ? 'O-' : selectedGroup;

  const handleRunAiForecast = async () => {
    setIsForecasting(true);
    setForecastError(null);
    try {
      const response = await fetch('/api/ai/donor-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summaryMetrics,
          topDonors: filteredPredictions.slice(0, 8),
          targetBloodGroup: selectedGroup,
          timeframeDays: 14,
        }),
      });
      if (!response.ok) {
        throw new Error(`Forecast request failed with status ${response.status}`);
      }
      const data = (await response.json()) as AiForecastResponse;
      setAiForecast(data);
    } catch (err) {
      setForecastError(
        err instanceof Error ? err.message : 'Unable to reach AI forecast service.'
      );
    } finally {
      setIsForecasting(false);
    }
  };

  const handleCreateDonor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !district.trim() || !contactPhone.trim()) {
      setFormError('Please provide the donor full name, district, and contact phone.');
      return;
    }
    const parsedAge = Number(age);
    const parsedHb = Number(hemoglobinGdL);
    const parsedDist = Number(distanceKm);
    if (Number.isNaN(parsedAge) || parsedAge < 18 || parsedAge > 65) {
      setFormError('Donor age must be between 18 and 65 years.');
      return;
    }
    if (Number.isNaN(parsedHb) || parsedHb < 9.0 || parsedHb > 19.0) {
      setFormError('Hemoglobin value must be between 9.0 and 19.0 g/dL.');
      return;
    }

    onAddDonor({
      fullName: fullName.trim(),
      bloodGroup,
      age: parsedAge,
      lastDonationDate,
      hemoglobinGdL: parsedHb,
      distanceKm: Number.isNaN(parsedDist) ? 4.0 : parsedDist,
      pastDonationsCount: 3,
      responseRatePct: 88,
      preferredWindow,
      district: district.trim(),
      contactPhone: contactPhone.trim(),
    });

    setFullName('');
    setFormError(null);
    setShowAddDonorModal(false);
  };

  return (
    <div className="space-y-8">
      {/* AI Predictive Command Panel */}
      <section aria-labelledby="ai-donor-forecast-heading" className="skeuo-panel rounded-2xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-start gap-3.5">
            <span className="skeuo-icon-crimson w-10 h-10 rounded-xl inline-flex items-center justify-center shrink-0 mt-0.5">
              <BrainCircuit className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <div className="text-xs font-bold text-rose-700">
                AI Donor Availability &amp; Turnout Prediction Engine
              </div>
              <h2 id="ai-donor-forecast-heading" className="text-xl font-bold text-slate-900 mt-0.5">
                14-Day Donor Readiness &amp; Recall Synthesis
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Synthesizes 56-day post-donation recovery intervals, hemoglobin eligibility (&ge; 12.5 g/dL), travel distance, and historical response rates.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRunAiForecast}
              disabled={isForecasting}
              className="px-4 py-2.5 text-xs font-semibold skeuo-btn-dark rounded-xl disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isForecasting ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isForecasting ? 'Synthesizing Forecast...' : 'Run AI Donor Availability Forecast'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddDonorModal(true)}
              className="px-4 py-2.5 text-xs font-semibold skeuo-btn-primary rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Register Donor
            </button>
          </div>
        </div>

        {forecastError && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{forecastError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 7 Cols: Executive Brief & Outreach Windows */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500">
                Clinical Forecast Brief · Focus: {selectedGroup === 'ALL' ? 'All Blood Groups' : `Group ${selectedGroup}`}
              </div>
              <p className="text-sm text-slate-800 leading-relaxed" data-testid="ai-donor-brief">
                {aiForecast.executiveBrief}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3.5">
              <div className="skeuo-well rounded-xl p-3.5">
                <div className="text-xs text-slate-600">Predicted Turnout Rate</div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {aiForecast.predictedTurnoutRatePct}%
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  Verified eligible cohort
                </div>
              </div>
              <div className="skeuo-well rounded-xl p-3.5">
                <div className="text-xs text-slate-600">Expected 14d Yield</div>
                <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  +{aiForecast.expectedUnitsYield} units
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Whole blood &amp; apheresis
                </div>
              </div>
              <div className="skeuo-well rounded-xl p-3.5">
                <div className="text-xs text-slate-600">Priority Recall Groups</div>
                <div className="text-xl font-bold font-mono text-rose-700 mt-1">
                  {aiForecast.highRiskShortageGroups.join(' · ')}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Immediate outreach advised
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-900">
                Recommended Clinical Outreach Windows
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                {aiForecast.outreachWindows.map((win, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                      <span>{win.windowLabel}</span>
                      <span className="font-mono text-emerald-700 tabular-nums shrink-0">
                        {win.expectedConversionPct}% conv.
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{win.targetCohort}</p>
                    <div className="text-[11px] text-slate-500">
                      Channel: {win.recommendedChannel}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: 14-Day Supply vs Demand Forecast Chart */}
          <div className="lg:col-span-5 lg:border-l lg:border-slate-200 lg:pl-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900">
                  14-Day Supply vs. Hospital Demand ({chartGroup})
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  Nov 06 – Nov 15
                </span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-600 mt-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-600 inline-block rounded-xs" aria-hidden="true" />
                  Predicted Donor Supply
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-rose-600 inline-block rounded-xs" aria-hidden="true" />
                  Hospital Demand
                </span>
              </div>
            </div>

            {(() => {
              const slicePoints = FOURTEEN_DAY_FORECAST.slice(0, 10);
              const peakVal = Math.max(
                6,
                ...slicePoints.map((p) =>
                  Math.max(
                    p.predictedSupplyByGroup[chartGroup] || 2,
                    p.predictedDemandByGroup[chartGroup] || 2
                  )
                )
              );

              return (
                <div className="mt-4 h-40 flex items-end gap-2 pt-4 border-b border-slate-200">
                  {slicePoints.map((pt) => {
                    const supply = pt.predictedSupplyByGroup[chartGroup] || 2;
                    const demand = pt.predictedDemandByGroup[chartGroup] || 2;
                    const supplyHeightPct = Math.min(100, Math.max(18, Math.round((supply / peakVal) * 100)));
                    const demandHeightPct = Math.min(100, Math.max(18, Math.round((demand / peakVal) * 100)));

                    return (
                      <div key={pt.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div className="text-[9px] font-mono text-slate-500 tabular-nums">
                          {supply}/{demand}
                        </div>
                        <div className="w-full flex items-end justify-center gap-1 flex-1">
                          <div
                            title={`${pt.dayLabel} Predicted Supply: ${supply} u`}
                            className="w-2.5 bg-emerald-600 rounded-t-xs"
                            style={{ height: `${supplyHeightPct}%` }}
                          />
                          <div
                            title={`${pt.dayLabel} Predicted Demand: ${demand} u`}
                            className="w-2.5 bg-rose-600 rounded-t-xs"
                            style={{ height: `${demandHeightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap pb-1">
                          {pt.dayLabel.replace('Nov ', '11/')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="mt-4 space-y-1.5">
              <div className="text-xs font-semibold text-slate-800">
                AI Actionable Directives
              </div>
              <ul className="space-y-1 text-xs text-slate-600">
                {aiForecast.clinicalRecommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-rose-600 font-semibold tabular-nums">
                      0{idx + 1}.
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Donor Availability Ranking & Recall Registry */}
      <section aria-labelledby="donor-registry-heading" className="skeuo-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 id="donor-registry-heading" className="text-lg font-bold text-slate-900">
              Donor Availability Probability &amp; Recall Queue
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Ranked by AI readiness score (0–100) combining clinical recovery interval (&ge; 56d), Hb level, distance, and past responsiveness.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <div className="relative w-full sm:w-48">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search donors by name, ID, or district"
                placeholder="Search donor or ward..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs skeuo-input rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Segmented Filter Control */}
            <div className="skeuo-well flex items-center gap-1 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setEligibilityFilter('ALL')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  eligibilityFilter === 'ALL'
                    ? 'skeuo-btn-dark text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({predictions.length})
              </button>
              <button
                type="button"
                onClick={() => setEligibilityFilter('ELIGIBLE')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  eligibilityFilter === 'ELIGIBLE'
                    ? 'skeuo-btn-dark text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Medically Eligible
              </button>
              <button
                type="button"
                onClick={() => setEligibilityFilter('HIGH')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  eligibilityFilter === 'HIGH'
                    ? 'skeuo-btn-dark text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                High Readiness (&ge;75%)
              </button>
            </div>

            <select
              aria-label="Filter donor predictions by blood group"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value as BloodGroup | 'ALL')}
              className="px-3 py-2 text-xs skeuo-btn-metal rounded-xl font-semibold focus:outline-none shrink-0"
            >
              <option value="ALL">All Groups</option>
              {ALL_BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  Group {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Donor &amp; District</th>
                <th className="py-3 px-4">Group</th>
                <th className="py-3 px-4">Clinical Eligibility &amp; Metrics</th>
                <th className="py-3 px-4 text-right">Readiness Probability</th>
                <th className="py-3 px-4">Optimal Outreach Window</th>
                <th className="py-3 px-4">Recall Status</th>
                <th className="py-3 px-4 text-right">Outreach Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredPredictions.map((pred) => {
                const rawDonor = donorLookup.get(pred.donorId);
                const status = rawDonor?.recallStatus ?? 'Eligible';

                return (
                  <tr key={pred.donorId} className="hover:bg-slate-50/90 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{pred.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        {pred.donorId} · {rawDonor?.district} · {rawDonor?.contactPhone}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-sm text-rose-700 whitespace-nowrap">
                      {pred.bloodGroup}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-semibold text-slate-900">
                        {pred.readinessTier}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {pred.rationale}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">
                      <div
                        className={`text-sm font-bold font-mono ${
                          pred.availabilityScore >= 75
                            ? 'text-emerald-700'
                            : pred.availabilityScore >= 45
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {pred.availabilityScore}%
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Est. turnout: {pred.predictedTurnoutDays}d
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                        <span>{pred.recommendedOutreachSlot}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {status === 'Recall Sent' || status === 'Confirmed' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          {status}
                        </span>
                      ) : pred.isMedicallyEligible ? (
                        <span className="text-slate-700 font-medium">Ready for Recall</span>
                      ) : (
                        <span className="text-amber-700 font-medium">In Recovery Cooldown</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {pred.isMedicallyEligible ? (
                        <button
                          type="button"
                          onClick={() => onTriggerRecall(pred.donorId)}
                          disabled={status === 'Recall Sent'}
                          aria-label={`Send recall notification to ${pred.fullName}`}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                            status === 'Recall Sent'
                              ? 'skeuo-btn-metal text-emerald-700 cursor-default'
                              : 'skeuo-btn-dark text-white'
                          }`}
                        >
                          <PhoneCall className="w-3 h-3" aria-hidden="true" />
                          {status === 'Recall Sent' ? 'Recall Dispatched' : 'Dispatch Recall'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          Eligible in {Math.max(1, 56 - pred.daysSinceLastDonation)}d
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Register New Donor Dialog Modal */}
      {showAddDonorModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-donor-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="register-donor-modal-title" className="text-base font-bold text-slate-900">
                Register Verified Blood Donor
              </h3>
              <button
                type="button"
                onClick={() => setShowAddDonorModal(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            {formError && (
              <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateDonor} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="donor-fullname" className="block font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="donor-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rohit Kulkarni"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="donor-group" className="block font-medium text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    id="donor-group"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono"
                  >
                    {ALL_BLOOD_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="donor-age" className="block font-medium text-slate-700 mb-1">
                    Age (Years)
                  </label>
                  <input
                    id="donor-age"
                    type="number"
                    min={18}
                    max={65}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="donor-hb" className="block font-medium text-slate-700 mb-1">
                    Hemoglobin (g/dL)
                  </label>
                  <input
                    id="donor-hb"
                    type="number"
                    step="0.1"
                    value={hemoglobinGdL}
                    onChange={(e) => setHemoglobinGdL(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="donor-last-date" className="block font-medium text-slate-700 mb-1">
                    Last Donation Date
                  </label>
                  <input
                    id="donor-last-date"
                    type="date"
                    value={lastDonationDate}
                    onChange={(e) => setLastDonationDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="donor-distance" className="block font-medium text-slate-700 mb-1">
                    Distance from Hospital (km)
                  </label>
                  <input
                    id="donor-distance"
                    type="number"
                    step="0.1"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="donor-district" className="block font-medium text-slate-700 mb-1">
                    Residential Sector / Town
                  </label>
                  <input
                    id="donor-district"
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="donor-phone" className="block font-medium text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    id="donor-phone"
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="donor-window" className="block font-medium text-slate-700 mb-1">
                  Preferred Donation Window
                </label>
                <select
                  id="donor-window"
                  value={preferredWindow}
                  onChange={(e) => setPreferredWindow(e.target.value as DonorRecord['preferredWindow'])}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="Morning (08:00-12:00)">Morning (08:00-12:00)</option>
                  <option value="Afternoon (12:00-17:00)">Afternoon (12:00-17:00)</option>
                  <option value="Evening (17:00-20:00)">Evening (17:00-20:00)</option>
                  <option value="Weekend Only">Weekend Only</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddDonorModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                >
                  Save &amp; Score Donor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
