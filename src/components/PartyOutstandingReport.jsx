// v1.10.81 - Multi-company consolidated party outstanding with party ledger drilldown
import { useState } from 'react';
import { Wallet, Building2, Eye, X, Calendar, FileText, ArrowUpDown } from 'lucide-react';
import { getFinancialYearStart, formatCurrency } from '../utils';
import { periodMonths, partyOutstanding, billCurrency } from '../utils/partyOutstanding';
import TableExport from './TableExport';

const amt = (n) => (n ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

export default function PartyOutstandingReport({
  bills = [],
  businessName = '',
  allCompanies = [],
  selectedCompanyId = 'all',
  onCompanyChange,
}) {
  const thisYear = new Date().getFullYear();
  const [mode, setMode] = useState('fy');
  const [year, setYear] = useState(getFinancialYearStart());
  const [partySearch, setPartySearch] = useState('');
  const [viewDetailParty, setViewDetailParty] = useState(null); // For party date-wise ledger modal
  const [showCompanyBreakdown, setShowCompanyBreakdown] = useState(true);

  const currencies = [...new Set(bills.map(billCurrency))].sort((a, b) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)));
  const [currency, setCurrency] = useState('INR');
  const cur = currencies.includes(currency) ? currency : (currencies[0] || 'INR');

  const months = periodMonths(mode, year);
  const rawRows = partyOutstanding(bills, months, cur, businessName);

  const rows = partySearch.trim()
    ? rawRows.filter(r => r.name.toLowerCase().includes(partySearch.toLowerCase()))
    : rawRows;

  const hasEarlier = rows.some((r) => r.earlier > 0);
  const colTotal = (key) => rows.reduce((s, r) => s + (r.months[key] || 0), 0);
  const earlierTotal = rows.reduce((s, r) => s + r.earlier, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const years = Array.from({ length: 6 }, (_, i) => (mode === 'fy' ? getFinancialYearStart() : thisYear) - i);
  const periodLabel = mode === 'fy' ? `FY ${year}-${String(year + 1).slice(-2)}` : `Jan-Dec ${year}`;
  const heads = ['Party (पार्टी)', ...(hasEarlier ? ['Earlier'] : []), ...months.map((m) => m.label), 'Total (₹)'];
  const cells = (r) => [...(hasEarlier ? [r.earlier] : []), ...months.map((m) => r.months[m.key] || 0), r.total];
  const totals = [...(hasEarlier ? [earlierTotal] : []), ...months.map((m) => colTotal(m.key)), grandTotal];

  const r2 = (n) => Math.round(n * 100) / 100;
  const isConsolidated = selectedCompanyId === 'all';
  const displayTitle = isConsolidated
    ? `Party Outstanding — All Companies Consolidated (${periodLabel})`
    : `Party Outstanding — ${businessName || 'Company'} (${periodLabel})`;

  const exportRows = rows.length ? [...rows.map((r) => [r.name, ...cells(r).map(r2)]), ['Total', ...totals.map(r2)]] : [];

  const num = { textAlign: 'right', whiteSpace: 'nowrap' };
  const pin = (side) => ({ position: 'sticky', [side]: 0, zIndex: 1, background: 'var(--bg-secondary)' });
  const last = heads.length - 2;

  return (
    <div className="glass-panel" style={{ padding: '1rem' }}>
      {/* Top Header Bar */}
      <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Party Outstanding by Month (पार्टी वाइज बकाया)</h3>
          {isConsolidated ? (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7' }}>
              ⚡ Consolidated (सभी कंपनियाँ)
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
              🏢 {businessName || 'Single Company'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Company Selector */}
          {allCompanies.length > 0 && onCompanyChange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-input"
                style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.82rem', fontWeight: 500 }}
                value={selectedCompanyId}
                aria-label="Filter Company"
                onChange={(e) => onCompanyChange(e.target.value)}
              >
                <option value="all">🏢 All Companies (Consolidated / सभी कंपनियाँ)</option>
                {allCompanies.map((c) => (
                  <option key={c.id || c.businessName} value={c.id || c.businessName}>
                    🏢 {c.businessName} {c.gstin ? `(${c.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <select
            className="form-input"
            style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
            value={mode}
            aria-label="Months"
            onChange={(e) => { setMode(e.target.value); setYear(e.target.value === 'fy' ? getFinancialYearStart() : thisYear); }}
          >
            <option value="fy">Financial year (Apr-Mar)</option>
            <option value="calendar">Calendar year (Jan-Dec)</option>
          </select>

          <select
            className="form-input"
            style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
            value={year}
            aria-label="Year"
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => <option key={y} value={y}>{mode === 'fy' ? `FY ${y}-${String(y + 1).slice(-2)}` : y}</option>)}
          </select>

          {currencies.length > 1 && (
            <select
              className="form-input"
              style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
              value={cur}
              aria-label="Currency"
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {isConsolidated && (
            <button
              className={`btn ${showCompanyBreakdown ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
              onClick={() => setShowCompanyBreakdown(!showCompanyBreakdown)}
              title="Toggle company breakdown pills"
            >
              <Building2 size={13} style={{ marginRight: 4 }} />
              {showCompanyBreakdown ? 'Hide Co. Breakdown' : 'Show Co. Breakdown'}
            </button>
          )}

          <TableExport
            title={displayTitle}
            filename={`Party-Outstanding-${isConsolidated ? 'Consolidated' : 'Single'}-${periodLabel}`}
            landscape
            subtitle={`${isConsolidated ? 'All Companies Consolidated' : businessName}, party outstanding, ${periodLabel} (${cur}), unpaid as on ${new Date().toLocaleDateString('en-IN')}`}
            headers={heads}
            rows={exportRows}
          />
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="text"
            className="form-input"
            style={{ width: '240px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
            placeholder="Search party name (पार्टी खोजें)..."
            value={partySearch}
            onChange={(e) => setPartySearch(e.target.value)}
          />
          {partySearch && (
            <button
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => setPartySearch('')}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Showing <strong>{rows.length}</strong> parties | Total Outstanding: <strong style={{ color: '#dc2626' }}>{formatCurrency(grandTotal, cur)}</strong>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem' }}>
          <Wallet size={40} />
          <p style={{ marginTop: '0.5rem' }}>Nobody owes you anything for {periodLabel}.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: '950px', fontSize: '0.78rem', marginBottom: 0 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {heads.map((h, i) => (
                  <th key={h} style={i === 0 ? { ...pin('left'), padding: '6px 10px' } : i === last + 1 ? { ...num, ...pin('right'), padding: '6px 10px' } : { ...num, padding: '6px 8px' }}>
                    {i === last + 1 ? `Total (${cur})` : h}
                  </th>
                ))}
                <th style={{ textAlign: 'center', padding: '6px 8px', width: '60px' }}>Ledger</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const companyKeys = Object.keys(r.companies || {});
                return (
                  <tr key={r.name} style={{ verticalAlign: 'middle' }}>
                    <td className="font-medium" style={{ ...pin('left'), padding: '6px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                        {isConsolidated && showCompanyBreakdown && companyKeys.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                            {companyKeys.map((cName) => (
                              <span
                                key={cName}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  border: '1px solid #e2e8f0',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {cName}: <strong>₹{amt(r.companies[cName])}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    {cells(r).map((n, i) => (
                      <td key={i} style={i === last ? { ...num, ...pin('right'), fontWeight: 700, color: n > 0 ? '#b91c1c' : 'inherit', padding: '6px 10px' } : { ...num, padding: '6px 8px' }}>
                        {amt(n) || '-'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '2px 6px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        onClick={() => setViewDetailParty(r)}
                        title={`View date-wise bills for ${r.name}`}
                      >
                        <Eye size={12} /> Bills
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-color)' }}>
                <td style={{ ...pin('left'), padding: '8px 10px' }}>Grand Total ({rows.length} Parties)</td>
                {totals.map((n, i) => (
                  <td key={i} style={i === last ? { ...num, ...pin('right'), color: '#b91c1c', fontSize: '0.85rem', padding: '8px 10px' } : { ...num, padding: '8px 8px' }}>
                    {amt(n) || '-'}
                  </td>
                ))}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.5rem 0.25rem 0', margin: 0 }}>
        What each party still owes today, in the month of the invoice. Only real sales count; estimates, challans and cancelled invoices are left out.
        {hasEarlier && ' "Earlier" is invoices from before this period that are still unpaid.'}
        {isConsolidated && ' Showing consolidated dues across all registered mills / sister companies.'}
      </p>

      {/* Date-wise Party Bills Ledger Modal */}
      {viewDetailParty && (
        <div className="modal-backdrop" onClick={() => setViewDetailParty(null)}>
          <div className="modal" style={{ maxWidth: '850px', width: '95%', padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                  Party Outstanding Ledger: <span style={{ color: 'var(--primary)' }}>{viewDetailParty.name}</span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Total Pending: <strong style={{ color: '#dc2626' }}>₹{amt(viewDetailParty.total)}</strong> across {(viewDetailParty.bills || []).length} unpaid bills
                </p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setViewDetailParty(null)}>
                <X size={15} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '0.75rem 1rem' }}>
              {/* Company subtotals breakdown for this party */}
              {Object.keys(viewDetailParty.companies || {}).length > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>Company Dues:</span>
                  {Object.entries(viewDetailParty.companies).map(([co, amtVal]) => (
                    <span key={co} style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '4px', background: '#fff', border: '1px solid #cbd5e1' }}>
                      🏢 {co}: <strong style={{ color: '#dc2626' }}>₹{amt(amtVal)}</strong>
                    </span>
                  ))}
                </div>
              )}

              <table className="data-table" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bill No</th>
                    <th>Company (फ़र्म)</th>
                    <th>Broker (दलाल)</th>
                    <th style={{ textAlign: 'right' }}>Bill Amt (₹)</th>
                    <th style={{ textAlign: 'right' }}>Paid (₹)</th>
                    <th style={{ textAlign: 'right' }}>Due Amount (बाकी ₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewDetailParty.bills || []).map((b, idx) => (
                    <tr key={idx}>
                      <td style={{ whiteSpace: 'nowrap' }}>{b.invoiceDate || '—'}</td>
                      <td className="font-semibold text-primary">{b.invoiceNumber}</td>
                      <td>
                        <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem', fontWeight: 600 }}>
                          {b.companyName}
                        </span>
                      </td>
                      <td style={{ color: b.brokerName !== '—' ? '#4338ca' : 'var(--text-muted)' }}>{b.brokerName}</td>
                      <td style={{ textAlign: 'right' }}>{amt(b.totalAmount)}</td>
                      <td style={{ textAlign: 'right', color: '#059669' }}>{amt(b.paidAmount) || '0.00'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{amt(b.due)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan={4}>Total Pending for {viewDetailParty.name}</td>
                    <td style={{ textAlign: 'right' }}>
                      {amt((viewDetailParty.bills || []).reduce((s, b) => s + b.totalAmount, 0))}
                    </td>
                    <td style={{ textAlign: 'right', color: '#059669' }}>
                      {amt((viewDetailParty.bills || []).reduce((s, b) => s + b.paidAmount, 0))}
                    </td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>
                      {amt(viewDetailParty.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="modal-footer" style={{ padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Party owes total <strong>₹{amt(viewDetailParty.total)}</strong> across {(viewDetailParty.bills || []).length} invoices.
              </span>
              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setViewDetailParty(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

