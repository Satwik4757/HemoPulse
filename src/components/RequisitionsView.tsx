import React, { useState } from 'react';
import {
  CheckCircle2,
  Plus,
  ShieldAlert,
  Clock,
  Activity,
  AlertCircle,
} from 'lucide-react';
import {
  ALL_BLOOD_GROUPS,
  getCompatibleDonorGroups,
  selectUnitsForRequisition,
  type BloodBagUnit,
  type BloodGroup,
  type ComponentType,
  type HospitalRequisition,
} from '../utils/bloodBankEngine';

interface RequisitionsViewProps {
  requisitions: HospitalRequisition[];
  units: BloodBagUnit[];
  referenceDate: string;
  onFulfillRequisition: (reqId: string, assignedBagIds: string[]) => void;
  onCreateRequisition: (
    newReq: Omit<HospitalRequisition, 'id' | 'requestedAt' | 'status' | 'assignedUnitIds'>
  ) => void;
}

export const RequisitionsView: React.FC<RequisitionsViewProps> = ({
  requisitions,
  units,
  referenceDate,
  onFulfillRequisition,
  onCreateRequisition,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending Cross-Match' | 'Fulfilled'>('ALL');
  const [showNewModal, setShowNewModal] = useState(false);

  // Form state for new requisition
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [ward, setWard] = useState('Polytrauma & Neuro ICU — Bed 02');
  const [hospitalName, setHospitalName] = useState('Emergency Trauma & Surgical ICU');
  const [requestedGroup, setRequestedGroup] = useState<BloodGroup>('O-');
  const [component, setComponent] = useState<ComponentType>('Packed RBC');
  const [unitsRequested, setUnitsRequested] = useState('2');
  const [urgency, setUrgency] = useState<HospitalRequisition['urgency']>('STAT (Immediate)');
  const [attendingPhysician, setAttendingPhysician] = useState('Dr. R. S. Inamdar');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredRequisitions = requisitions.filter(
    (r) => statusFilter === 'ALL' || r.status === statusFilter
  );

  const handleSubmitNewReq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !patientId.trim() || !attendingPhysician.trim()) {
      setFormError('Patient Name, Inpatient ID, and Attending Physician are required.');
      return;
    }
    const qty = Number(unitsRequested);
    if (Number.isNaN(qty) || qty < 1 || qty > 10) {
      setFormError('Units requested must be between 1 and 10.');
      return;
    }

    onCreateRequisition({
      patientName: patientName.trim(),
      patientId: patientId.trim(),
      ward: ward.trim(),
      hospitalName,
      requestedGroup,
      component,
      unitsRequested: qty,
      urgency,
      attendingPhysician: attendingPhysician.trim(),
    });

    setPatientName('');
    setPatientId('');
    setFormError(null);
    setShowNewModal(false);
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="requisitions-heading" className="skeuo-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 id="requisitions-heading" className="text-lg font-bold text-slate-900">
              Hospital Ward Requisitions &amp; Automated Cross-Match Queue
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Matches incoming STAT and urgent hospital blood orders with compatible FEFO blood bags (exact group prioritized before universal O- fallback).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="skeuo-well flex items-center gap-1 p-1 rounded-xl">
              {(['ALL', 'Pending Cross-Match', 'Fulfilled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'skeuo-btn-dark text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'All Orders' : st}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2 text-xs font-semibold skeuo-btn-primary rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              New Ward Requisition
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredRequisitions.map((req) => {
            const compatibleGroups = getCompatibleDonorGroups(req.requestedGroup);
            const autoMatchedUnits =
              req.status === 'Pending Cross-Match'
                ? selectUnitsForRequisition(units, req.requestedGroup, req.unitsRequested, referenceDate)
                : [];

            return (
              <div
                key={req.id}
                className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-slate-900">{req.id}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span
                      className={`font-semibold inline-flex items-center gap-1 ${
                        req.urgency === 'STAT (Immediate)'
                          ? 'text-rose-700'
                          : req.urgency === 'Urgent (< 2 hrs)'
                            ? 'text-amber-700'
                            : 'text-slate-700'
                      }`}
                    >
                      {req.urgency === 'STAT (Immediate)' && (
                        <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {req.urgency}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-slate-500 inline-flex items-center gap-1 tabular-nums">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      Logged {req.requestedAt}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-slate-600">{req.hospitalName}</span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-base font-bold text-slate-900 capitalize">
                      {req.patientName}
                    </span>
                    <span className="text-xs font-mono text-slate-500">({req.patientId})</span>
                    <span className="text-xs text-slate-400">—</span>
                    <span className="text-xs font-medium text-slate-700">{req.ward}</span>
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                    <span>
                      Order:{' '}
                      <strong className="font-mono text-rose-700">
                        {req.unitsRequested} &times; {req.requestedGroup}
                      </strong>{' '}
                      ({req.component})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Attending: {req.attendingPhysician}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Compatible RBC Matrix:{' '}
                      <span className="font-mono text-slate-800">
                        {compatibleGroups.join(', ')}
                      </span>
                    </span>
                  </div>

                  {req.status === 'Pending Cross-Match' && (
                    <div className="pt-1 text-xs text-slate-700">
                      {autoMatchedUnits.length >= req.unitsRequested ? (
                        <span className="text-emerald-700 font-semibold">
                          FEFO Cross-Match Ready:{' '}
                          <span className="font-mono">
                            {autoMatchedUnits.map((u) => `${u.id} (${u.bloodGroup})`).join(', ')}
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">
                          Partial Match ({autoMatchedUnits.length}/{req.unitsRequested} bags ready) — Trigger Emergency Transfer or Donor Recall
                        </span>
                      )}
                    </div>
                  )}

                  {req.status === 'Fulfilled' && req.assignedUnitIds.length > 0 && (
                    <div className="pt-1 text-xs text-slate-500">
                      Issued Units:{' '}
                      <span className="font-mono text-slate-700">
                        {req.assignedUnitIds.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                  {req.status === 'Pending Cross-Match' ? (
                    <button
                      type="button"
                      disabled={autoMatchedUnits.length === 0}
                      onClick={() =>
                        onFulfillRequisition(
                          req.id,
                          autoMatchedUnits.map((u) => u.id)
                        )
                      }
                      aria-label={`Cross-match and issue units for requisition ${req.id}`}
                      className="px-4 py-2 text-xs font-semibold skeuo-btn-dark rounded-xl disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                      Cross-Match &amp; Issue ({autoMatchedUnits.length} u)
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      Cross-Matched &amp; Issued
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* New Hospital Requisition Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-req-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 id="new-req-modal-title" className="text-base font-bold text-slate-900">
                Log Emergency or Ward Blood Requisition
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            {formError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNewReq} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="req-patient-name" className="block font-medium text-slate-700 mb-1">
                    Patient Full Name
                  </label>
                  <input
                    id="req-patient-name"
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Suresh Angadi"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="req-patient-id" className="block font-medium text-slate-700 mb-1">
                    Inpatient / MRN ID
                  </label>
                  <input
                    id="req-patient-id"
                    type="text"
                    required
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    placeholder="e.g. IPD-90512"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="req-group" className="block font-medium text-slate-700 mb-1">
                    Patient Blood Group
                  </label>
                  <select
                    id="req-group"
                    value={requestedGroup}
                    onChange={(e) => setRequestedGroup(e.target.value as BloodGroup)}
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
                  <label htmlFor="req-units" className="block font-medium text-slate-700 mb-1">
                    Units Requested
                  </label>
                  <input
                    id="req-units"
                    type="number"
                    min={1}
                    max={10}
                    value={unitsRequested}
                    onChange={(e) => setUnitsRequested(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="req-component" className="block font-medium text-slate-700 mb-1">
                    Blood Component
                  </label>
                  <select
                    id="req-component"
                    value={component}
                    onChange={(e) => setComponent(e.target.value as ComponentType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="Packed RBC">Packed RBC</option>
                    <option value="Whole Blood">Whole Blood</option>
                    <option value="Platelets">Platelets</option>
                    <option value="Fresh Frozen Plasma">Fresh Frozen Plasma</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="req-urgency" className="block font-medium text-slate-700 mb-1">
                    Clinical Urgency
                  </label>
                  <select
                    id="req-urgency"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as HospitalRequisition['urgency'])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="STAT (Immediate)">STAT (Immediate)</option>
                    <option value="Urgent (< 2 hrs)">Urgent (&lt; 2 hrs)</option>
                    <option value="Routine">Routine</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="req-hospital" className="block font-medium text-slate-700 mb-1">
                    Hospital Facility
                  </label>
                  <select
                    id="req-hospital"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="Emergency Trauma & Surgical ICU">Emergency Trauma &amp; Surgical ICU</option>
                    <option value="KLE Central Blood Depository">KLE Central Blood Depository</option>
                    <option value="Maternity & Neonatal Care Center">Maternity &amp; Neonatal Care Center</option>
                    <option value="Regional Oncology & Dialysis Unit">Regional Oncology &amp; Dialysis Unit</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="req-physician" className="block font-medium text-slate-700 mb-1">
                    Attending Physician
                  </label>
                  <input
                    id="req-physician"
                    type="text"
                    required
                    value={attendingPhysician}
                    onChange={(e) => setAttendingPhysician(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="req-ward" className="block font-medium text-slate-700 mb-1">
                  Ward &amp; Bed Number
                </label>
                <input
                  id="req-ward"
                  type="text"
                  required
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
