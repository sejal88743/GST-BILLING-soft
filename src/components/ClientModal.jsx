import { useState, useEffect } from 'react';
import { X, Sparkles, Check, Loader, UserCheck } from 'lucide-react';
import { getCountryConfig, getStatesForCountry, validateTaxId, detectCountryFromBrowser, getCountriesForRegion, PAPER_SIZES, decodeGstin } from '../utils';
import { getRegionMode, lookupGstin, getAllBrokers, saveBroker } from '../store';
import { toast } from './Toast';

export default function ClientModal({ show, onClose, onSave, client, isEditing, defaultCountry }) {
  // Country defaults: explicit prop (active business profile) → browser locale → 'India'.
  const fallbackCountry = defaultCountry || detectCountryFromBrowser();
  const emptyForm = {
    name: '', address: '', city: '', pin: '', state: '', gstin: '', email: '', phone: '',
    country: fallbackCountry, isSEZ: false, brokerName: '',
    // v1.9.1 — per-client print preferences.
    preferredPaperSize: '',
    preferredCurrency: '',
    autoPrint: false,
  };
  const [form, setForm] = useState({ ...emptyForm });
  const [taxIdWarning, setTaxIdWarning] = useState('');
  const [brokers, setBrokers] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState(null);
  const [showAddBroker, setShowAddBroker] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState('');
  const [newBrokerPhone, setNewBrokerPhone] = useState('');

  useEffect(() => {
    if (show) {
      getAllBrokers().then(b => setBrokers(b || [])).catch(() => {});
    }
  }, [show]);

  useEffect(() => {
    if (show && client) {
      setForm({
        name: client.name || '',
        address: client.address || '',
        city: client.city || '',
        pin: client.pin || '',
        state: client.state || '',
        gstin: client.gstin || '',
        email: client.email || '',
        phone: client.phone || '',
        country: client.country || fallbackCountry,
        isSEZ: !!client.isSEZ,
        brokerName: client.brokerName || client.broker || '',
        preferredPaperSize: client.preferredPaperSize || '',
        preferredCurrency: client.preferredCurrency || '',
        autoPrint: !!client.autoPrint,
      });
    } else if (show) {
      setForm({ ...emptyForm });
    }
    setTaxIdWarning('');
    setLookupStatus(null);
    setShowAddBroker(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, client]);

  if (!show) return null;

  const cc = getCountryConfig(form.country);
  const stateOptions = getStatesForCountry(form.country);

  // ClearTax / Professional software style GSTIN direct autofill
  const handleAutoFillGstin = async (gstinValue) => {
    const raw = String(gstinValue || form.gstin || '').trim().toUpperCase();
    if (raw.length < 15) {
      setLookupStatus({ tone: 'warn', message: 'Enter full 15-character GSTIN to auto-fill' });
      return;
    }
    setLookupLoading(true);
    setLookupStatus(null);
    try {
      const data = await lookupGstin(raw);
      if (data && data.ok) {
        setForm(prev => ({
          ...prev,
          gstin: data.gstin || raw,
          name: data.name || data.tradeName || prev.name,
          address: data.address || prev.address,
          city: data.city || prev.city,
          pin: data.pin || prev.pin,
          state: data.state || prev.state,
          country: 'India',
          brokerName: data.brokerName || prev.brokerName || '',
          phone: data.phone || prev.phone,
          email: data.email || prev.email,
        }));
        setLookupStatus({
          tone: 'ok',
          message: data.name
            ? `✓ Synced: ${data.name} (${data.state || 'India'})`
            : `✓ Validated ${data.state} registration (${data.entityType || 'Taxpayer'})`,
        });
        toast(data.name ? `Auto-filled details for "${data.name}"!` : 'GSTIN validated & state auto-filled!', 'success');
      } else {
        setLookupStatus({ tone: 'warn', message: data?.error || 'Could not fetch GST details' });
      }
    } catch (err) {
      // Offline fallback: decode state and PAN directly
      const dec = decodeGstin(raw);
      if (dec && dec.state) {
        setForm(prev => ({
          ...prev,
          gstin: raw,
          state: dec.state,
          country: 'India',
        }));
        setLookupStatus({ tone: 'ok', message: `✓ State set to ${dec.state} from GSTIN` });
        toast(`State auto-filled as ${dec.state}`, 'info');
      } else {
        setLookupStatus({ tone: 'warn', message: err.message || 'Lookup failed' });
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleTaxIdBlur = () => {
    const result = validateTaxId(form.country, form.gstin);
    setTaxIdWarning(result.ok ? '' : result.message);
    if (form.country !== 'India') return;
    if (form.gstin.length === 15) {
      handleAutoFillGstin(form.gstin);
    }
  };

  const handleCreateBroker = async () => {
    if (!newBrokerName.trim()) return;
    try {
      const b = { name: newBrokerName.trim(), phone: newBrokerPhone.trim() };
      await saveBroker(b);
      const updated = await getAllBrokers();
      setBrokers(updated || []);
      setForm(prev => ({ ...prev, brokerName: b.name }));
      setShowAddBroker(false);
      setNewBrokerName('');
      setNewBrokerPhone('');
      toast(`Broker "${b.name}" added`, 'success');
    } catch {
      toast('Failed to save broker', 'error');
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast('Please enter Client or Business Name', 'warning');
      return;
    }
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '580px', padding: '1.25rem' }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCheck className="text-primary" size={20} />
            <h3 className="section-title" style={{ margin: 0, fontSize: '1.05rem' }}>
              {isEditing ? 'Edit Client Details' : 'Add New Client (नया ग्राहक / पार्टी)'}
            </h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        {/* GSTIN Direct Sync / Auto-fill banner (ClearTax style) */}
        <div style={{
          background: 'rgba(37, 99, 235, 0.07)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
          borderRadius: '8px',
          padding: '0.6rem 0.75rem',
          marginBottom: '0.85rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-darker)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={14} className="text-primary" />
              GSTIN Direct Auto-Fill (जीएसटी नंबर से ऑटो-फिल करें)
            </span>
            {lookupLoading && (
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Loader size={12} className="spin" /> Syncing data…
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              className="form-input"
              value={form.gstin}
              onChange={e => {
                const val = e.target.value.toUpperCase();
                setForm(prev => ({ ...prev, gstin: val }));
                if (taxIdWarning) setTaxIdWarning('');
                if (val.length === 15) handleAutoFillGstin(val);
              }}
              onBlur={handleTaxIdBlur}
              placeholder="e.g. 24AUCPS7939J1Z3 (Type or paste 15-digit GSTIN)"
              maxLength={18}
              style={{ flex: 1, fontWeight: 700, letterSpacing: '0.04em', height: '32px', fontSize: '0.85rem' }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleAutoFillGstin(form.gstin)}
              disabled={lookupLoading || !form.gstin || form.gstin.trim().length < 15}
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {lookupLoading ? <Loader size={12} className="spin" /> : <Sparkles size={13} />}
              Auto-Fill
            </button>
          </div>
          {lookupStatus && (
            <div style={{
              marginTop: '0.35rem',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: lookupStatus.tone === 'ok' ? '#047857' : '#b45309',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {lookupStatus.message}
            </div>
          )}
          {taxIdWarning && (
            <small style={{ color: '#d97706', fontSize: '0.72rem', display: 'block', marginTop: '0.2rem' }}>
              ⚠ {taxIdWarning}
            </small>
          )}
        </div>

        {/* Compact Form Grid: every row fills available space without empty gaps */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem' }}>
          {/* Row 1: Client Name (cols 1-4) & Agent/Broker (cols 5-6) */}
          <div className="form-group" style={{ gridColumn: 'span 4', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>Client / Business Name (पार्टी का नाम) *</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. RAJ RATAN FASHION"
              required
              style={{ fontSize: '0.85rem', fontWeight: 600, height: '30px' }}
            />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700, margin: 0 }}>Agent / Broker (दलाल)</label>
              <button
                type="button"
                onClick={() => setShowAddBroker(v => !v)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}
              >
                {showAddBroker ? '✕ Cancel' : '+ Add'}
              </button>
            </div>
            <input
              type="text"
              className="form-input"
              list="modal-broker-list"
              value={form.brokerName || ''}
              onChange={e => setForm(prev => ({ ...prev, brokerName: e.target.value }))}
              placeholder="e.g. JAGDISH PUROHIT"
              style={{ fontSize: '0.82rem', height: '30px' }}
            />
            <datalist id="modal-broker-list">
              {brokers.map(b => (
                <option key={b.id || b.name} value={b.name}>{b.name}{b.phone ? ` (${b.phone})` : ''}</option>
              ))}
            </datalist>
          </div>

          {/* Quick inline broker creation if requested */}
          {showAddBroker && (
            <div style={{ gridColumn: 'span 6', background: 'var(--bg-secondary)', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="New broker name"
                className="form-input"
                value={newBrokerName}
                onChange={e => setNewBrokerName(e.target.value)}
                style={{ flex: 1, height: '28px', fontSize: '0.78rem' }}
              />
              <input
                type="text"
                placeholder="Phone (optional)"
                className="form-input"
                value={newBrokerPhone}
                onChange={e => setNewBrokerPhone(e.target.value)}
                style={{ width: '130px', height: '28px', fontSize: '0.78rem' }}
              />
              <button type="button" className="btn btn-primary" onClick={handleCreateBroker} style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.74rem' }}>
                Save Broker
              </button>
            </div>
          )}

          {/* Row 2: Address (Full 6 columns) */}
          <div className="form-group" style={{ gridColumn: 'span 6', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.74rem' }}>Address (दुकान / मार्केट का पता)</label>
            <input
              type="text"
              className="form-input"
              value={form.address}
              onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="e.g. SHOP NO-1664-1665, RADHA KRISHNA MARKET, RING ROAD"
              style={{ fontSize: '0.82rem', height: '30px' }}
            />
          </div>

          {/* Row 3: City (2 cols), PIN (2 cols), State (2 cols) */}
          <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.74rem' }}>City / Station (शहर)</label>
            <input
              type="text"
              className="form-input"
              value={form.city}
              onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
              placeholder="e.g. SURAT"
              style={{ fontSize: '0.82rem', height: '30px' }}
            />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.74rem' }}>{cc.postalLabel}</label>
            <input
              type="text"
              className="form-input"
              value={form.pin}
              onChange={e => setForm(prev => ({ ...prev, pin: e.target.value }))}
              placeholder="e.g. 395002"
              style={{ fontSize: '0.82rem', height: '30px' }}
            />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.74rem' }}>{cc.stateLabel}</label>
            {stateOptions.length > 0 ? (
              <select
                className="form-input"
                value={form.state}
                onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}
                style={{ fontSize: '0.82rem', height: '30px' }}
              >
                <option value="">Select State</option>
                {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                value={form.state}
                onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}
                placeholder={cc.stateLabel}
                style={{ fontSize: '0.82rem', height: '30px' }}
              />
            )}
          </div>

          {/* Row 4: Phone (2 cols), Email (2 cols), Country (2 cols) */}
          <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.74rem' }}>Phone Number (मोबाइल नं)</label>
            <input
              type="tel"
              className="form-input"
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="e.g. 9876543210"
              style={{ fontSize: '0.82rem', height: '30px' }}
            />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.74rem' }}>Email</label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="client@example.com"
              style={{ fontSize: '0.82rem', height: '30px' }}
            />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.74rem' }}>Country</label>
            <select
              className="form-input"
              value={form.country}
              onChange={e => setForm(prev => ({ ...prev, country: e.target.value, state: '' }))}
              style={{ fontSize: '0.82rem', height: '30px' }}
            >
              {(() => {
                const visible = getCountriesForRegion(getRegionMode());
                const out = [];
                if (form.country && !visible.some(c => c.name === form.country)) {
                  out.push(<option key={form.country} value={form.country}>{form.country}</option>);
                }
                return out.concat(visible.map(c => <option key={c.code} value={c.name}>{c.name}</option>));
              })()}
            </select>
          </div>

          {/* SEZ Flag */}
          {form.country === 'India' && (
            <div className="form-group" style={{ gridColumn: 'span 6', margin: 0, paddingTop: '0.2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!form.isSEZ}
                  onChange={e => setForm(prev => ({ ...prev, isSEZ: e.target.checked }))}
                  style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}
                />
                <span><strong>SEZ unit / Developer</strong> — supplies will be charged IGST regardless of state (Section 16, IGST Act).</span>
              </label>
            </div>
          )}

          {/* Print Preferences (Compact Row) */}
          <div className="form-group" style={{ gridColumn: 'span 6', margin: 0, paddingTop: '0.4rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>Preferred Paper</label>
              <select
                className="form-input"
                style={{ fontSize: '0.76rem', height: '28px', padding: '0.2rem' }}
                value={form.preferredPaperSize}
                onChange={e => setForm(prev => ({ ...prev, preferredPaperSize: e.target.value }))}
              >
                <option value="">App default</option>
                {Object.entries(PAPER_SIZES).map(([key, ps]) => (
                  <option key={key} value={key}>{ps.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>Preferred Currency</label>
              <select
                className="form-input"
                style={{ fontSize: '0.76rem', height: '28px', padding: '0.2rem' }}
                value={form.preferredCurrency}
                onChange={e => setForm(prev => ({ ...prev, preferredCurrency: e.target.value }))}
              >
                <option value="">Invoice default</option>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!form.autoPrint}
                  onChange={e => setForm(prev => ({ ...prev, autoPrint: e.target.checked }))}
                  style={{ width: 14, height: 14, accentColor: 'var(--primary)' }}
                />
                <span>Auto-print on save</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}>
            <Check size={15} /> {isEditing ? 'Update Client' : 'Save Client (क्लाइंट सेव करें)'}
          </button>
        </div>
      </div>
    </div>
  );
}
