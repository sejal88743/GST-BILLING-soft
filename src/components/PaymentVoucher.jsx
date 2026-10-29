import { useState, useEffect, useRef } from 'react';
import { CreditCard, Plus, Trash2, Search, Printer, Pencil } from 'lucide-react';
import { getAllPayments, savePayment, deletePayment, getAllClients, getProfile, getNextInvoiceNumber } from '../store';
import { formatCurrency, numberToWords, belongsToProfile, localToday, getPaymentAccounts } from '../utils';
import UnassignedBanner from './UnassignedBanner';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';

const PAYMENT_MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'];

const emptyForm = {
  date: '',
  paymentNo: '',
  partyName: '',
  partyAddress: '',
  amount: '',
  paymentMode: 'Bank Transfer',
  bankName: '',
  referenceNo: '',
  note: '',
};

export default function PaymentVoucher() {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [profile, setProfile] = useState({});
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [previewPayment, setPreviewPayment] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const paymentRef = useRef(null);
  const previewedNoRef = useRef('');

  const loadData = async () => {
    try {
      const [pays, cls, prof] = await Promise.all([getAllPayments(), getAllClients(), getProfile()]);
      setPayments((pays || []).filter(p => belongsToProfile(p, prof)));
      setClients(cls || []);
      setProfile(prof || {});
    } catch {
      toast('Failed to load payment data', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getNextPaymentNo = async () => {
    try {
      return await getNextInvoiceNumber('PAY', { peek: true, businessKey: profile?.gstin || profile?.businessName });
    } catch {
      const count = payments.length + 1;
      const now = new Date();
      const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return `PAY/${fy}-${String(fy + 1).slice(-2)}/${String(count).padStart(4, '0')}`;
    }
  };

  const filtered = search.trim()
    ? payments.filter(p =>
        (p.partyName || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.paymentNo || '').toLowerCase().includes(search.toLowerCase()))
    : payments;

  const openAdd = async () => {
    const paymentNo = await getNextPaymentNo();
    previewedNoRef.current = paymentNo;
    setForm({ ...emptyForm, date: localToday(), paymentNo, bankName: profile?.bankName || '' });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (pay) => {
    setForm({
      date: pay.date || localToday(),
      paymentNo: pay.paymentNo || '',
      partyName: pay.partyName || '',
      partyAddress: pay.partyAddress || '',
      amount: String(pay.amount ?? ''),
      paymentMode: pay.paymentMode || 'Bank Transfer',
      bankName: pay.bankName || '',
      referenceNo: pay.referenceNo || '',
      note: pay.note || '',
    });
    setEditingId(pay.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setForm({ ...emptyForm }); setEditingId(null); };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.partyName.trim()) { toast('Party / Supplier name required', 'warning'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast('Enter valid amount', 'warning'); return; }
    try {
      let paymentNo = form.paymentNo;
      if (!editingId && (!paymentNo.trim() || paymentNo.trim() === previewedNoRef.current)) {
        try {
          paymentNo = await getNextInvoiceNumber('PAY', { businessKey: profile?.gstin || profile?.businessName });
        } catch { paymentNo = paymentNo.trim() || previewedNoRef.current; }
      }

      const existing = editingId ? payments.find(p => p.id === editingId) : null;
      const payment = {
        ...form,
        paymentNo,
        amount: parseFloat(form.amount),
        ownerGstin: existing ? (existing.ownerGstin || '') : (profile?.gstin || ''),
        ownerName: existing ? (existing.ownerName || '') : (profile?.businessName || ''),
      };
      if (editingId) payment.id = editingId;
      await savePayment(payment);
      toast('Payment voucher saved successfully', 'success');
      closeForm();
      loadData();
    } catch {
      toast('Failed to save payment voucher', 'error');
    }
  };

  const handleDelete = async (id, no) => {
    const ok = await confirmAction({
      title: 'Delete Payment Voucher?',
      message: `Delete payment voucher ${no || id}?`,
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deletePayment(id);
      toast('Payment voucher deleted', 'success');
      loadData();
    } catch {
      toast('Failed to delete', 'error');
    }
  };

  const paymentAccounts = getPaymentAccounts(profile);

  return (
    <div className="view-container">
      <div className="page-header-row">
        <div>
          <h2>Payment Vouchers (भुगतान वाउचर)</h2>
          <p className="page-subtitle">Record payments made to suppliers, vendors, and expenses</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <HelpButton topic="payment-vouchers" />
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> New Payment
          </button>
        </div>
      </div>

      <UnassignedBanner items={payments} entityName="payment vouchers" onAssigned={loadData} />

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Search by party name or payment number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Total Payments: <strong>{payments.length}</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment No</th>
                <th>Party / Supplier</th>
                <th>Payment Mode</th>
                <th>Bank Name</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No payment vouchers found. Click "New Payment" to record one.
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id}>
                    <td>{p.date}</td>
                    <td><strong>{p.paymentNo}</strong></td>
                    <td>{p.partyName}</td>
                    <td><span className="badge">{p.paymentMode}</span></td>
                    <td>{p.bankName || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                      {formatCurrency(p.amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button className="btn-icon" onClick={() => setPreviewPayment(p)} title="Print / View">
                          <Printer size={15} />
                        </button>
                        <button className="btn-icon" onClick={() => openEdit(p)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon btn-icon-red" onClick={() => handleDelete(p.id, p.paymentNo)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h3 className="section-title">{editingId ? 'Edit Payment Voucher' : 'New Payment Voucher'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label className="form-label">Payment Date</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Payment Number</label>
                <input type="text" className="form-input" value={form.paymentNo} onChange={e => updateField('paymentNo', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Party / Supplier Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter party or supplier name"
                  value={form.partyName}
                  onChange={e => updateField('partyName', e.target.value)}
                  list="client-suggestions"
                />
                <datalist id="client-suggestions">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div>
                <label className="form-label">Amount (₹) *</label>
                <input type="number" className="form-input" placeholder="0.00" value={form.amount} onChange={e => updateField('amount', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={form.paymentMode} onChange={e => updateField('paymentMode', e.target.value)}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Bank Name / Account</label>
                <select className="form-input" value={form.bankName} onChange={e => updateField('bankName', e.target.value)}>
                  <option value="">-- Select Bank Account --</option>
                  {paymentAccounts.map((acc, idx) => (
                    <option key={idx} value={acc.bankName || acc.name}>
                      {acc.bankName || acc.name} {acc.accountNumber ? `(A/c: ${acc.accountNumber})` : ''}
                    </option>
                  ))}
                  {profile.bankName && !paymentAccounts.some(a => (a.bankName || a.name) === profile.bankName) && (
                    <option value={profile.bankName}>{profile.bankName} {profile.accountNumber ? `(${profile.accountNumber})` : ''}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="form-label">Reference No / UTR / Cheque No</label>
                <input type="text" className="form-input" placeholder="e.g. UTR123456" value={form.referenceNo} onChange={e => updateField('referenceNo', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes / Narration</label>
                <textarea className="form-input" rows={2} placeholder="Optional notes..." value={form.note} onChange={e => updateField('note', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Print / Preview Modal */}
      {previewPayment && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px', background: 'white', color: '#111' }}>
            <div ref={paymentRef} style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1e40af' }}>{profile.businessName || 'Business Name'}</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#555' }}>{profile.address}, {profile.state} | GSTIN: {profile.gstin || 'N/A'}</p>
                <h3 style={{ margin: '1rem 0 0', background: '#f1f5f9', padding: '6px', borderRadius: '4px' }}>PAYMENT VOUCHER</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                <div>
                  <p><strong>Payment No:</strong> {previewPayment.paymentNo}</p>
                  <p><strong>Date:</strong> {previewPayment.date}</p>
                  <p><strong>Payment Mode:</strong> {previewPayment.paymentMode}</p>
                  {previewPayment.bankName && <p><strong>Bank:</strong> {previewPayment.bankName}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p><strong>Paid To:</strong> {previewPayment.partyName}</p>
                  {previewPayment.referenceNo && <p><strong>Ref No:</strong> {previewPayment.referenceNo}</p>}
                </div>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold' }}>
                  <span>Amount Paid:</span>
                  <span style={{ color: '#dc2626' }}>{formatCurrency(previewPayment.amount)}</span>
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: '#64748b' }}>
                  In Words: {numberToWords(previewPayment.amount)} Rupees Only
                </p>
              </div>

              {previewPayment.note && (
                <div style={{ marginBottom: '2rem', fontSize: '0.88rem', color: '#475569' }}>
                  <strong>Narration:</strong> {previewPayment.note}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #cbd5e1', fontSize: '0.88rem' }}>
                <div>Prepared By</div>
                <div>Authorized Signatory</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setPreviewPayment(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
