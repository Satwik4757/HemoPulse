import React from 'react';
import { ShieldCheck, Phone, Building2, Scale } from 'lucide-react';

export const HospitalFooter: React.FC = () => {
  return (
    <footer
      role="contentinfo"
      aria-label="Hospital Blood Bank Legal Terms and Institutional Attribution"
      className="mt-16 bg-slate-900 text-slate-200 border-t border-slate-800"
    >
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-800">
          {/* Institutional Identity */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base tracking-tight">
              <Building2 className="w-4 h-4 text-rose-500 shrink-0" aria-hidden="true" />
              <span>HemoPulse Clinical Blood Bank Management System</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Hospital-grade AI decision support for donor availability forecasting, FEFO cross-matching, and multi-ward cold-chain inventory optimization. Designed for responsive cross-device operation across desktop workstations, ward tablets, and mobile phlebotomy units.
            </p>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 pt-1">
              <span>NBTC &amp; CDSCO Cold-Chain Compliant</span>
              <span aria-hidden="true">·</span>
              <span>24/7 Emergency Transfusion Telemetry</span>
            </div>
          </div>

          {/* Clinical Protocols & Governance */}
          <div className="md:col-span-4 space-y-2.5 text-xs">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
              <span>Clinical Transfusion &amp; Data Governance Terms</span>
            </div>
            <ul className="space-y-1.5 text-slate-400">
              <li>Whole Blood Recovery Interval: Mandatory 56-day minimum eligibility lock.</li>
              <li>Cold-Chain Storage: Packed RBCs maintained at 2.0°C–6.0°C; Platelets at 20.0°C–24.0°C.</li>
              <li>Cross-Match Verification: Physical serology cross-match required prior to patient issue.</li>
            </ul>
          </div>

          {/* 24x7 Hospital Blood Bank Desk */}
          <div className="md:col-span-3 space-y-2.5 text-xs">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
              <span>24&times;7 Emergency Blood Bank Desk</span>
            </div>
            <p className="text-slate-400">
              Trauma &amp; Critical Care Direct Extension: <span className="font-mono text-slate-200">EXT-108 / +91 (08338) 272-108</span>
            </p>
            <p className="text-slate-400">
              Chikodi &amp; Belagavi Regional Hospital Network
            </p>
          </div>
        </div>

        {/* Mandatory Attribution & Reserved Rights Banner */}
        <div
          data-testid="footer-attribution-banner"
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2"
        >
          <div className="space-y-1">
            <p className="text-sm font-bold text-white tracking-wide">
              All Terms and Rights are Reserved to{' '}
              <span className="text-rose-400">SATWIK GOSAVI</span> in Collaboration with{' '}
              <span className="text-amber-300">KLE C.B.KORE POLYTECHNIC</span>.
            </p>
            <p className="text-xs text-slate-400">
              &copy; 2022 (Updated on 2025) SATWIK GOSAVI &amp; KLE C.B.KORE POLYTECHNIC, Chikodi. Unauthorized reproduction, redistribution, or clinical modification without express written authorization is strictly prohibited.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>Hospital Information System Verified · Cross-Device Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
