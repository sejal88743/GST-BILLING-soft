import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, Plus, Trash2, Printer, Search, ArrowRight, CheckCircle2, 
  Clock, Scissors, UserCheck, Layers, Hash, Calendar, Building, 
  MapPin, Truck, ChevronRight, X, ArrowUpDown, Filter, Download,
  ClipboardPaste, Sparkles
} from 'lucide-react';
import { 
  getAllChallans, saveChallan, deleteChallan, 
  getAllBrokers, saveBroker, getAllClients,
  lookupGstin
} from '../store';
import { formatCurrency, localToday } from '../utils';
import { getIndianFinancialYear, matchesCompanyAndYear } from '../utils/companyContext';
import { handleEnterKeyNavigation } from '../utils/enterKeyNav';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

// Surat Power Loom Quality Presets
const SURAT_QUALITY_PRESETS = [
  'D FIYONA 8.500 (REL*REL)',
  'ROTO 11.500 (REL*REL)',
  'ROTO 9.500',
  'MICRO 5.500',
  'WATERJET SATIN 80 GSM',
  'JACQUARD 84/36',
  'CREPE 7.500',
  'REYON 14 KG (30x30)',
  'COTTON CAMBRIC 60x60',
  'HEAVY DULL 12.500',
  'ORGANZA 3.500',
  'MOSS CHIFFON 6.000',
];

// Surat Textile Market Presets
const SURAT_MARKET_PRESETS = [
  'RADHA KRISHNA MARKET, RING ROAD, SURAT',
  'MILLENNIUM TEXTILE MARKET, RING ROAD, SURAT',
  'SURAT TEXTILE MARKET (STM), RING ROAD, SURAT',
  'AVADH TEXTILE MARKET, SAHARA DARWAJA, SURAT',
  'RAGHUKUL TEXTILE MARKET, RING ROAD, SURAT',
  'ROHIT AC MARKET, RING ROAD, SURAT',
  'J.J. TEXTILE MARKET, RING ROAD, SURAT',
  'HARIOM TEXTILE MARKET, RING ROAD, SURAT',
  'UNIVERSAL TEXTILE MARKET, RING ROAD, SURAT',
  'KOHINOOR TEXTILE MARKET, RING ROAD, SURAT',
  'SHREE MAHAVIR TEXTILE MARKET, RING ROAD, SURAT',
  'NEW BOMBAY MARKET, RING ROAD, SURAT',
];

