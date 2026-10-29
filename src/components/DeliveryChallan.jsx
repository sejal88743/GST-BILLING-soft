import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, Plus, Trash2, Printer, Search, ArrowRight, CheckCircle2, 
  Clock, Scissors, UserCheck, Layers, Hash, Calendar, Building, 
  MapPin, Truck, ChevronRight, X, ArrowUpDown, Filter, Download
} from 'lucide-react';
import { 
  getAllChallans, saveChallan, deleteChallan, 
  getAllBrokers, saveBroker, getAllClients 
} from '../store';
import { formatCurrency, localToday } from '../utils';
import { getIndianFinancialYear, matchesCompanyAndYear } from '../utils/companyContext';
import { handleEnterKeyNavigation } from '../utils/enterKeyNav';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

export default function DeliveryChallan({ 
  profile, 
  activeCompany, 
  activeFY, 
  onConvertToInvoice, 
  onBackToDashboard 
}) {
  const [challans, setChallans] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'

  // Search & Filter in list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'billed'
  const [brokerFilter, setBrokerFilter] = useState('all');

  // Active Challan Form State
  const [currentChallan, setCurrentChallan] = useState({
    id: '',
    challanNumber: '',
    challanDate: localToday(),
    clientName: '',
    clientGstin: '',
    clientAddress: '',
    clientPhone: '',
    clientState: '',
    brokerName: '',
    itemName: '',
    lotNo: '',
    transportName: '',
    vehicleNo: '',
    station: '',
    ratePerMeter: '',
    status: 'pending', // 'pending' | 'billed'
    billNumber: '',
    notes: '',
    // 72 Taka Grid: Array of 72 numbers or empty strings
    takaList: Array(72).fill(''),
    lotList: Array(72).fill(''),
  });

  // Broker Modal State
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState('');
  const [newBrokerPhone, setNewBrokerPhone] = useState('');

  // Print Modals
  const [printChallan, setPrintChallan] = useState(null);
  const [printMode, setPrintMode] = useState('detailed'); // 'detailed' | 'two-in-one'
  const [meterSort, setMeterSort] = useState('as-is'); // 'as-is' | 'asc' | 'desc'

  const formRef = useRef(null);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [chData, brData, clData] = await Promise.all([
        getAllChallans().catch(() => []),
        getAllBrokers().catch(() => []),
        getAllClients().catch(() => []),
      ]);
      setChallans(chData || []);
      setBrokers(brData || []);
      setClients(clData || []);
    } catch {
      toast('Failed to load challan data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter challans by Company & Financial Year
  const filteredChallans = useMemo(() => {
    return challans.filter(ch => {
      // Company & FY filter
      if (!matchesCompanyAndYear(ch, activeCompany || profile, activeFY)) return false;

      // Status filter
      if (statusFilter !== 'all' && (ch.status || 'pending') !== statusFilter) return false;

      // Broker filter
      if (brokerFilter !== 'all' && (ch.brokerName || '') !== brokerFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = String(ch.challanNumber || '').toLowerCase().includes(q);
        const matchParty = String(ch.clientName || '').toLowerCase().includes(q);
        const matchBroker = String(ch.brokerName || '').toLowerCase().includes(q);
        const matchItem = String(ch.itemName || '').toLowerCase().includes(q);
        const matchLot = String(ch.lotNo || '').toLowerCase().includes(q);
        if (!matchNo && !matchParty && !matchBroker && !matchItem && !matchLot) return false;
      }

      return true;
    });
  }, [challans, activeCompany, profile, activeFY, statusFilter, brokerFilter, searchQuery]);

  // Next auto Challan Number
  const getNextChallanNumber = () => {
    let max = 0;
    challans.forEach(ch => {
      const num = parseInt(String(ch.challanNumber || '').replace(/\D/g, ''), 10);
      if (num && num > max) max = num;
    });
    return String(max + 1).padStart(3, '0');
  };

  // Start new challan
  const handleStartNew = () => {
    setCurrentChallan({
      id: 'ch_' + Date.now(),
      challanNumber: getNextChallanNumber(),
      challanDate: localToday(),
      clientName: '',
      clientGstin: '',
      clientAddress: '',
      clientPhone: '',
      clientState: profile?.state || '',
      brokerName: '',
      itemName: '',
      lotNo: '',
      transportName: '',
      vehicleNo: '',
      station: '',
      ratePerMeter: '',
      status: 'pending',
      billNumber: '',
      notes: '',
      takaList: Array(72).fill(''),
      companyName: activeCompany?.businessName || profile?.businessName || '',
      companyGstin: activeCompany?.gstin || profile?.gstin || '',
      financialYear: activeFY || getIndianFinancialYear(),
    });
    setActiveTab('new');
  };

  // Edit existing challan
  const handleEditChallan = (ch) => {
    const list = Array(72).fill('');
    if (Array.isArray(ch.takaList)) {
      ch.takaList.forEach((v, idx) => {
        if (idx < 72) list[idx] = v;
      });
    }
    setCurrentChallan({
      ...ch,
      takaList: list,
    });
    setActiveTab('new');
  };

  // Delete challan
  const handleDeleteChallan = async (id, chNo) => {
    const ok = await confirmAction({
      title: 'Delete Delivery Challan?',
      message: `Are you sure you want to delete Challan No: ${chNo || id}? This cannot be undone.`,
      confirmLabel: 'Delete Challan',
      danger: true,
    });
    if (!ok) return;

    try {
      await deleteChallan(id);
      setChallans(prev => prev.filter(c => c.id !== id));
      toast('Challan deleted successfully', 'success');
    } catch {
      toast('Failed to delete challan', 'error');
    }
  };

  // Client Selection auto-fill
  const handleSelectClient = (clientName) => {
    const found = clients.find(c => c.name === clientName);
    if (found) {
      setCurrentChallan(prev => ({
        ...prev,
        clientName: found.name,
        clientGstin: found.gstin || '',
        clientAddress: found.address || '',
        clientPhone: found.phone || '',
        clientState: found.state || prev.clientState,
      }));
    } else {
      setCurrentChallan(prev => ({ ...prev, clientName }));
    }
  };

  // Add new broker
  const handleSaveBroker = async () => {
    if (!newBrokerName.trim()) {
      toast('Please enter broker name', 'error');
      return;
    }
    const br = {
      id: 'brk_' + Date.now(),
      name: newBrokerName.trim(),
      phone: newBrokerPhone.trim(),
      createdAt: new Date().toISOString(),
    };
    try {
      await saveBroker(br);
      setBrokers(prev => [...prev, br]);
      setCurrentChallan(prev => ({ ...prev, brokerName: br.name }));
      setShowBrokerModal(false);
      setNewBrokerName('');
      setNewBrokerPhone('');
      toast('Broker added successfully', 'success');
    } catch {
      toast('Failed to save broker', 'error');
    }
  };

  // Update Taka meter value
  const handleTakaChange = (index, value) => {
    const next = [...currentChallan.takaList];
    next[index] = value;
    setCurrentChallan(prev => ({ ...prev, takaList: next }));
  };

  const handleLotChange = (index, value) => {
    const next = [...(currentChallan.lotList || Array(72).fill(''))];
    next[index] = value;
    setCurrentChallan(prev => ({ ...prev, lotList: next }));
  };

  // Calculations for current challan
  const { totalTaka, totalMeters, avgMeter, totalAmount } = useMemo(() => {
    const list = currentChallan.takaList || [];
    let count = 0;
    let sum = 0;
    list.forEach(val => {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        count += 1;
        sum += num;
      }
    });
    const roundedSum = Math.round(sum * 100) / 100;
    const avg = count > 0 ? Math.round((roundedSum / count) * 100) / 100 : 0;
    const rate = parseFloat(currentChallan.ratePerMeter) || 0;
    const amount = Math.round(roundedSum * rate * 100) / 100;
    return {
      totalTaka: count,
      totalMeters: roundedSum,
      avgMeter: avg,
      totalAmount: amount,
    };
  }, [currentChallan.takaList, currentChallan.ratePerMeter]);

  // Bulk paste meters into Taka list
  const handleBulkPaste = (text) => {
    if (!text) return;
    const numbers = text
      .split(/[\s,\n\t]+/)
      .map(s => s.trim())
      .filter(s => s && !isNaN(Number(s)))
      .slice(0, 72);

    if (numbers.length === 0) {
      toast('No valid meter values found in clipboard text', 'info');
      return;
    }

    const next = Array(72).fill('');
    numbers.forEach((n, idx) => {
      next[idx] = n;
    });
    setCurrentChallan(prev => ({ ...prev, takaList: next }));
    toast(`Added ${numbers.length} Taka successfully`, 'success');
  };

  // Save Challan
  const handleSaveChallan = async (e) => {
    if (e) e.preventDefault();
    if (!currentChallan.challanNumber.trim()) {
      toast('Challan number is required', 'error');
      return;
    }
    if (!currentChallan.clientName.trim()) {
      toast('Party / Buyer name is required', 'error');
      return;
    }

    const payload = {
      ...currentChallan,
      id: currentChallan.id || 'ch_' + safeFileName(currentChallan.challanNumber),
      totalTaka,
      totalMeters,
      totalAmount,
      companyName: activeCompany?.businessName || profile?.businessName || '',
      companyGstin: activeCompany?.gstin || profile?.gstin || '',
      financialYear: activeFY || getIndianFinancialYear(currentChallan.challanDate),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveChallan(payload);
      setChallans(prev => {
        const idx = prev.findIndex(c => c.id === payload.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = payload;
          return updated;
        }
        return [payload, ...prev];
      });
      toast(`Challan #${payload.challanNumber} saved successfully`, 'success');
      setActiveTab('list');
    } catch (err) {
      toast(`Failed to save challan: ${err.message}`, 'error');
    }
  };

  // Convert to Invoice
  const handleConvertToBill = (challan) => {
    // Sync Challan No and Bill No!
    if (onConvertToInvoice) {
      onConvertToInvoice({
        fromChallan: true,
        challanId: challan.id,
        challanNumber: challan.challanNumber,
        invoiceNumber: challan.challanNumber, // SAME NUMBER AS REQUESTED!
        clientName: challan.clientName,
        clientGstin: challan.clientGstin,
        clientAddress: challan.clientAddress,
        clientPhone: challan.clientPhone,
        clientState: challan.clientState,
        brokerName: challan.brokerName,
        lotNo: challan.lotNo,
        itemName: challan.itemName || 'Textile Fabric',
        totalMeters: challan.totalMeters,
        totalTaka: challan.totalTaka,
        ratePerMeter: challan.ratePerMeter,
        transportName: challan.transportName,
        vehicleNo: challan.vehicleNo,
        station: challan.station,
        takaList: challan.takaList,
      });
    }
  };

  // Helper for safe file name
  function safeFileName(str) {
    return String(str || '').replace(/[/\\:*?"<>|]/g, '_');
  }

  // Active Print Data with Meter Sort
  const sortedTakaEntries = useMemo(() => {
    if (!printChallan) return [];
    const list = (printChallan.takaList || [])
      .map((val, idx) => ({ takaNo: idx + 1, meter: parseFloat(val) }))
      .filter(item => !isNaN(item.meter) && item.meter > 0);

    if (meterSort === 'asc') {
      return [...list].sort((a, b) => a.meter - b.meter);
    }
    if (meterSort === 'desc') {
      return [...list].sort((a, b) => b.meter - a.meter);
    }
    return list; // 'as-is'
  }, [printChallan, meterSort]);

  return (
    <div className="dashboard-container" onKeyDown={(e) => handleEnterKeyNavigation(e, formRef.current)}>
      {/* Header bar */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers className="text-primary" size={26} /> 
            Textile Delivery Challan (कपड़ा चालान)
          </h1>
          <p className="page-subtitle">
            Taka (थान) &amp; Meter piece-wise challan with 72-taka capacity, broker tracking, and 2-in-1 print
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {activeTab === 'list' ? (
            <button className="btn btn-primary" onClick={handleStartNew} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> New Challan (नया चालान)
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => setActiveTab('list')}>
              View All Challans (चालान सूची)
            </button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      {activeTab === 'list' && (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          {/* Search and Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search Challan No, Party, Broker, Lot..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
            <div>
              <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status (सभी चालान)</option>
                <option value="pending">Pending Billed (बिल बनना बाकी)</option>
                <option value="billed">Billed / Invoiced (बिल बन गया)</option>
              </select>
            </div>
            <div>
              <select className="form-input" value={brokerFilter} onChange={e => setBrokerFilter(e.target.value)}>
                <option value="all">All Brokers (सभी दलाल)</option>
                {brokers.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Challans Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading challans...</div>
          ) : filteredChallans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
              <Layers size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>No delivery challans found</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Create your first textile delivery challan with meter &amp; taka entries.
              </p>
              <button className="btn btn-primary" onClick={handleStartNew}>
                <Plus size={16} /> Create Challan
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem' }}>Date</th>
                    <th style={{ padding: '0.75rem' }}>Challan No</th>
                    <th style={{ padding: '0.75rem' }}>Party (Buyer)</th>
                    <th style={{ padding: '0.75rem' }}>Broker (दलाल)</th>
                    <th style={{ padding: '0.75rem' }}>Item / Lot</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Taka</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Mtrs</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChallans.map((ch) => {
                    const isBilled = ch.status === 'billed';
                    return (
                      <tr key={ch.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem' }}>{ch.challanDate}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                          #{ch.challanNumber}
                        </td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{ch.clientName}</td>
                        <td style={{ padding: '0.75rem' }}>{ch.brokerName || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <div>{ch.itemName || 'Fabric'}</div>
                          {ch.lotNo && <small style={{ color: 'var(--text-muted)' }}>Lot: {ch.lotNo}</small>}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          {ch.totalTaka || 0} Pcs
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>
                          {ch.totalMeters?.toFixed(2) || '0.00'} m
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {formatCurrency(ch.totalAmount || 0)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: isBilled ? 'var(--info-bg)' : 'var(--warn-bg)',
                            color: isBilled ? 'var(--info-text)' : 'var(--warn-text)',
                            border: `1px solid ${isBilled ? 'var(--info-border)' : 'var(--warn-border)'}`,
                          }}>
                            {isBilled ? 'Billed / बिल बन गया' : 'Pending / पेंडिंग'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary"
                              title="Print Detailed Challan"
                              onClick={() => {
                                setPrintChallan(ch);
                                setPrintMode('detailed');
                              }}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              <Printer size={14} /> Full
                            </button>
                            <button
                              className="btn btn-secondary"
                              title="Print 2-in-1 Half Page (2 Copies on 1 Page)"
                              onClick={() => {
                                setPrintChallan(ch);
                                setPrintMode('two-in-one');
                              }}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#16a34a' }}
                            >
                              <Scissors size={14} /> 2-in-1
                            </button>
                            {!isBilled && (
                              <button
                                className="btn btn-primary"
                                title="Convert to Bill / Invoice (चालान से बिल बनाएं)"
                                onClick={() => handleConvertToBill(ch)}
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                <ArrowRight size={14} /> Make Bill
                              </button>
                            )}
                            <button
                              className="btn btn-secondary"
                              title="Edit"
                              onClick={() => handleEditChallan(ch)}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-secondary"
                              title="Delete"
                              onClick={() => handleDeleteChallan(ch.id, ch.challanNumber)}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: 'var(--danger)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Challan View */}
      {activeTab === 'new' && (
        <form ref={formRef} onSubmit={handleSaveChallan} className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText className="text-primary" size={20} />
              {currentChallan.id ? `Edit Delivery Challan #${currentChallan.challanNumber}` : 'New Delivery Challan (नया चालान)'}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Challan (चालान सेव करें)
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            💡 <strong>Keyboard Shortcut:</strong> Press <strong>Enter</strong> in any field to move to the next field automatically! In the Taka grid below, press Enter after typing meters to jump straight to the next piece.
          </div>

          {/* Challan Meta Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Challan No (चालान नं) *</label>
              <input
                type="text"
                className="form-input"
                required
                value={currentChallan.challanNumber}
                onChange={e => setCurrentChallan({ ...currentChallan, challanNumber: e.target.value })}
                placeholder="e.g. 101 or DC-101"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Challan Date (तारीख) *</label>
              <input
                type="date"
                className="form-input"
                required
                value={currentChallan.challanDate}
                onChange={e => setCurrentChallan({ ...currentChallan, challanDate: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Party / Buyer Name (पार्टी) *</label>
              <input
                type="text"
                className="form-input"
                required
                list="client-suggestions"
                value={currentChallan.clientName}
                onChange={e => handleSelectClient(e.target.value)}
                placeholder="Select or enter party name"
              />
              <datalist id="client-suggestions">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Broker (दलाल / एजेंट)</span>
                <button
                  type="button"
                  onClick={() => setShowBrokerModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                >
                  + Add Broker
                </button>
              </label>
              <select
                className="form-input"
                value={currentChallan.brokerName}
                onChange={e => setCurrentChallan({ ...currentChallan, brokerName: e.target.value })}
              >
                <option value="">Direct (No Broker)</option>
                {brokers.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Textile Goods Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '10px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Item / Quality Name (क्वालिटी)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Cotton 60x60, Rayon 14kg"
                value={currentChallan.itemName}
                onChange={e => setCurrentChallan({ ...currentChallan, itemName: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Lot No (लॉट नं)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. LOT-402"
                value={currentChallan.lotNo}
                onChange={e => setCurrentChallan({ ...currentChallan, lotNo: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Rate per Meter (₹ दर)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="₹ / Meter"
                value={currentChallan.ratePerMeter}
                onChange={e => setCurrentChallan({ ...currentChallan, ratePerMeter: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Transport / Lorry No</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Gujarat Roadways / GJ-05-AB-1234"
                value={currentChallan.transportName}
                onChange={e => setCurrentChallan({ ...currentChallan, transportName: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Station / Destination</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Surat, Ahmedabad, Delhi"
                value={currentChallan.station}
                onChange={e => setCurrentChallan({ ...currentChallan, station: e.target.value })}
              />
            </div>
          </div>

          {/* 72 Taka Grid Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  Piece &amp; Meter Taka List (अधिकतम 72 ताका एंट्री)
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Type meter value and press <strong>Enter</strong> to jump to next Taka cell.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                  onClick={async () => {
                    const text = prompt('Paste space, comma, or line-separated meters (e.g. 98.5, 102.3, 105.0):');
                    if (text) handleBulkPaste(text);
                  }}
                >
                  📋 Bulk Paste Meters
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', color: 'var(--danger)' }}
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: 'Clear Taka Grid?',
                      message: 'Are you sure you want to clear all entered meters?',
                      confirmLabel: 'Clear All',
                      danger: true,
                    });
                    if (ok) setCurrentChallan({ ...currentChallan, takaList: Array(72).fill('') });
                  }}
                >
                  ✕ Clear All
                </button>
              </div>
            </div>

            {/* Live Tally Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--primary-light)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(37,99,235,0.2)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>TOTAL TAKA (कुल थान)</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalTaka} <small style={{ fontSize: '0.8rem', fontWeight: 500 }}>/ 72</small></div>
              </div>
              <div style={{ background: 'rgba(5,150,105,0.08)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(5,150,105,0.2)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>TOTAL METERS (कुल मीटर)</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>{totalMeters.toFixed(2)} <small style={{ fontSize: '0.8rem', fontWeight: 500 }}>Mtr</small></div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>AVERAGE / TAKA</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{avgMeter.toFixed(2)} <small style={{ fontSize: '0.8rem', fontWeight: 500 }}>Mtr</small></div>
              </div>
              <div style={{ background: 'rgba(124,58,237,0.08)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--purple)' }}>TOTAL ESTIMATED VALUE</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--purple)' }}>{formatCurrency(totalAmount)}</div>
              </div>
            </div>

            {/* 6 Columns Grid: Sr No 1 to 12 Up-to-Down per Column with zero padding and no arrows */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(140px, 1fr))',
              gap: '0.35rem',
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '0.4rem',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}>
              {Array.from({ length: 6 }).map((_, colIdx) => (
                <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ background: 'var(--primary)', color: '#fff', padding: '0.25rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, borderRadius: '4px' }}>
                    Col #{colIdx + 1} (Sr 1-12)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr', gap: '2px', padding: '1px 2px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <span>Sr</span>
                    <span>Lot</span>
                    <span style={{ textAlign: 'right' }}>Mtr</span>
                  </div>
                  {Array.from({ length: 12 }).map((__, rowIdx) => {
                    const idx = colIdx * 12 + rowIdx;
                    const val = currentChallan.takaList[idx] || '';
                    const lotVal = currentChallan.lotList?.[idx] || '';
                    const isFilled = parseFloat(val) > 0;
                    return (
                      <div 
                        key={idx} 
                        style={{
                          background: isFilled ? 'var(--card-bg)' : 'transparent',
                          border: isFilled ? '1px solid var(--primary)' : '1px dashed var(--border-color)',
                          borderRadius: '4px',
                          padding: '1px 2px',
                          display: 'grid',
                          gridTemplateColumns: '20px 1fr 1fr',
                          gap: '2px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: isFilled ? 'var(--primary)' : 'var(--text-muted)',
                        }}>
                          {rowIdx + 1}.
                        </span>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Lot"
                          value={lotVal}
                          onChange={e => handleLotChange(idx, e.target.value)}
                          title="Lot No (repeats until next Lot entered)"
                          style={{ padding: '1px 2px', fontSize: '0.7rem', textAlign: 'center', background: 'transparent', height: '24px' }}
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input taka-input"
                          placeholder="0.00"
                          value={val}
                          onChange={e => handleTakaChange(idx, e.target.value)}
                          title="Enter Meter directly (e.g. 102.25, 130.25, 105, 105.75)"
                          style={{
                            padding: '1px 2px',
                            fontSize: '0.78rem',
                            fontWeight: isFilled ? 700 : 400,
                            textAlign: 'right',
                            background: 'transparent',
                            border: 'none',
                            height: '24px',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Notes and Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'flex-start' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Remarks / Terms (नोट)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Goods dispatched for folding / dyeing / jobwork / approval"
                value={currentChallan.notes}
                onChange={e => setCurrentChallan({ ...currentChallan, notes: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.65rem' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}>
                Save Challan
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Add Broker Modal */}
      {showBrokerModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%', padding: '1.5rem', borderRadius: '12px', background: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Add New Broker (नया दलाल)</h3>
              <button type="button" onClick={() => setShowBrokerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Broker Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={newBrokerName}
                onChange={e => setNewBrokerName(e.target.value)}
                placeholder="e.g. Ramesh Bhai Broker"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                value={newBrokerPhone}
                onChange={e => setNewBrokerPhone(e.target.value)}
                placeholder="e.g. 9825012345"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBrokerModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveBroker}>Save Broker</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printChallan && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '1rem',
        }}>
          <div className="modal-content" style={{
            maxWidth: '850px', width: '100%', maxHeight: '92vh', overflowY: 'auto',
            background: '#ffffff', color: '#0f172a', padding: '1.5rem', borderRadius: '12px'
          }}>
            {/* Modal Actions Bar (Not Printed) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <strong>Print Format:</strong>
                <button
                  type="button"
                  className={`btn ${printMode === 'detailed' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPrintMode('detailed')}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                >
                  Full Challan + 72 Taka
                </button>
                <button
                  type="button"
                  className={`btn ${printMode === 'two-in-one' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPrintMode('two-in-one')}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', color: printMode !== 'two-in-one' ? '#16a34a' : 'inherit' }}
                >
                  ✂ 2-in-1 (Top &amp; Bottom Copies)
                </button>
              </div>

              {printMode === 'detailed' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <ArrowUpDown size={14} />
                  <span style={{ fontSize: '0.8rem' }}>Meters Sort:</span>
                  <select
                    className="form-input"
                    value={meterSort}
                    onChange={e => setMeterSort(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', width: 'auto' }}
                  >
                    <option value="as-is">As Entered (मूल क्रम)</option>
                    <option value="asc">Ascending (चढ़ता क्रम)</option>
                    <option value="desc">Descending (उतरता क्रम)</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Printer size={16} /> Print (Ctrl+P)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPrintChallan(null)}
                >
                  <X size={16} /> Close
                </button>
              </div>
            </div>

            {/* Print Document Body */}
            <div id="printable-challan" style={{ background: '#ffffff', color: '#111827', fontFamily: 'system-ui, sans-serif' }}>
              {printMode === 'detailed' ? (
                /* FORMAT 1: FULL DETAILED CHALLAN & TAKA LIST */
                <div style={{ border: '2px solid #0f172a', padding: '1.25rem', borderRadius: '4px' }}>
                  {/* Company Header */}
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>DELIVERY CHALLAN / कपड़ा चालान</div>
                    <h2 style={{ margin: '0.2rem 0', fontSize: '1.6rem', fontWeight: 800, color: '#1e40af' }}>
                      {activeCompany?.businessName || profile?.businessName || 'TEXTILE TRADERS'}
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#4b5563' }}>
                      {activeCompany?.address || profile?.address || ''} {activeCompany?.state || profile?.state ? `, ${activeCompany?.state || profile?.state}` : ''}
                    </p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', fontWeight: 600 }}>
                      GSTIN: {activeCompany?.gstin || profile?.gstin || '—'} | Phone: {activeCompany?.phone || profile?.phone || '—'}
                    </p>
                  </div>

                  {/* Challan Meta Details Box */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', border: '1px solid #94a3b8', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ padding: '0.6rem 0.8rem', borderRight: '1px solid #94a3b8' }}>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Consignee / Party (खरीददार):</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{printChallan.clientName}</div>
                      {printChallan.clientAddress && <div>{printChallan.clientAddress}</div>}
                      {printChallan.clientGstin && <div><strong>GSTIN:</strong> {printChallan.clientGstin}</div>}
                      {printChallan.clientPhone && <div><strong>Phone:</strong> {printChallan.clientPhone}</div>}
                    </div>
                    <div style={{ padding: '0.6rem 0.8rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.25rem' }}>
                        <strong>Challan No:</strong>
                        <span style={{ fontWeight: 800, color: '#1e40af' }}>#{printChallan.challanNumber}</span>
                        <strong>Date:</strong>
                        <span>{printChallan.challanDate}</span>
                        <strong>Broker:</strong>
                        <span>{printChallan.brokerName || 'Direct'}</span>
                        <strong>Transport:</strong>
                        <span>{printChallan.transportName || '—'}</span>
                        <strong>Destination:</strong>
                        <span>{printChallan.station || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quality & Lot Banner */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f1f5f9', padding: '0.5rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.88rem' }}>
                    <div><strong>Item / Quality:</strong> {printChallan.itemName || 'Textile Fabric'}</div>
                    {printChallan.lotNo && <div><strong>Lot No:</strong> {printChallan.lotNo}</div>}
                    {printChallan.ratePerMeter && <div><strong>Rate:</strong> ₹{parseFloat(printChallan.ratePerMeter).toFixed(2)}/mtr</div>}
                  </div>

                  {/* Sorted Taka Grid (6 Columns Table) */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 700 }}>
                      <span>PIECE &amp; METER PACKING LIST:</span>
                      <span style={{ color: '#64748b' }}>Order: {meterSort === 'asc' ? 'Ascending' : meterSort === 'desc' ? 'Descending' : 'As Entered'}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', border: '1px solid #94a3b8', padding: '6px', borderRadius: '4px' }}>
                      {sortedTakaEntries.map((item, idx) => (
                        <div key={idx} style={{ border: '1px solid #e2e8f0', padding: '2px 4px', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', background: idx % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>{idx + 1}.</span>
                          <span style={{ fontWeight: 800 }}>{item.meter.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Totals */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '2px solid #0f172a', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', textAlign: 'center', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>TOTAL TAKA (कुल थान)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{printChallan.totalTaka || sortedTakaEntries.length} Pcs</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>TOTAL METERS (कुल मीटर)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                        {(printChallan.totalMeters || sortedTakaEntries.reduce((s, i) => s + i.meter, 0)).toFixed(2)} Mtr
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>ESTIMATED TOTAL (रकम)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e40af' }}>
                        {formatCurrency(printChallan.totalAmount || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                    <div style={{ textAlign: 'center', width: '200px' }}>
                      <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.25rem', fontWeight: 600 }}>Receiver's Signature (हस्ताक्षर)</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '220px' }}>
                      <div style={{ fontSize: '0.8rem', marginBottom: '1.5rem', fontWeight: 600 }}>For {activeCompany?.businessName || profile?.businessName || 'Textile Traders'}</div>
                      <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.25rem', fontWeight: 700 }}>Authorized Signatory</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* FORMAT 2: 2-IN-1 HALF PAGE PRINT (1 PAGE TOP & BOTTOM 2 PRINTS) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* COPY 1: TOP (Consignee Copy) */}
                  <HalfChallanSlip
                    challan={printChallan}
                    company={activeCompany || profile}
                    copyLabel="CONSIGNEE / TRANSPORT COPY (पार्टी / ट्रांसपोर्ट प्रति)"
                  />

                  {/* Scissor Cut Line */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.4rem 0',
                    color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase'
                  }}>
                    <span style={{ flex: 1, borderTop: '1px dashed #94a3b8' }} />
                    <Scissors size={14} /> ✂ CUT HERE / यहाँ से काटें ✂
                    <span style={{ flex: 1, borderTop: '1px dashed #94a3b8' }} />
                  </div>

                  {/* COPY 2: BOTTOM (Office Copy) */}
                  <HalfChallanSlip
                    challan={printChallan}
                    company={activeCompany || profile}
                    copyLabel="OFFICE / MILL COPY (कार्यालय / मिल प्रति)"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 2-in-1 Compact Slip Component
function HalfChallanSlip({ challan, company, copyLabel }) {
  return (
    <div style={{ border: '2px solid #0f172a', padding: '0.85rem 1rem', borderRadius: '4px', background: '#ffffff', fontSize: '0.82rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #0f172a', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e40af' }}>
            {company?.businessName || 'TEXTILE TRADERS'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#4b5563' }}>
            {company?.address || ''} | GSTIN: {company?.gstin || '—'} | Ph: {company?.phone || '—'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'inline-block', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
            {copyLabel}
          </span>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e40af', marginTop: '2px' }}>
            CHALLAN #{challan.challanNumber}
          </div>
          <div style={{ fontSize: '0.78rem' }}>Date: {challan.challanDate}</div>
        </div>
      </div>

      {/* Meta Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>
        <div>
          <strong>Party:</strong> <span style={{ fontWeight: 800 }}>{challan.clientName}</span>
          {challan.clientGstin && <span style={{ fontSize: '0.75rem', marginLeft: '6px' }}>(GSTIN: {challan.clientGstin})</span>}
          {challan.station && <div><strong>Station:</strong> {challan.station}</div>}
        </div>
        <div>
          <div><strong>Broker:</strong> {challan.brokerName || 'Direct'}</div>
          {challan.transportName && <div><strong>Transport:</strong> {challan.transportName}</div>}
        </div>
      </div>

      {/* Lot & Taka Summary Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Lot No</th>
            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Item / Quality Name</th>
            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Total Taka</th>
            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Total Meters</th>
            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Rate (₹)</th>
            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '4px 6px', fontWeight: 700 }}>{challan.lotNo || '—'}</td>
            <td style={{ padding: '4px 6px' }}>{challan.itemName || 'Textile Fabric'}</td>
            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 800 }}>{challan.totalTaka || 0} Pcs</td>
            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
              {(challan.totalMeters || 0).toFixed(2)} m
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'right' }}>
              {challan.ratePerMeter ? `₹${parseFloat(challan.ratePerMeter).toFixed(2)}` : '—'}
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 800, color: '#1e40af' }}>
              {formatCurrency(challan.totalAmount || 0)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Bottom Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.75rem', paddingTop: '0.25rem' }}>
        <div style={{ textAlign: 'center', width: '140px' }}>
          <div style={{ borderTop: '1px solid #475569', fontSize: '0.72rem', fontWeight: 600 }}>Party Signature</div>
        </div>
        <div style={{ textAlign: 'center', width: '160px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>For {company?.businessName || 'Textile Traders'}</div>
          <div style={{ borderTop: '1px solid #475569', fontSize: '0.72rem', fontWeight: 700, marginTop: '1rem' }}>Auth. Signatory</div>
        </div>
      </div>
    </div>
  );
}