// 48-Taka Sample matching Manoj Enterprise Challan #52
const MANOJ_ENTERPRISE_SAMPLE_METERS = [
  // Col 1: 12 entries (sum: 1472.25)
  120.00, 121.00, 121.00, 121.50, 121.50, 122.00, 122.75, 123.50, 124.00, 124.50, 125.00, 125.50,
  // Col 2: 12 entries (sum: 1548.50)
  126.00, 127.25, 127.75, 128.00, 128.50, 129.00, 129.00, 129.50, 130.00, 130.50, 131.00, 132.00,
  // Col 3: 12 entries (sum: 1619.75)
  132.00, 132.50, 133.25, 134.00, 134.50, 134.50, 135.00, 135.25, 136.00, 137.25, 137.50, 138.00,
  // Col 4: 12 entries (sum: 1714.50)
  138.50, 138.50, 139.00, 139.00, 140.00, 140.25, 141.00, 144.25, 144.50, 148.00, 148.50, 153.00,
];

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
    itemName: 'D FIYONA 8.500 (REL*REL)',
    lotNo: '',
    transportName: '',
    vehicleNo: '',
    station: 'SURAT',
    ratePerMeter: '',
    status: 'pending', // 'pending' | 'billed'
    billNumber: '',
    notes: 'NO ANY WIVING DEFECT GURANTEE ON GREY SO CHEK AND SEND MILL......ONLY PRINT QUALITY',
    // 72 Taka Grid: Array of 72 numbers or empty strings
    takaList: Array(72).fill(''),
    lotList: Array(72).fill(''),
  });

  // Broker Modal State
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState('');
  const [newBrokerPhone, setNewBrokerPhone] = useState('');

  // Bulk Paste Modal State (no window.prompt!)
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Print Modals
  const [printChallan, setPrintChallan] = useState(null);
  const [printMode, setPrintMode] = useState('two-in-one'); // 'two-in-one' (default Surat 2 copies on 1 page) | 'detailed'
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
      clientState: profile?.state || 'Gujarat',
      brokerName: '',
      itemName: 'D FIYONA 8.500 (REL*REL)',
      lotNo: '',
      transportName: '',
      vehicleNo: '',
      station: 'SURAT',
      ratePerMeter: '',
      status: 'pending',
      billNumber: '',
      notes: 'NO ANY WIVING DEFECT GURANTEE ON GREY SO CHEK AND SEND MILL......ONLY PRINT QUALITY',
      takaList: Array(72).fill(''),
      lotList: Array(72).fill(''),
      companyName: activeCompany?.businessName || profile?.businessName || '',
      companyGstin: activeCompany?.gstin || profile?.gstin || '',
      financialYear: activeFY || getIndianFinancialYear(),
    });
    setActiveTab('new');
  };

  // Load Manoj Enterprise Sample Data (48 Takas matching User's PDF)
  const handleLoadSuratSample = () => {
    const list = Array(72).fill('');
    MANOJ_ENTERPRISE_SAMPLE_METERS.forEach((m, idx) => {
      list[idx] = m.toFixed(2);
    });

    setCurrentChallan({
      id: 'ch_' + Date.now(),
      challanNumber: '52',
      challanDate: '2026-09-29',
      clientName: 'RAJ RATAN FASHION',
      clientGstin: '24AUCPS7939J1Z3',
      clientAddress: 'SHOP NO-1664-1665, RADHA KRISHNA MARKET, RING ROAD, SURAT',
      clientPhone: '',
      clientState: 'Gujarat',
      brokerName: 'JAGDISH PUROHIT',
      itemName: 'D FIYONA 8.500 (REL*REL)',
      lotNo: '3',
      transportName: 'LOCAL TEMPO',
      vehicleNo: '',
      station: 'SURAT',
      ratePerMeter: '18.50',
      status: 'pending',
      billNumber: '',
      notes: 'NO ANY WIVING DEFECT GURANTEE ON GREY SO CHEK AND SEND MILL......ONLY PRINT QUALITY',
      takaList: list,
      lotList: Array(72).fill('3'),
      companyName: activeCompany?.businessName || profile?.businessName || 'MANOJ ENTERPRISE',
      companyGstin: activeCompany?.gstin || profile?.gstin || '24AAVPP7272Q1ZK',
      financialYear: activeFY || getIndianFinancialYear(),
    });
    setActiveTab('new');
    toast('Loaded Manoj Enterprise 48-Taka Sample from PDF!', 'success');
  };

  // Edit existing challan
  const handleEditChallan = (ch) => {
    const list = Array(72).fill('');
    if (Array.isArray(ch.takaList)) {
      ch.takaList.forEach((v, idx) => {
        if (idx < 72) list[idx] = v;
      });
    }
    const lotList = Array(72).fill('');
    if (Array.isArray(ch.lotList)) {
      ch.lotList.forEach((v, idx) => {
        if (idx < 72) lotList[idx] = v;
      });
    }
    setCurrentChallan({
      ...ch,
      takaList: list,
      lotList: lotList,
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
    const found = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    if (found) {
      const assignedBroker = found.brokerName || found.broker || '';
      setCurrentChallan(prev => ({
        ...prev,
        clientName: found.name,
        clientGstin: found.gstin || prev.clientGstin || '',
        clientAddress: found.address || prev.clientAddress || '',
        clientPhone: found.phone || prev.clientPhone || '',
        clientState: found.state || prev.clientState,
        brokerName: assignedBroker || prev.brokerName || '',
      }));
      if (assignedBroker) {
        toast(`Selected party with Broker: ${assignedBroker}`, 'info');
      }
    } else {
      setCurrentChallan(prev => ({ ...prev, clientName }));
    }
  };

  // Direct GSTIN Sync for Challan
  const handleChallanGstinSync = async (rawGstin) => {
    const gstin = (rawGstin || currentChallan.clientGstin || '').trim().toUpperCase();
    if (!gstin || gstin.length < 15) {
      toast('Enter a valid 15-character GSTIN to auto-sync', 'info');
      return;
    }
    toast('Syncing GSTIN data...', 'info');
    try {
      const data = await lookupGstin(gstin);
      if (data) {
        // Check if there is an existing client in database with this GSTIN to pick broker
        const matchedClient = clients.find(c => (c.gstin || '').trim().toUpperCase() === gstin);
        const broker = matchedClient?.brokerName || matchedClient?.broker || '';
        
        setCurrentChallan(prev => ({
          ...prev,
          clientGstin: gstin,
          clientName: matchedClient?.name || data.tradeName || data.legalName || prev.clientName,
          clientAddress: matchedClient?.address || data.address || prev.clientAddress,
          clientState: data.state || matchedClient?.state || prev.clientState,
          brokerName: broker || prev.brokerName,
        }));
        toast(`Auto-filled: ${data.tradeName || gstin}${broker ? ` | Broker: ${broker}` : ''}`, 'success');
      }
    } catch {
      toast('Could not fetch GSTIN info', 'warn');
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
  const { totalTaka, totalMeters, avgMeter, totalAmount, columnSubtotals } = useMemo(() => {
    const list = currentChallan.takaList || [];
    let count = 0;
    let sum = 0;
    const colTotals = [0, 0, 0, 0, 0, 0];
    const colCounts = [0, 0, 0, 0, 0, 0];

    list.forEach((val, idx) => {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        count += 1;
        sum += num;
        const colIdx = Math.floor(idx / 12);
        if (colIdx < 6) {
          colTotals[colIdx] += num;
          colCounts[colIdx] += 1;
        }
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
      columnSubtotals: colTotals.map((tot, i) => ({
        total: Math.round(tot * 100) / 100,
        count: colCounts[i],
      })),
    };
  }, [currentChallan.takaList, currentChallan.ratePerMeter]);

  // Bulk paste meters into Taka list
  const handleApplyPaste = () => {
    if (!pasteText.trim()) {
      toast('Please enter meter numbers to paste', 'info');
      return;
    }
    const numbers = pasteText
      .split(/[\s,\n\t;]+/)
      .map(s => s.trim())
      .filter(s => s && !isNaN(Number(s)))
      .slice(0, 72);

    if (numbers.length === 0) {
      toast('No valid meter values found', 'info');
      return;
    }

    const next = [...currentChallan.takaList];
    numbers.forEach((n, idx) => {
      next[idx] = parseFloat(n).toFixed(2);
    });
    setCurrentChallan(prev => ({ ...prev, takaList: next }));
    setShowPasteModal(false);
    setPasteText('');
    toast(`Added ${numbers.length} Taka meters successfully`, 'success');
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
    if (onConvertToInvoice) {
      onConvertToInvoice({
        fromChallan: true,
        challanId: challan.id,
        challanNumber: challan.challanNumber,
        invoiceNumber: challan.challanNumber, // Sync challan & invoice number
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.45rem 0.75rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.15rem' }}>
            <Layers className="text-primary" size={20} /> 
            Surat Power Loom Delivery Challan (सूरत कपड़ा चालान)
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.75rem' }}>
            6-Column Piece &amp; Meter Taka List with column subtotals &amp; 2-in-1 print (Top &amp; Bottom copies on 1 A4 page)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeTab === 'list' ? (
            <>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={handleLoadSuratSample}
                title="Load Manoj Enterprise 48-Taka sample from PDF"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#1e40af' }}
              >
                <Sparkles size={14} /> Sample PDF (#52)
              </button>
              <button className="btn btn-primary" onClick={handleStartNew} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                <Plus size={15} /> New Challan (नया चालान)
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={() => setActiveTab('list')} style={{ fontSize: '0.78rem' }}>
              View All Challans (चालान सूची)
            </button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      {activeTab === 'list' && (
        <div className="glass-panel" style={{ padding: '0.85rem', marginBottom: '1rem' }}>
          {/* Search and Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search Challan No, Party, Broker, Lot..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '1.9rem', fontSize: '0.8rem', height: '28px' }}
              />
            </div>
            <div>
              <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ fontSize: '0.8rem', height: '28px' }}>
                <option value="all">All Status (सभी चालान)</option>
                <option value="pending">Pending Billed (बिल बाकी)</option>
                <option value="billed">Billed / Invoiced (बिल बन गया)</option>
              </select>
            </div>
            <div>
              <select className="form-input" value={brokerFilter} onChange={e => setBrokerFilter(e.target.value)} style={{ fontSize: '0.8rem', height: '28px' }}>
                <option value="all">All Brokers (सभी दलाल)</option>
                {brokers.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Challans Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading challans...</div>
          ) : filteredChallans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--border)', borderRadius: '8px' }}>
              <Layers size={32} style={{ opacity: 0.3, marginBottom: '0.35rem' }} />
              <p style={{ fontWeight: 600, margin: '0 0 0.35rem', fontSize: '0.9rem' }}>No delivery challans found</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Create a Surat powerloom piece-wise challan or test the Manoj Enterprise sample PDF.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={handleLoadSuratSample} style={{ fontSize: '0.8rem' }}>
                  <Sparkles size={14} /> Load PDF Sample (#52)
                </button>
                <button className="btn btn-primary" onClick={handleStartNew} style={{ fontSize: '0.8rem' }}>
                  <Plus size={14} /> Create Challan
                </button>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Date</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Challan No</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Party (Buyer)</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Broker (एजेंट)</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Item / Lot</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Total Taka</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Total Mtrs</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChallans.map((ch) => {
                    const isBilled = ch.status === 'billed';
                    return (
                      <tr key={ch.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.35rem 0.5rem' }}>{ch.challanDate}</td>
                        <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700, color: '#dc2626' }}>
                          #{ch.challanNumber}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>{ch.clientName}</td>
                        <td style={{ padding: '0.35rem 0.5rem', color: ch.brokerName ? '#dc2626' : 'var(--text-muted)' }}>
                          {ch.brokerName || '—'}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem' }}>
                          <div style={{ fontWeight: 600, color: '#1e40af' }}>{ch.itemName || 'Fabric'}</div>
                          {ch.lotNo && <small style={{ color: 'var(--text-muted)' }}>Lot: {ch.lotNo}</small>}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>
                          {ch.totalTaka || 0} Pcs
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                          {Number(ch.totalMeters || 0).toFixed(2)} m
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(ch.totalAmount || 0)}
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: isBilled ? 'var(--info-bg)' : 'var(--warn-bg)',
                            color: isBilled ? 'var(--info-text)' : 'var(--warn-text)',
                            border: `1px solid ${isBilled ? 'var(--info-border)' : 'var(--warn-border)'}`,
                          }}>
                            {isBilled ? 'Billed' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button
                              className="btn btn-primary"
                              title="Print 2-in-1 Surat Standard (2 Copies on 1 Page)"
                              onClick={() => {
                                setPrintChallan(ch);
                                setPrintMode('two-in-one');
                              }}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                            >
                              <Scissors size={12} /> 2-in-1 Print
                            </button>
                            <button
                              className="btn btn-secondary"
                              title="Print Full Page Detailed Challan"
                              onClick={() => {
                                setPrintChallan(ch);
                                setPrintMode('detailed');
                              }}
                              style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem' }}
                            >
                              <Printer size={12} /> 1-Page
                            </button>
                            {!isBilled && (
                              <button
                                className="btn btn-secondary"
                                title="Convert to Bill / Invoice"
                                onClick={() => handleConvertToBill(ch)}
                                style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', color: 'var(--primary)' }}
                              >
                                <ArrowRight size={12} /> Bill
                              </button>
                            )}
                            <button
                              className="btn btn-secondary"
                              title="Edit"
                              onClick={() => handleEditChallan(ch)}
                              style={{ padding: '0.25rem 0.4rem', fontSize: '0.72rem' }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-secondary"
                              title="Delete"
                              onClick={() => handleDeleteChallan(ch.id, ch.challanNumber)}
                              style={{ padding: '0.25rem 0.4rem', fontSize: '0.72rem', color: 'var(--danger)' }}
                            >
                              <Trash2 size={12} />
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
        <form ref={formRef} onSubmit={handleSaveChallan} className="glass-panel" style={{ padding: '0.85rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText className="text-primary" size={18} />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                {currentChallan.id ? `Edit Delivery Challan #${currentChallan.challanNumber}` : 'New Surat Delivery Challan (नया चालान)'}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleLoadSuratSample}
                style={{ fontSize: '0.78rem', color: '#1e40af' }}
              >
                <Sparkles size={14} /> Sample (#52)
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')} style={{ fontSize: '0.78rem' }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                Save Challan (चालान सेव करें)
              </button>
            </div>
          </div>

          {/* Challan Meta Fields - Compact Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '0.45rem', marginBottom: '0.5rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Challan No (चालान नं) *</label>
              <input
                type="text"
                className="form-input"
                required
                value={currentChallan.challanNumber}
                onChange={e => setCurrentChallan({ ...currentChallan, challanNumber: e.target.value })}
                placeholder="e.g. 52 or 101"
                style={{ fontSize: '0.82rem', height: '28px', fontWeight: 700 }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Challan Date (तारीख) *</label>
              <input
                type="date"
                className="form-input"
                required
                value={currentChallan.challanDate}
                onChange={e => setCurrentChallan({ ...currentChallan, challanDate: e.target.value })}
                style={{ fontSize: '0.82rem', height: '28px' }}
              />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Party Name (खरीददार पार्टी) *</label>
              <input
                type="text"
                className="form-input"
                required
                list="client-suggestions"
                value={currentChallan.clientName}
                onChange={e => handleSelectClient(e.target.value)}
                placeholder="e.g. RAJ RATAN FASHION"
                style={{ fontSize: '0.82rem', height: '28px', fontWeight: 600 }}
              />
              <datalist id="client-suggestions">
                {clients.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', marginBottom: '2px' }}>
                <span>Party GSTIN</span>
                <button
                  type="button"
                  onClick={() => handleChallanGstinSync()}
                  style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}
                  title="Direct GSTIN lookup & auto-fill"
                >
                  ⚡ Sync GST
                </button>
              </label>
              <div style={{ display: 'flex', gap: '3px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={currentChallan.clientGstin}
                  onChange={e => setCurrentChallan({ ...currentChallan, clientGstin: e.target.value.toUpperCase() })}
                  onBlur={() => {
                    if (currentChallan.clientGstin && currentChallan.clientGstin.length === 15 && !currentChallan.clientName) {
                      handleChallanGstinSync(currentChallan.clientGstin);
                    }
                  }}
                  placeholder="e.g. 24AUCPS7939J1Z3"
                  maxLength={15}
                  style={{ fontSize: '0.82rem', height: '28px', textTransform: 'uppercase' }}
                />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', marginBottom: '2px' }}>
                <span>Agent / Broker (दलाल)</span>
                <button
                  type="button"
                  onClick={() => setShowBrokerModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}
                >
                  + Add
                </button>
              </label>
              <input
                type="text"
                className="form-input"
                list="broker-suggestions"
                placeholder="e.g. JAGDISH PUROHIT"
                value={currentChallan.brokerName}
                onChange={e => setCurrentChallan({ ...currentChallan, brokerName: e.target.value })}
                style={{ fontSize: '0.82rem', height: '28px', color: currentChallan.brokerName ? '#dc2626' : undefined, fontWeight: currentChallan.brokerName ? 600 : undefined }}
              />
              <datalist id="broker-suggestions">
                {brokers.map(b => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Compact Row 2: Market Address, Station, Quality, Lot No, Rate, Transport */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.45rem', marginBottom: '0.75rem', background: 'var(--bg-secondary)', padding: '0.5rem 0.65rem', borderRadius: '8px' }}>
            <div className="form-group" style={{ margin: 0, minWidth: '220px', gridColumn: 'span 2' }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Party Surat Market Address (दुकान / मार्केट नं)</label>
              <input
                type="text"
                className="form-input"
                list="surat-market-suggestions"
                placeholder="SHOP NO-1664-1665, RADHA KRISHNA MARKET, RING ROAD, SURAT"
                value={currentChallan.clientAddress}
                onChange={e => setCurrentChallan({ ...currentChallan, clientAddress: e.target.value })}
                style={{ fontSize: '0.82rem', height: '28px' }}
              />
              <datalist id="surat-market-suggestions">
                {SURAT_MARKET_PRESETS.map((m, i) => (
                  <option key={i} value={m} />
                ))}
              </datalist>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Station / City (स्टेशन)</label>
              <input
                type="text"
                className="form-input"
                placeholder="SURAT"
                value={currentChallan.station}
                onChange={e => setCurrentChallan({ ...currentChallan, station: e.target.value })}
                style={{ fontSize: '0.82rem', height: '28px' }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Item / Quality (क्वालिटी)</label>
              <input
                type="text"
                className="form-input"
                list="quality-suggestions"
                placeholder="D FIYONA 8.500 (REL*REL)"
                value={currentChallan.itemName}
                onChange={e => setCurrentChallan({ ...currentChallan, itemName: e.target.value })}
                style={{ fontSize: '0.82rem', height: '28px', fontWeight: 600 }}
              />
              <datalist id="quality-suggestions">
                {SURAT_QUALITY_PRESETS.map((q, i) => (
                  <option key={i} value={q} />
                ))}
              </datalist>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Lot No (लॉट नं)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 3"
                value={currentChallan.lotNo}
                onChange={e => setCurrentChallan({ ...currentChallan, lotNo: e.target.value })}
                style={{ fontSize: '0.82rem', height: '28px', fontWeight: 700, color: '#dc2626' }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Rate (₹ दर/m)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="₹ / Meter"
                value={currentChallan.ratePerMeter}
                onChange={e => setCurrentChallan({ ...currentChallan, ratePerMeter: e.target.value })}
                style={{ fontSize: '0.82rem', height: '28px' }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Transport / Tempo</label>
              <input
                type="text"
                className="form-input"
                placeholder="LOCAL TEMPO / VEHICLE NO"
                value={currentChallan.transportName}
                onChange={e => setCurrentChallan({ ...currentChallan, transportName: e.target.value })}
                style={{ fontSize: '0.82rem', height: '28px' }}
              />
            </div>
          </div>

          {/* 72 Taka Grid Section */}
          <div style={{ marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>
                  Piece &amp; Meter Taka List (6 Columns × 12 Rows = 72 Taka Capacity)
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Type meter and press <strong>Enter</strong> to jump straight to next piece.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                  onClick={() => setShowPasteModal(true)}
                >
                  <ClipboardPaste size={13} /> Bulk Paste
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', color: 'var(--danger)' }}
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: 'Clear Taka Grid?',
                      message: 'Are you sure you want to clear all entered meters?',
                      confirmLabel: 'Clear All',
                      danger: true,
                    });
                    if (ok) setCurrentChallan({ ...currentChallan, takaList: Array(72).fill(''), lotList: Array(72).fill('') });
                  }}
                >
                  ✕ Clear
                </button>
              </div>
            </div>

            {/* Live Tally Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.45rem', marginBottom: '0.65rem' }}>
              <div style={{ background: 'var(--primary-light)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(37,99,235,0.2)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--primary)' }}>TOTAL TAKA (थान)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalTaka} <small style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ 72</small></div>
              </div>
              <div style={{ background: 'rgba(5,150,105,0.08)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(5,150,105,0.2)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#059669' }}>TOTAL METERS (कुल मीटर)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669' }}>{totalMeters.toFixed(2)} <small style={{ fontSize: '0.72rem', fontWeight: 500 }}>Mtr</small></div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)' }}>AVERAGE / TAKA</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{avgMeter.toFixed(2)} <small style={{ fontSize: '0.72rem', fontWeight: 500 }}>Mtr</small></div>
              </div>
              <div style={{ background: 'rgba(124,58,237,0.08)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--purple)' }}>ESTIMATED TOTAL</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--purple)' }}>{formatCurrency(totalAmount)}</div>
              </div>
            </div>

            {/* 6 Columns Grid: Sr No 1 to 12 Up-to-Down per Column */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '4px',
              overflowX: 'auto',
              background: 'var(--bg-primary)',
              padding: '6px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
            }}>
              {Array.from({ length: 6 }).map((_, colIdx) => (
                <div 
                  key={colIdx} 
                  style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    minWidth: '105px',
                  }}
                >
                  <div style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    padding: '2px 0',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--primary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingInline: '4px'
                  }}>
                    <span>Srl</span>
                    <span>Meters</span>
                  </div>

                  {Array.from({ length: 12 }).map((__, rowIdx) => {
                    const idx = colIdx * 12 + rowIdx;
                    const val = currentChallan.takaList[idx] || '';
                    const isFilled = parseFloat(val) > 0;
                    return (
                      <div 
                        key={idx} 
                        style={{
                          background: isFilled ? 'var(--card-bg)' : 'transparent',
                          border: isFilled ? '1px solid var(--primary)' : '1px dashed var(--border)',
                          borderRadius: '3px',
                          padding: '1px 3px',
                          display: 'grid',
                          gridTemplateColumns: '22px 1fr',
                          gap: '2px',
                          alignItems: 'center',
                          height: '24px',
                        }}
                      >
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: isFilled ? 'var(--primary)' : 'var(--text-muted)',
                        }}>
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input taka-input"
                          placeholder="0.00"
                          value={val}
                          onChange={e => handleTakaChange(idx, e.target.value)}
                          title="Enter Meter (e.g. 120.00)"
                          style={{
                            padding: '1px 4px',
                            fontSize: '0.76rem',
                            fontWeight: isFilled ? 700 : 400,
                            textAlign: 'right',
                            background: 'transparent',
                            border: 'none',
                            height: '22px',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        />
                      </div>
                    );
                  })}

                  {/* Live Column Subtotal */}
                  <div style={{
                    marginTop: '2px',
                    padding: '3px 4px',
                    background: 'var(--bg-tertiary)',
                    borderTop: '1px solid var(--border)',
                    borderRadius: '2px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sub:</span>
                    <span style={{ color: columnSubtotals[colIdx]?.total > 0 ? '#059669' : 'inherit' }}>
                      {columnSubtotals[colIdx]?.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weaving Defect Disclaimer / Notes & Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Weaving Terms / Disclaimer (सूरत पावरलूम गारंटी नोट)</label>
              <input
                type="text"
                className="form-input"
                placeholder="NO ANY WIVING DEFECT GURANTEE ON GREY SO CHEK AND SEND MILL......ONLY PRINT QUALITY"
                value={currentChallan.notes}
                onChange={e => setCurrentChallan({ ...currentChallan, notes: e.target.value })}
                style={{ fontSize: '0.78rem', height: '28px', color: '#dc2626', fontWeight: 600 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.45rem 1.1rem', fontWeight: 700, fontSize: '0.82rem' }}>
                Save Challan
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Bulk Paste Modal */}
      {showPasteModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{ maxWidth: '420px', width: '90%', padding: '1.25rem', borderRadius: '10px', background: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ClipboardPaste size={16} /> Bulk Paste Meters (ताका मीटर पेस्ट करें)
              </h3>
              <button type="button" onClick={() => setShowPasteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
              Paste space, comma, or newline-separated meters copied from WhatsApp, Excel, or folding slips:
            </p>
            <textarea
              className="form-input"
              rows={6}
              placeholder="e.g. 120.00 121.00 121.50 122.00 122.75 123.50..."
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem', fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPasteModal(false)} style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleApplyPaste} style={{ fontSize: '0.8rem' }}>
                Apply Meters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Broker Modal */}
      {showBrokerModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{ maxWidth: '380px', width: '90%', padding: '1.25rem', borderRadius: '10px', background: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Add New Broker (दलाल / एजेंट)</h3>
              <button type="button" onClick={() => setShowBrokerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Broker Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={newBrokerName}
                onChange={e => setNewBrokerName(e.target.value)}
                placeholder="e.g. JAGDISH PUROHIT"
                style={{ fontSize: '0.82rem', height: '28px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Phone Number</label>
              <input
                type="tel"
                className="form-input"
                value={newBrokerPhone}
                onChange={e => setNewBrokerPhone(e.target.value)}
                placeholder="e.g. 9825012345"
                style={{ fontSize: '0.82rem', height: '28px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBrokerModal(false)} style={{ fontSize: '0.8rem' }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveBroker} style={{ fontSize: '0.8rem' }}>Save Broker</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printChallan && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '0.5rem',
        }}>
          <div className="modal-content" style={{
            maxWidth: '850px', width: '100%', maxHeight: '96vh', overflowY: 'auto',
            background: '#ffffff', color: '#0f172a', padding: '1rem', borderRadius: '8px'
          }}>
            {/* Modal Actions Bar (Not Printed) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.82rem' }}>Print Format:</strong>
                <button
                  type="button"
                  className={`btn ${printMode === 'two-in-one' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPrintMode('two-in-one')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', fontWeight: printMode === 'two-in-one' ? 700 : 500 }}
                >
                  ✂ 2 Copies on 1 Page (Surat Mill Standard)
                </button>
                <button
                  type="button"
                  className={`btn ${printMode === 'detailed' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPrintMode('detailed')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                >
                  1 Full Page Detailed
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sort:</span>
                <select
                  className="form-input"
                  value={meterSort}
                  onChange={e => setMeterSort(e.target.value)}
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', width: 'auto', height: '26px' }}
                >
                  <option value="as-is">As Entered (मूल क्रम)</option>
                  <option value="asc">Ascending (चढ़ता क्रम)</option>
                  <option value="desc">Descending (उतरता क्रम)</option>
                </select>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
                >
                  <Printer size={14} /> Print (Ctrl+P)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPrintChallan(null)}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Print Document Body */}
            <div id="printable-challan" style={{ background: '#ffffff', color: '#111827', fontFamily: 'Arial, sans-serif' }}>
              {printMode === 'two-in-one' ? (
                /* FORMAT: 2 COPIES ON 1 A4 PAGE (SURAT POWER LOOM STANDARD) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {/* TOP COPY: ORIGINAL (PARTY / MILL COPY) */}
                  <SuratChallanDoc
                    challan={printChallan}
                    company={activeCompany || profile}
                    takaEntries={sortedTakaEntries}
                    copyBadge="ORIGINAL - PARTY / MILL COPY"
                    isCompact={true}
                  />

                  {/* SCISSOR CUT LINE */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '2px 0',
                    color: '#64748b', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase'
                  }}>
                    <span style={{ flex: 1, borderTop: '1px dashed #94a3b8' }} />
                    <Scissors size={12} /> ✂ CUT HERE / यहाँ से काटें ✂
                    <span style={{ flex: 1, borderTop: '1px dashed #94a3b8' }} />
                  </div>

                  {/* BOTTOM COPY: DUPLICATE (TRANSPORT / DRIVER COPY) */}
                  <SuratChallanDoc
                    challan={printChallan}
                    company={activeCompany || profile}
                    takaEntries={sortedTakaEntries}
                    copyBadge="DUPLICATE - TRANSPORT / DRIVER COPY"
                    isCompact={true}
                  />
                </div>
              ) : (
                /* FORMAT: SINGLE FULL PAGE DETAILED CHALLAN */
                <SuratChallanDoc
                  challan={printChallan}
                  company={activeCompany || profile}
                  takaEntries={sortedTakaEntries}
                  copyBadge="ORIGINAL - PARTY COPY"
                  isCompact={false}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Surat Power Loom Exact Delivery Challan matching Manoj Enterprise Sample PDF
function SuratChallanDoc({ challan, company, takaEntries, copyBadge, isCompact }) {
  // Compute column entries & column subtotals across 6 columns
  const cols = useMemo(() => {
    const columns = Array.from({ length: 6 }, () => []);
    const subtotals = [0, 0, 0, 0, 0, 0];

    takaEntries.forEach((entry, idx) => {
      const colIdx = Math.floor(idx / 12);
      if (colIdx < 6) {
        columns[colIdx].push(entry);
        subtotals[colIdx] += entry.meter;
      }
    });

    return { columns, subtotals };
  }, [takaEntries]);

  const totalTakas = takaEntries.length || challan.totalTaka || 0;
  const grandTotalMeters = takaEntries.reduce((s, i) => s + i.meter, 0) || challan.totalMeters || 0;

  // Format date DD/MM/YYYY
  const formattedDate = useMemo(() => {
    if (!challan.challanDate) return '';
    const parts = challan.challanDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return challan.challanDate;
  }, [challan.challanDate]);

  const companyName = company?.businessName || challan.companyName || 'MANOJ ENTERPRISE';
  const companyAddress = company?.address || 'PLOT NO. 145, HARIOM INDUSTRIAL SOCIETY NO. 1, BAMROLI, SURAT SURAT';
  const companyGstin = company?.gstin || challan.companyGstin || '24AAVPP7272Q1ZK';
  const companyPhone = company?.phone || 'PAYMENT - 9427809821 Mobile : 8200290410';

  const pad = isCompact ? '2px 4px' : '4px 6px';
  const fontSize = isCompact ? '8.5px' : '11px';

  return (
    <div style={{
      border: '1.5px solid #000',
      padding: isCompact ? '4px 8px' : '10px 14px',
      background: '#fff',
      color: '#000',
      fontSize,
      lineHeight: 1.25,
      boxSizing: 'border-box',
    }}>
      {/* Top Bar: Religious Inscription + Copy Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1px' }}>
        <span style={{ fontSize: isCompact ? '8px' : '10px', fontWeight: 700, color: '#dc2626' }}>॥ श्री: ॥</span>
        <span style={{
          fontSize: isCompact ? '7.5px' : '9.5px',
          fontWeight: 700,
          background: '#f1f5f9',
          border: '1px solid #cbd5e1',
          padding: '0 4px',
          borderRadius: '3px',
          textTransform: 'uppercase'
        }}>
          {copyBadge}
        </span>
      </div>

      {/* Mill / Firm Header */}
      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
        <h2 style={{
          margin: 0,
          fontSize: isCompact ? '15px' : '20px',
          fontWeight: 900,
          color: '#0000ff', // Match Manoj Enterprise blue
          letterSpacing: '0.04em',
        }}>
          {companyName}
        </h2>
        <div style={{ fontSize: isCompact ? '8px' : '10px', color: '#400040', fontWeight: 600 }}>
          {companyAddress}
        </div>
        <div style={{ fontSize: isCompact ? '8.5px' : '10.5px', marginTop: '1px' }}>
          <strong style={{ color: '#ff0000' }}>GST NO : {companyGstin}</strong>
          <span style={{ marginLeft: '10px', color: '#400040' }}>Phone : {companyPhone}</span>
        </div>
      </div>

      {/* Boxed Title: DELIVERY CHALLAN */}
      <div style={{ textAlign: 'center', margin: isCompact ? '1px 0 3px' : '3px 0 5px' }}>
        <span style={{
          display: 'inline-block',
          border: '1.5px solid #000',
          padding: isCompact ? '1px 16px' : '2px 24px',
          fontWeight: 900,
          fontSize: isCompact ? '10px' : '13px',
          color: '#000080',
          letterSpacing: '0.08em',
        }}>
          DELIVERY CHALLAN
        </span>
      </div>

      {/* Two-Column Party & Challan Box */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        border: '1px solid #000',
        marginBottom: '2px',
      }}>
        {/* Left: Party Details */}
        <div style={{ padding: pad, borderRight: '1px solid #000' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <strong>Party :</strong>
            <span style={{ fontWeight: 800, color: '#000080', fontSize: isCompact ? '9.5px' : '12px' }}>
              {challan.clientName}
            </span>
          </div>
          <div style={{ fontSize: isCompact ? '8px' : '10px', color: '#444', marginTop: '1px', textTransform: 'uppercase' }}>
            {challan.clientAddress || 'SURAT'}
          </div>
          <div style={{ marginTop: '1px', fontSize: isCompact ? '8.5px' : '10.5px' }}>
            <strong style={{ color: '#400040' }}>GST NO : </strong>
            <span style={{ fontWeight: 800, color: '#400040' }}>{challan.clientGstin || '—'}</span>
          </div>
        </div>

        {/* Right: Challan No, Date, Agent */}
        <div style={{ padding: pad, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1px' }}>
            <strong>Challan No.:</strong>
            <strong style={{ color: '#ff0000', fontSize: isCompact ? '10px' : '12px' }}>
              {challan.challanNumber}
            </strong>

            <strong>Date :</strong>
            <span>{formattedDate}</span>

            <strong style={{ color: '#ff0000' }}>Agent :-</strong>
            <strong style={{ color: '#ff0000' }}>
              {challan.brokerName || '—'}
            </strong>
          </div>
        </div>
      </div>

      {/* Quality Row */}
      <div style={{
        border: '1px solid #000',
        borderTop: 'none',
        padding: pad,
        marginBottom: '2px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <strong>Quality : </strong>
          <span style={{ fontWeight: 800, color: '#0000ff' }}>
            {challan.itemName || 'D FIYONA 8.500 (REL*REL)'}
          </span>
        </div>
        {challan.station && (
          <div style={{ fontSize: isCompact ? '8px' : '10px' }}>
            <strong>Station : </strong> {challan.station}
          </div>
        )}
      </div>

      {/* 6 Dual Columns Grid Table: Srl | Meters */}
      <div style={{
        border: '1px solid #000',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
      }}>
        {Array.from({ length: 6 }).map((_, cIdx) => {
          const colItems = cols.columns[cIdx] || [];
          return (
            <div 
              key={cIdx} 
              style={{
                borderRight: cIdx < 5 ? '1px solid #000' : 'none',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Column Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '22px 1fr',
                borderBottom: '1px solid #000',
                background: '#f8fafc',
                fontSize: isCompact ? '8px' : '10px',
                fontWeight: 700,
                textAlign: 'center',
                padding: '1px 0',
              }}>
                <span style={{ borderRight: '1px solid #000' }}>Srl</span>
                <span>Meters</span>
              </div>

              {/* 12 Rows per column */}
              {Array.from({ length: 12 }).map((__, rIdx) => {
                const item = colItems[rIdx];
                const srlNo = cIdx * 12 + rIdx + 1;
                return (
                  <div
                    key={rIdx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px 1fr',
                      borderBottom: rIdx < 11 ? '1px dotted #ccc' : 'none',
                      fontSize: isCompact ? '8px' : '10px',
                      height: isCompact ? '13px' : '18px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{
                      textAlign: 'center',
                      borderRight: '1px solid #000',
                      color: item ? '#000' : 'transparent',
                      fontWeight: 600,
                    }}>
                      {item ? srlNo : '.'}
                    </span>
                    <span style={{
                      textAlign: 'right',
                      paddingRight: '4px',
                      fontFamily: 'monospace',
                      fontWeight: item ? 700 : 400,
                    }}>
                      {item ? item.meter.toFixed(2) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Column Subtotals Row */}
      <div style={{
        border: '1px solid #000',
        borderTop: 'none',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        background: '#f8fafc',
        fontWeight: 800,
        fontSize: isCompact ? '8px' : '10px',
      }}>
        {Array.from({ length: 6 }).map((_, cIdx) => (
          <div
            key={cIdx}
            style={{
              borderRight: cIdx < 5 ? '1px solid #000' : 'none',
              textAlign: 'right',
              padding: '1px 4px',
              fontFamily: 'monospace',
            }}
          >
            {cols.subtotals[cIdx] > 0 ? cols.subtotals[cIdx].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
        ))}
      </div>

      {/* Grand Totals Bar */}
      <div style={{
        border: '1px solid #000',
        borderTop: 'none',
        padding: pad,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: isCompact ? '9px' : '11.5px',
        fontWeight: 800,
      }}>
        <div>
          <span>Total Taka : </span>
          <span style={{ fontSize: isCompact ? '10px' : '13px', marginLeft: '4px' }}>
            {totalTakas}
          </span>
        </div>
        <div>
          <span>Total Mtrs : </span>
          <span style={{ fontSize: isCompact ? '10.5px' : '14px', marginLeft: '4px', color: '#000080' }}>
            {grandTotalMeters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        {challan.ratePerMeter && parseFloat(challan.ratePerMeter) > 0 && (
          <div>
            <span>Rate : </span>
            <span style={{ marginLeft: '2px' }}>₹{parseFloat(challan.ratePerMeter).toFixed(2)}</span>
            <span style={{ marginLeft: '10px' }}>Est. Amt : </span>
            <span style={{ color: '#059669' }}>{formatCurrency(grandTotalMeters * parseFloat(challan.ratePerMeter))}</span>
          </div>
        )}
      </div>

      {/* Footer: For Mill (left), LOT NO (center bold red), Receiver Sign (right) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: isCompact ? '4px 2px 2px' : '8px 4px 4px',
        fontSize: isCompact ? '8.5px' : '11px',
      }}>
        <div>
          <span>For, </span>
          <strong style={{ color: '#ff0000' }}>{companyName}</strong>
        </div>

        <div style={{ textAlign: 'center' }}>
          <strong style={{ color: '#ff0000', fontSize: isCompact ? '10px' : '13px' }}>
            LOT NO={challan.lotNo || '—'}
          </strong>
        </div>

        <div>
          <strong>Receiver Sign __________</strong>
        </div>
      </div>

      {/* Surat Weaving Guarantee Disclaimer Note */}
      <div style={{
        borderTop: '1px solid #000',
        marginTop: '2px',
        paddingTop: '2px',
        textAlign: 'center',
        fontSize: isCompact ? '7px' : '9px',
        fontWeight: 800,
        letterSpacing: '0.02em',
      }}>
        <span style={{ color: '#ff0000' }}>
          NO ANY WIVING DEFECT GURANTEE ON GREY SO CHEK AND SEND MILL......
        </span>
        <span style={{ color: '#0000ff' }}>
          ONLY PRINT QUALITY
        </span>
      </div>
    </div>
  );
}
