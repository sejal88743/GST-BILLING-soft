import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, BarChart3, Clock, Search, X, Users, Package, Boxes, ShoppingCart, FileText, UserCheck, Calendar, Filter, Building2, Eye, ArrowUpDown, Layers, CheckCircle2 } from 'lucide-react';
import { getAllBills, getAllExpenses, getProfile, getAllPurchases, getAllBrokers, getAllProfiles } from '../store';
import { formatCurrency, getFYOptions, belongsToProfile, isCancelledBill, salesSign, countsAsSales, calculateLineItemTax, roundQty, parseLocalDate, amountDue } from '../utils';
import { matchesCompanyAndYear, getRecordCompanyName, extractAllCompanies } from '../utils/companyContext';
import { toast } from './Toast';
import HelpButton from './HelpButton';
import PartyOutstandingReport from './PartyOutstandingReport';
import StockReport from './StockReport';
import TableExport from './TableExport';
import { billCurrency } from '../utils/partyOutstanding';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const getBillCurrency = billCurrency;

function getDatePresetRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  if (preset === 'today') {
    return { from: todayStr, to: todayStr };
  }
  if (preset === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const ym = String(yest.getMonth() + 1).padStart(2, '0');
    const yd = String(yest.getDate()).padStart(2, '0');
    return { from: `${yest.getFullYear()}-${ym}-${yd}`, to: `${yest.getFullYear()}-${ym}-${yd}` };
  }
  if (preset === 'this_week') {
    const start = new Date(now);
    const day = start.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    start.setDate(start.getDate() - diff);
    const sm = String(start.getMonth() + 1).padStart(2, '0');
    const sd = String(start.getDate()).padStart(2, '0');
    return { from: `${start.getFullYear()}-${sm}-${sd}`, to: todayStr };
  }
  if (preset === 'this_month') {
    return { from: `${y}-${m}-01`, to: todayStr };
  }
  if (preset === 'last_month') {
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? y - 1 : y;
    const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    const pmStr = String(prevMonth + 1).padStart(2, '0');
    return { from: `${prevYear}-${pmStr}-01`, to: `${prevYear}-${pmStr}-${String(lastDay).padStart(2, '0')}` };
  }
  if (preset === 'this_fy') {
    const month = now.getMonth() + 1;
    const startY = month >= 4 ? y : y - 1;
    return { from: `${startY}-04-01`, to: `${startY + 1}-03-31` };
  }
  return { from: '', to: '' };
}

export default function ReportsView({ activeProfile, activeFY }) {
  const [rawBills, setRawBills] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);
  const [rawPurchases, setRawPurchases] = useState([]);
  const [rawProfiles, setRawProfiles] = useState([]);
  const [baseProfile, setBaseProfile] = useState(null);
  const [brokers, setBrokers] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('all'); // 'all' for consolidated, or company id / name

  const [activeTab, setActiveTab] = useState('sales'); // Default to Sales Report
  const [filterMode, setFilterMode] = useState('fy');
  const [fyFilter, setFyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [agingSearch, setAgingSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('INR');
  const [businessName, setBusinessName] = useState('');

  // Sales Report Filters & View Modes
  const [salesViewMode, setSalesViewMode] = useState('date'); // 'date' | 'party'
  const [salesSortOrder, setSalesSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [salesDatePreset, setSalesDatePreset] = useState('all');
  const [salesSearch, setSalesSearch] = useState('');
  const [salesParty, setSalesParty] = useState('');
  const [salesBroker, setSalesBroker] = useState('');
  const [salesFrom, setSalesFrom] = useState('');
  const [salesTo, setSalesTo] = useState('');
  const [partyDetailModal, setPartyDetailModal] = useState(null);

  // Purchase Report Filters & View Modes
  const [purchaseViewMode, setPurchaseViewMode] = useState('date'); // 'date' | 'party'
  const [purchaseDatePreset, setPurchaseDatePreset] = useState('all');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseParty, setPurchaseParty] = useState('');
  const [purchaseBroker, setPurchaseBroker] = useState('');
  const [purchaseFrom, setPurchaseFrom] = useState('');
  const [purchaseTo, setPurchaseTo] = useState('');

  // Broker Report State
  const [brokerSearch, setBrokerSearch] = useState('');
  const [selectedBroker, setSelectedBroker] = useState(null);

  const fyOptions = getFYOptions();
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  const loadData = async () => {
    try {
      const [billData, expData, purData, brkData, prof, allProf] = await Promise.all([
        getAllBills().catch(() => []),
        getAllExpenses().catch(() => []),
        getAllPurchases().catch(() => []),
        getAllBrokers().catch(() => []),
        getProfile().catch(() => null),
        getAllProfiles().catch(() => []),
      ]);
      const currentComp = activeProfile || prof;
      setBaseProfile(currentComp);
      setRawProfiles(allProf || []);
      setRawBills(billData || []);
      setRawExpenses(expData || []);
      setRawPurchases(purData || []);
      setBrokers(brkData || []);
      setBusinessName(currentComp?.businessName || '');
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  useEffect(() => {
    const now = new Date();
    const fy = fyOptions[0];
    if (fy) setFyFilter(activeFY && activeFY !== 'all' ? activeFY : fy.value);
    setYearFilter(String(now.getFullYear()));
    setMonthFilter(String(now.getMonth()));
    loadData();
  }, [activeFY, activeProfile]);

  // Aggregate all discovered companies from profiles & bills
  const allCompanies = useMemo(() => {
    return extractAllCompanies([baseProfile, ...rawProfiles], rawBills);
  }, [baseProfile, rawProfiles, rawBills]);

  // Active filtered company
  const selectedCompany = useMemo(() => {
    if (selectedCompanyId === 'all') return null;
    return allCompanies.find(c => c.id === selectedCompanyId || c.businessName === selectedCompanyId) || null;
  }, [selectedCompanyId, allCompanies]);

  // Scoped lists according to selected company and financial year
  const bills = useMemo(() => {
    return (rawBills || []).filter(b => matchesCompanyAndYear(b, selectedCompany, activeFY) && !isCancelledBill(b));
  }, [rawBills, selectedCompany, activeFY]);

  const expenses = useMemo(() => {
    return (rawExpenses || []).filter(e => matchesCompanyAndYear(e, selectedCompany, activeFY));
  }, [rawExpenses, selectedCompany, activeFY]);

  const purchases = useMemo(() => {
    return (rawPurchases || []).filter(p => matchesCompanyAndYear(p, selectedCompany, activeFY));
  }, [rawPurchases, selectedCompany, activeFY]);

  const applySalesDatePreset = (preset) => {
    setSalesDatePreset(preset);
    const { from, to } = getDatePresetRange(preset);
    setSalesFrom(from);
    setSalesTo(to);
  };

  const applyPurchaseDatePreset = (preset) => {
    setPurchaseDatePreset(preset);
    const { from, to } = getDatePresetRange(preset);
    setPurchaseFrom(from);
    setPurchaseTo(to);
  };


  const filterByPeriod = (date) => {
    if (!date) return false;
    if (filterMode === 'fy') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      return fy ? date >= fy.from && date <= fy.to : true;
    } else {
      const d = parseLocalDate(date); // local date: UTC midnight is the previous day west of Greenwich
      return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === parseInt(monthFilter);
    }
  };

  // Only real sales and credit notes, the same rule as the Dashboard: a
  // proforma is a quote and a challan moves goods without selling them, so
  // neither is revenue; a credit note reduces revenue (salesSign -1).
  const allFilteredBills = bills.filter(bill => bill.data && salesSign(bill) !== 0 && filterByPeriod(bill.invoiceDate));
  // v1.10.1 — Filter expenses by the same currency as the P&L view.
  // Prior code left this unfiltered, so USD-invoice revenue got INR
  // expenses subtracted → nonsense net profit. Expenses without a
  // `currency` field are assumed INR (legacy records).
  const filteredExpenses = expenses.filter(exp =>
    filterByPeriod(exp.date) && ((exp.currency || 'INR') === currencyFilter));

  // All distinct currencies in the filtered period
  const allCurrencies = useMemo(() => [...new Set(allFilteredBills.map(getBillCurrency))].sort(), [allFilteredBills]);
  const activeCurrency = (allCurrencies.length > 0 && !allCurrencies.includes(currencyFilter)) ? allCurrencies[0] : currencyFilter;

  // v1.10.77 (#85) - the period in words, for exported reports.
  const periodLabel = filterMode === 'fy'
    ? (fyOptions.find(f => f.value === fyFilter)?.label || '')
    : `${MONTHS[parseInt(monthFilter)] || ''} ${yearFilter}`;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const exportSubtitle = (extra = '') => [businessName, periodLabel, activeCurrency !== 'INR' ? activeCurrency : '', extra].filter(Boolean).join(', ');

  // Bills for P&L — only selected currency
  const plBills = allFilteredBills.filter(b => getBillCurrency(b) === activeCurrency);

  // P&L
  // TCS on an invoice is collected for the government, like GST: it is in the
  // invoice total but is not income, so it is counted with the tax.
  const tcsOf = (b) => Number(b.data?.totals?.tcsAmount) || 0;
  const totalRevenue = plBills.reduce((s, b) => s + salesSign(b) * (b.totalAmount || 0), 0);
  const totalTaxCollected = plBills.reduce((s, b) => s + salesSign(b) * ((b.totalTaxAmount || 0) + tcsOf(b)), 0);
  const revenueExTax = totalRevenue - totalTaxCollected;
  const totalExpenseAmount = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalExpenseGST = filteredExpenses.reduce((s, e) => s + (e.gstAmount || 0), 0);
  const expenseExGST = totalExpenseAmount - totalExpenseGST;
  const netProfit = revenueExTax - expenseExGST;

  // Monthly breakdown — per selected currency
  const monthlyPL = {};
  plBills.forEach(b => {
    if (!b.invoiceDate) return;
    const key = b.invoiceDate.substring(0, 7);
    if (!monthlyPL[key]) monthlyPL[key] = { revenue: 0, tax: 0, expense: 0, expGst: 0 };
    monthlyPL[key].revenue += salesSign(b) * (b.totalAmount || 0);
    monthlyPL[key].tax += salesSign(b) * ((b.totalTaxAmount || 0) + tcsOf(b));
  });
  filteredExpenses.forEach(e => {
    if (!e.date) return;
    const key = e.date.substring(0, 7);
    if (!monthlyPL[key]) monthlyPL[key] = { revenue: 0, tax: 0, expense: 0, expGst: 0 };
    monthlyPL[key].expense += e.amount || 0;
    monthlyPL[key].expGst += e.gstAmount || 0;
  });
  const monthlyKeys = Object.keys(monthlyPL).sort();

  // ========== Outstanding & Aging ==========
  const today = new Date();
  // Money owed to you: only on sales (a quote, a challan or a credit note is
  // never a receivable).
  const unpaidBills = bills.filter(b => countsAsSales(b) && b.status !== 'paid');
  const agingData = unpaidBills.map(b => {
    // Guard against missing or invalid dates — `new Date(undefined)` returns Invalid Date
    // which propagates as NaN through the aging math and breaks the chart.
    const dueDate = b.data?.details?.dueDate || b.invoiceDate;
    const due = dueDate ? parseLocalDate(dueDate) : null;
    const daysOverdue = (due && !isNaN(due.getTime()))
      ? Math.max(0, Math.floor((today - due) / 86400000))
      : 0;
    // Less TDS the client deducts: they pay Net Receivable.
    const outstanding = amountDue(b) - (b.paidAmount || 0);
    let bucket = 'current';
    if (daysOverdue > 90) bucket = '90plus';
    else if (daysOverdue > 60) bucket = '61to90';
    else if (daysOverdue > 30) bucket = '31to60';
    return {
      clientName: b.clientName || 'Unknown',
      companyName: getRecordCompanyName(b, businessName),
      invoiceNumber: b.invoiceNumber,
      invoiceDate: b.invoiceDate,
      dueDate,
      totalAmount: b.totalAmount || 0,
      paidAmount: b.paidAmount || 0,
      outstanding,
      daysOverdue,
      bucket,
      currency: getBillCurrency(b),
    };
  }).filter(r => r.outstanding > 0);

  const agingFiltered = agingSearch.trim()
    ? agingData.filter(r =>
        r.clientName.toLowerCase().includes(agingSearch.toLowerCase()) ||
        r.companyName.toLowerCase().includes(agingSearch.toLowerCase()) ||
        (r.invoiceNumber || '').toLowerCase().includes(agingSearch.toLowerCase())
      )
    : agingData;

  // Aging summary — group by currency
  const agingByCurrency = {};
  agingFiltered.forEach(r => {
    if (!agingByCurrency[r.currency]) agingByCurrency[r.currency] = { total: 0, current: 0, '31to60': 0, '61to90': 0, '90plus': 0 };
    agingByCurrency[r.currency].total += r.outstanding;
    agingByCurrency[r.currency][r.bucket] += r.outstanding;
  });
  // Keep INR-first ordering for display
  const agingCurrencies = Object.keys(agingByCurrency).sort((a, b) => a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b));

  const agingSorted = [...agingFiltered].sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Distinct parties & brokers for filter dropdowns
  const salesParties = useMemo(() => {
    const set = new Set();
    bills.forEach(b => { if (b.clientName) set.add(b.clientName); });
    return Array.from(set).sort();
  }, [bills]);

  const allBrokerNames = useMemo(() => {
    const set = new Set();
    brokers.forEach(b => { if (b.name) set.add(b.name); });
    bills.forEach(b => {
      const brk = b.data?.details?.brokerName;
      if (brk) set.add(brk);
    });
    return Array.from(set).sort();
  }, [brokers, bills]);

  const purchaseSuppliers = useMemo(() => {
    const set = new Set();
    purchases.forEach(p => {
      const s = p.vendorName || p.supplierName || p.sellerName;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [purchases]);

  // Filtered Sales Bills (Date-wise)
  const filteredSalesBills = useMemo(() => {
    const list = bills.filter(b => {
      if (!countsAsSales(b)) return false;
      if (salesFrom && b.invoiceDate < salesFrom) return false;
      if (salesTo && b.invoiceDate > salesTo) return false;
      if (salesParty && (b.clientName || '').toLowerCase() !== salesParty.toLowerCase()) return false;
      const bBroker = b.data?.details?.brokerName || '';
      if (salesBroker && bBroker.toLowerCase() !== salesBroker.toLowerCase()) return false;
      if (salesSearch.trim()) {
        const q = salesSearch.toLowerCase();
        const bComp = getRecordCompanyName(b, businessName).toLowerCase();
        const matchNo = (b.invoiceNumber || '').toLowerCase().includes(q);
        const matchParty = (b.clientName || '').toLowerCase().includes(q);
        const matchBroker = (bBroker || '').toLowerCase().includes(q);
        const matchComp = bComp.includes(q);
        const matchItem = (b.data?.items || []).some(it => (it.name || '').toLowerCase().includes(q) || (it.lotNo || '').toLowerCase().includes(q));
        if (!matchNo && !matchParty && !matchBroker && !matchComp && !matchItem) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const da = a.invoiceDate || '';
      const db = b.invoiceDate || '';
      return salesSortOrder === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
    });
  }, [bills, salesFrom, salesTo, salesParty, salesBroker, salesSearch, salesSortOrder, businessName]);

  // Party-wise Consolidated Sales Summary
  const partyWiseSales = useMemo(() => {
    const map = {};
    filteredSalesBills.forEach(b => {
      const party = b.clientName || 'Unknown';
      const comp = getRecordCompanyName(b, businessName);
      if (!map[party]) {
        map[party] = {
          name: party,
          billsCount: 0,
          totalPcs: 0,
          totalMeters: 0,
          totalTaxable: 0,
          totalTax: 0,
          totalSales: 0,
          totalPaid: 0,
          totalDue: 0,
          companies: {},
          bills: [],
        };
      }
      map[party].billsCount += 1;
      map[party].companies[comp] = (map[party].companies[comp] || 0) + (Number(b.totalAmount) || 0);
      map[party].totalSales += Number(b.totalAmount) || 0;
      map[party].totalTax += Number(b.totalTaxAmount) || 0;
      map[party].totalTaxable += (Number(b.totalAmount) || 0) - (Number(b.totalTaxAmount) || 0);
      map[party].totalPaid += Number(b.paidAmount) || 0;
      map[party].totalDue += Math.max(0, (amountDue(b) - (Number(b.paidAmount) || 0)));
      map[party].bills.push(b);
      (b.data?.items || []).forEach(it => {
        map[party].totalPcs += Number(it.pcs) || 0;
        map[party].totalMeters += (it.unit === 'Mtr' || it.pcs ? Number(it.quantity) || 0 : 0);
      });
    });
    return Object.values(map).sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredSalesBills, businessName]);


  const salesSummary = useMemo(() => {
    let totalSales = 0;
    let totalMeters = 0;
    let totalPcs = 0;
    let totalTax = 0;
    filteredSalesBills.forEach(b => {
      totalSales += Number(b.totalAmount) || 0;
      totalTax += Number(b.totalTaxAmount) || 0;
      (b.data?.items || []).forEach(it => {
        totalPcs += Number(it.pcs) || 0;
        totalMeters += (it.unit === 'Mtr' || it.pcs ? Number(it.quantity) || 0 : 0);
      });
    });
    return { totalSales, totalMeters, totalPcs, totalTax, count: filteredSalesBills.length };
  }, [filteredSalesBills]);

  // Filtered Purchases (Date-wise)
  const filteredPurchaseList = useMemo(() => {
    const list = purchases.filter(p => {
      const date = p.billDate || p.date;
      if (purchaseFrom && date < purchaseFrom) return false;
      if (purchaseTo && date > purchaseTo) return false;
      const party = p.vendorName || p.supplierName || p.sellerName || '';
      if (purchaseParty && party.toLowerCase() !== purchaseParty.toLowerCase()) return false;
      const bBroker = p.brokerName || '';
      if (purchaseBroker && bBroker.toLowerCase() !== purchaseBroker.toLowerCase()) return false;
      if (purchaseSearch.trim()) {
        const q = purchaseSearch.toLowerCase();
        const pComp = getRecordCompanyName(p, businessName).toLowerCase();
        const matchNo = (p.billNumber || p.id || '').toLowerCase().includes(q);
        const matchParty = party.toLowerCase().includes(q);
        const matchComp = pComp.includes(q);
        if (!matchNo && !matchParty && !matchComp) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      const da = a.billDate || a.date || '';
      const db = b.billDate || b.date || '';
      return db.localeCompare(da);
    });
  }, [purchases, purchaseFrom, purchaseTo, purchaseParty, purchaseBroker, purchaseSearch, businessName]);

  // Supplier-wise Consolidated Purchases Summary
  const supplierWisePurchases = useMemo(() => {
    const map = {};
    filteredPurchaseList.forEach(p => {
      const party = p.vendorName || p.supplierName || p.sellerName || 'Unknown';
      const comp = getRecordCompanyName(p, businessName);
      const amt = Number(p.totalAmount || p.amount) || 0;
      const tax = Number(p.taxAmount || p.gstAmount || p.totalTaxAmount) || 0;
      if (!map[party]) {
        map[party] = {
          name: party,
          billsCount: 0,
          totalAmount: 0,
          totalTax: 0,
          companies: {},
          purchases: [],
        };
      }
      map[party].billsCount += 1;
      map[party].companies[comp] = (map[party].companies[comp] || 0) + amt;
      map[party].totalAmount += amt;
      map[party].totalTax += tax;
      map[party].purchases.push(p);
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredPurchaseList, businessName]);


  const purchaseSummary = useMemo(() => {
    let totalAmount = 0;
    let totalTax = 0;
    filteredPurchaseList.forEach(p => {
      totalAmount += Number(p.totalAmount || p.amount) || 0;
      totalTax += Number(p.taxAmount || p.gstAmount || p.totalTaxAmount) || 0;
    });
    return { totalAmount, totalTax, count: filteredPurchaseList.length };
  }, [filteredPurchaseList]);

  // Broker Report Data
  const brokerReportData = useMemo(() => {
    const map = {};
    allBrokerNames.forEach(name => {
      const foundB = brokers.find(b => b.name === name);
      map[name] = {
        name,
        phone: foundB?.phone || '',
        billCount: 0,
        totalPcs: 0,
        totalMeters: 0,
        totalAmount: 0,
        bills: [],
      };
    });
    bills.filter(countsAsSales).forEach(b => {
      const brkName = b.data?.details?.brokerName || 'Direct (No Broker)';
      if (!map[brkName]) {
        map[brkName] = {
          name: brkName,
          phone: '',
          billCount: 0,
          totalPcs: 0,
          totalMeters: 0,
          totalAmount: 0,
          bills: [],
        };
      }
      map[brkName].billCount += 1;
      map[brkName].totalAmount += Number(b.totalAmount) || 0;
      map[brkName].bills.push(b);
      (b.data?.items || []).forEach(it => {
        map[brkName].totalPcs += Number(it.pcs) || 0;
        map[brkName].totalMeters += (it.unit === 'Mtr' || it.pcs ? Number(it.quantity) || 0 : 0);
      });
    });
    const list = Object.values(map);
    if (brokerSearch.trim()) {
      const q = brokerSearch.toLowerCase();
      return list.filter(b => b.name.toLowerCase().includes(q) || b.phone.includes(q));
    }
    return list;
  }, [brokers, bills, allBrokerNames, brokerSearch]);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Financial reports and receivables analysis</p>
          </div>
          <HelpButton title="Reports — how to use" doc="reports">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Profit &amp; Loss</strong>: sales against expenses, without GST, by year or month.</li>
              <li><strong>Outstanding &amp; Aging</strong>: who owes you and how late, in 30-day groups.</li>
              <li><strong>Party Outstanding</strong>: what each party owes, month by month (April-March or January-December), with totals. Print or CSV.</li>
              <li><strong>Client Analytics</strong> and <strong>Product Performance</strong>: your best clients and items.</li>
              <li>Only real sales count: estimates, challans and cancelled invoices are left out, credit notes are subtracted.</li>
            </ul>
          </HelpButton>
        </div>
      </div>

      {/* Multi-Company Selection Bar */}
      <div className="glass-panel" style={{ padding: '0.6rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', background: selectedCompanyId === 'all' ? 'linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%)' : 'var(--bg-secondary)', border: selectedCompanyId === 'all' ? '1px solid #86efac' : '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: selectedCompanyId === 'all' ? '#15803d' : 'var(--primary)', fontWeight: 600, fontSize: '0.86rem' }}>
            <Building2 size={18} />
            <span>Company / फ़र्म चयन:</span>
          </div>
          <select
            className="form-input"
            style={{ minWidth: '280px', padding: '0.35rem 0.65rem', fontSize: '0.85rem', fontWeight: 600, borderColor: selectedCompanyId === 'all' ? '#16a34a' : 'var(--border-color)' }}
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            <option value="all">🏢 All Companies (Consolidated / सभी कंपनियाँ एक साथ)</option>
            {allCompanies.map((c) => (
              <option key={c.id || c.businessName} value={c.id || c.businessName}>
                🏢 {c.businessName} {c.gstin ? `(${c.gstin})` : ''}
              </option>
            ))}
          </select>
          {selectedCompanyId === 'all' ? (
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 600, border: '1px solid #86efac' }}>
              ⚡ Consolidated ({allCompanies.length} कंपनियों का कुल डेटा शामिल)
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1e40af', fontWeight: 600, border: '1px solid #bfdbfe' }}>
              🏢 Single Firm: {selectedCompany?.businessName || businessName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className={`btn ${selectedCompanyId === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
            onClick={() => setSelectedCompanyId(selectedCompanyId === 'all' ? (allCompanies[0]?.id || allCompanies[0]?.businessName || 'all') : 'all')}
          >
            {selectedCompanyId === 'all' ? '✓ Showing All Companies' : 'Switch to All Companies'}
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sales')}>
          <FileText size={16} /> Sales Report (बिक्री)
        </button>
        <button className={`btn ${activeTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('purchases')}>
          <ShoppingCart size={16} /> Purchase Report (खरीद)
        </button>
        <button className={`btn ${activeTab === 'brokers' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('brokers')}>
          <UserCheck size={16} /> Broker Report (दलाल)
        </button>
        <button className={`btn ${activeTab === 'aging' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('aging')}>
          <Clock size={16} /> Outstanding & Aging
        </button>
        <button className={`btn ${activeTab === 'party' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('party')}>
          <Users size={16} /> Party Outstanding
        </button>
        <button className={`btn ${activeTab === 'pl' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pl')}>
          <BarChart3 size={16} /> Profit & Loss
        </button>
        <button className={`btn ${activeTab === 'clients' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('clients')}>
          <Users size={16} /> Client Analytics
        </button>
        <button className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('products')}>
          <Package size={16} /> Product Performance
        </button>
        <button className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('stock')}>
          <Boxes size={16} /> Stock
        </button>
      </div>

      {/* Period + Currency Selector for P&L, Client Analytics & Product Performance */}
      {(activeTab === 'pl' || activeTab === 'clients' || activeTab === 'products') && (
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Filter By</label>
                <select className="form-input" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                  <option value="fy">Fiscal Year</option>
                  <option value="month">Month / Year</option>
                </select>
              </div>
              {filterMode === 'fy' ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fiscal Year</label>
                  <select className="form-input" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
                    {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Month</label>
                    <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                      {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Year</label>
                    <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                      {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </>
              )}
              {allCurrencies.length > 1 && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Currency</label>
                  <select className="form-input" value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)}>
                    {allCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
      )}

      {/* SALES REPORT TAB */}
      {activeTab === 'sales' && (
        <div>
          {/* View Mode & Quick Date Presets Bar */}
          <div className="glass-panel" style={{ padding: '0.65rem 1rem', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>View Mode:</span>
              <button
                className={`btn ${salesViewMode === 'date' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => setSalesViewMode('date')}
              >
                <Calendar size={13} style={{ marginRight: 4 }} /> Date-wise Register (तारीख अनुसार)
              </button>
              <button
                className={`btn ${salesViewMode === 'party' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => setSalesViewMode('party')}
              >
                <Users size={13} style={{ marginRight: 4 }} /> Party-wise Summary (पार्टी अनुसार कुल)
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quick Dates:</span>
              {[
                { id: 'today', label: 'आज (Today)' },
                { id: 'yesterday', label: 'कल' },
                { id: 'this_week', label: '7 दिन' },
                { id: 'this_month', label: 'इस महीने' },
                { id: 'this_fy', label: 'चालू FY' },
                { id: 'all', label: 'सभी' },
              ].map((p) => (
                <button
                  key={p.id}
                  className={`btn ${salesDatePreset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.22rem 0.5rem', fontSize: '0.72rem', borderRadius: '4px' }}
                  onClick={() => applySalesDatePreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
              {salesViewMode === 'date' && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.22rem 0.5rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  onClick={() => setSalesSortOrder(salesSortOrder === 'desc' ? 'asc' : 'desc')}
                  title="Toggle Date Sort Order"
                >
                  <ArrowUpDown size={12} /> {salesSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </button>
              )}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Search (खोजें)</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '1.8rem', padding: '0.35rem 0.6rem 0.35rem 1.8rem', fontSize: '0.82rem' }}
                    placeholder="Bill, Party, Broker, Company..."
                    value={salesSearch}
                    onChange={e => setSalesSearch(e.target.value)}
                  />
                  {salesSearch && (
                    <button onClick={() => setSalesSearch('')} style={{ position: 'absolute', right: 6, top: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Party (पार्टी)</label>
                <select className="form-input" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} value={salesParty} onChange={e => setSalesParty(e.target.value)}>
                  <option value="">All Parties ({salesParties.length})</option>
                  {salesParties.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Broker (दलाल)</label>
                <select className="form-input" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} value={salesBroker} onChange={e => setSalesBroker(e.target.value)}>
                  <option value="">All Brokers ({allBrokerNames.length})</option>
                  {allBrokerNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>From Date</label>
                <input type="date" className="form-input" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} value={salesFrom} onChange={e => { setSalesFrom(e.target.value); setSalesDatePreset('custom'); }} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>To Date</label>
                <input type="date" className="form-input" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} value={salesTo} onChange={e => { setSalesTo(e.target.value); setSalesDatePreset('custom'); }} />
              </div>
            </div>

            {(salesSearch || salesParty || salesBroker || salesFrom || salesTo) && (
              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => { setSalesSearch(''); setSalesParty(''); setSalesBroker(''); setSalesFrom(''); setSalesTo(''); setSalesDatePreset('all'); }}
                >
                  <X size={12} /> Reset Filters
                </button>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: '1rem', gap: '0.6rem' }}>
            <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="stat-icon stat-icon-blue"><FileText size={18} /></div>
              <div>
                <p className="stat-label">Total Bills</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem' }}>{salesSummary.count}</h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="stat-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}><Boxes size={18} /></div>
              <div>
                <p className="stat-label">Total Pieces (थान)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#7c3aed' }}>{salesSummary.totalPcs.toLocaleString('en-IN')}</h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}><Package size={18} /></div>
              <div>
                <p className="stat-label">Total Meters</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#0284c7' }}>{salesSummary.totalMeters.toFixed(2)}</h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="stat-icon stat-icon-green"><TrendingUp size={18} /></div>
              <div>
                <p className="stat-label">Total Sales (₹)</p>
                <h3 className="stat-value stat-value-green" style={{ fontSize: '1.25rem' }}>{formatCurrency(salesSummary.totalSales, 'INR')}</h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="stat-icon stat-icon-purple"><BarChart3 size={18} /></div>
              <div>
                <p className="stat-label">Total GST (₹)</p>
                <h3 className="stat-value stat-value-purple" style={{ fontSize: '1.25rem' }}>{formatCurrency(salesSummary.totalTax, 'INR')}</h3>
              </div>
            </div>
          </div>

          {/* DATE-WISE REGISTER TABLE */}
          {salesViewMode === 'date' && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>
                    Date-wise Sales Register ({filteredSalesBills.length} Invoices)
                  </h3>
                  {selectedCompanyId === 'all' && (
                    <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '3px', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                      ⚡ All Companies
                    </span>
                  )}
                </div>
                <TableExport
                  title="Date-wise Sales Report"
                  filename={`Sales-DateWise-${selectedCompanyId === 'all' ? 'Consolidated' : 'Single'}-${activeFY || 'All'}`}
                  subtitle={[selectedCompanyId === 'all' ? 'All Companies Consolidated' : businessName, activeFY ? `FY ${activeFY}` : '', salesParty ? `Party: ${salesParty}` : '', salesBroker ? `Broker: ${salesBroker}` : ''].filter(Boolean).join(', ')}
                  headers={['Date', 'Bill No', 'Company', 'Party Name', 'Broker', 'Items / Lots', 'Pieces (थान)', 'Meters', 'Taxable (₹)', 'GST (₹)', 'Total (₹)', 'Status']}
                  rows={filteredSalesBills.map(b => {
                    let bPcs = 0;
                    let bMtr = 0;
                    const itemDescs = (b.data?.items || []).map(it => {
                      bPcs += Number(it.pcs) || 0;
                      bMtr += (it.unit === 'Mtr' || it.pcs ? Number(it.quantity) || 0 : 0);
                      return [it.name, it.lotNo ? `Lot: ${it.lotNo}` : ''].filter(Boolean).join(' ');
                    }).join('; ');
                    const taxable = (Number(b.totalAmount) || 0) - (Number(b.totalTaxAmount) || 0);
                    return [
                      b.invoiceDate || '',
                      b.invoiceNumber || '',
                      getRecordCompanyName(b, businessName),
                      b.clientName || '',
                      b.data?.details?.brokerName || '—',
                      itemDescs || '—',
                      bPcs || '',
                      bMtr ? bMtr.toFixed(2) : '',
                      taxable.toFixed(2),
                      (Number(b.totalTaxAmount) || 0).toFixed(2),
                      (Number(b.totalAmount) || 0).toFixed(2),
                      b.status || 'unpaid',
                    ];
                  })}
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '6px 8px' }}>Date</th>
                      <th style={{ padding: '6px 8px' }}>Bill No</th>
                      <th style={{ padding: '6px 8px' }}>Company (फ़र्म)</th>
                      <th style={{ padding: '6px 8px' }}>Party Name (पार्टी)</th>
                      <th style={{ padding: '6px 8px' }}>Broker (दलाल)</th>
                      <th style={{ padding: '6px 8px' }}>Items / Lots</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Pcs (थान)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Meters</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Taxable</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>GST</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Total (₹)</th>
                      <th style={{ padding: '6px 8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalesBills.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                          No sales records found matching the filters.
                        </td>
                      </tr>
                    ) : (
                      filteredSalesBills.map(b => {
                        let bPcs = 0;
                        let bMtr = 0;
                        (b.data?.items || []).forEach(it => {
                          bPcs += Number(it.pcs) || 0;
                          bMtr += (it.unit === 'Mtr' || it.pcs ? Number(it.quantity) || 0 : 0);
                        });
                        const taxable = (Number(b.totalAmount) || 0) - (Number(b.totalTaxAmount) || 0);
                        const coName = getRecordCompanyName(b, businessName);
                        return (
                          <tr key={b.id || b.invoiceNumber}>
                            <td style={{ whiteSpace: 'nowrap', padding: '5px 8px' }}>{b.invoiceDate || '—'}</td>
                            <td className="font-semibold text-primary" style={{ padding: '5px 8px' }}>{b.invoiceNumber}</td>
                            <td style={{ padding: '5px 8px' }}>
                              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {coName}
                              </span>
                            </td>
                            <td className="font-medium" style={{ padding: '5px 8px' }}>{b.clientName}</td>
                            <td style={{ color: b.data?.details?.brokerName ? '#4338ca' : 'var(--text-muted)', padding: '5px 8px' }}>
                              {b.data?.details?.brokerName || '—'}
                            </td>
                            <td style={{ fontSize: '0.78rem', maxWidth: '180px', padding: '5px 8px' }}>
                              {(b.data?.items || []).map((it, idx) => (
                                <div key={idx} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {it.name} {it.lotNo ? <span style={{ color: '#0369a1', fontSize: '0.72rem' }}>(Lot: {it.lotNo})</span> : null}
                                </div>
                              ))}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#7c3aed', padding: '5px 8px' }}>{bPcs || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#0284c7', padding: '5px 8px' }}>{bMtr ? bMtr.toFixed(2) : '—'}</td>
                            <td style={{ textAlign: 'right', padding: '5px 8px' }}>{formatCurrency(taxable, 'INR')}</td>
                            <td style={{ textAlign: 'right', color: '#9333ea', padding: '5px 8px' }}>{formatCurrency(b.totalTaxAmount || 0, 'INR')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', padding: '5px 8px' }}>{formatCurrency(b.totalAmount || 0, 'INR')}</td>
                            <td style={{ padding: '5px 8px' }}>
                              <span className={`status-badge status-${b.status || 'unpaid'}`} style={{ textTransform: 'capitalize', fontSize: '0.7rem', padding: '1px 6px' }}>
                                {b.status || 'unpaid'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredSalesBills.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                        <td colSpan={6} style={{ padding: '6px 8px' }}>Total ({filteredSalesBills.length} Bills)</td>
                        <td style={{ textAlign: 'right', color: '#7c3aed', padding: '6px 8px' }}>{salesSummary.totalPcs}</td>
                        <td style={{ textAlign: 'right', color: '#0284c7', padding: '6px 8px' }}>{salesSummary.totalMeters.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{formatCurrency(salesSummary.totalSales - salesSummary.totalTax, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#9333ea', padding: '6px 8px' }}>{formatCurrency(salesSummary.totalTax, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#059669', padding: '6px 8px' }}>{formatCurrency(salesSummary.totalSales, 'INR')}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* PARTY-WISE CONSOLIDATED SUMMARY TABLE */}
          {salesViewMode === 'party' && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>
                    Party-wise Consolidated Sales ({partyWiseSales.length} Parties)
                  </h3>
                  {selectedCompanyId === 'all' && (
                    <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '3px', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                      ⚡ Combined Across All Sister Concerns
                    </span>
                  )}
                </div>
                <TableExport
                  title="Party-wise Consolidated Sales Report"
                  filename={`Sales-PartyWise-${selectedCompanyId === 'all' ? 'Consolidated' : 'Single'}-${activeFY || 'All'}`}
                  subtitle={[selectedCompanyId === 'all' ? 'All Companies Consolidated' : businessName, activeFY ? `FY ${activeFY}` : ''].filter(Boolean).join(', ')}
                  headers={['Party Name', 'Total Bills', 'Companies', 'Total Pieces', 'Total Meters', 'Taxable (₹)', 'GST (₹)', 'Total Sales (₹)', 'Received (₹)', 'Balance Due (₹)']}
                  rows={partyWiseSales.map(p => [
                    p.name,
                    p.billsCount,
                    Object.keys(p.companies || {}).join('; '),
                    p.totalPcs,
                    p.totalMeters.toFixed(2),
                    p.totalTaxable.toFixed(2),
                    p.totalTax.toFixed(2),
                    p.totalSales.toFixed(2),
                    p.totalPaid.toFixed(2),
                    p.totalDue.toFixed(2),
                  ])}
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '6px 8px' }}>Party Name (पार्टी)</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>Bills</th>
                      <th style={{ padding: '6px 8px' }}>Companies Involved (फ़र्में)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Pieces (थान)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Meters (मीटर)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Taxable (₹)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>GST (₹)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Total Sales (₹)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Received (₹)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Balance Due (₹)</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>Ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partyWiseSales.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                          No party data found matching filters.
                        </td>
                      </tr>
                    ) : (
                      partyWiseSales.map((p) => {
                        const coList = Object.keys(p.companies || {});
                        return (
                          <tr key={p.name}>
                            <td className="font-semibold" style={{ padding: '5px 8px' }}>{p.name}</td>
                            <td style={{ textAlign: 'center', padding: '5px 8px' }}>
                              <span style={{ padding: '1px 6px', borderRadius: '3px', background: '#f1f5f9', fontWeight: 600 }}>
                                {p.billsCount}
                              </span>
                            </td>
                            <td style={{ padding: '5px 8px' }}>
                              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                {coList.map((co) => (
                                  <span key={co} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                    {co}: ₹{p.companies[co].toLocaleString('en-IN')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#7c3aed', padding: '5px 8px' }}>{p.totalPcs || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#0284c7', padding: '5px 8px' }}>{p.totalMeters ? p.totalMeters.toFixed(2) : '—'}</td>
                            <td style={{ textAlign: 'right', padding: '5px 8px' }}>{formatCurrency(p.totalTaxable, 'INR')}</td>
                            <td style={{ textAlign: 'right', color: '#9333ea', padding: '5px 8px' }}>{formatCurrency(p.totalTax, 'INR')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', padding: '5px 8px' }}>{formatCurrency(p.totalSales, 'INR')}</td>
                            <td style={{ textAlign: 'right', color: '#0284c7', padding: '5px 8px' }}>{formatCurrency(p.totalPaid, 'INR')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: p.totalDue > 0 ? '#dc2626' : '#16a34a', padding: '5px 8px' }}>
                              {formatCurrency(p.totalDue, 'INR')}
                            </td>
                            <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '2px 6px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                onClick={() => setPartyDetailModal(p)}
                              >
                                <Eye size={12} /> Bills ({p.billsCount})
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {partyWiseSales.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 8px' }}>Total ({partyWiseSales.length} Parties)</td>
                        <td style={{ textAlign: 'center', padding: '6px 8px' }}>{salesSummary.count}</td>
                        <td></td>
                        <td style={{ textAlign: 'right', color: '#7c3aed', padding: '6px 8px' }}>{salesSummary.totalPcs}</td>
                        <td style={{ textAlign: 'right', color: '#0284c7', padding: '6px 8px' }}>{salesSummary.totalMeters.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{formatCurrency(salesSummary.totalSales - salesSummary.totalTax, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#9333ea', padding: '6px 8px' }}>{formatCurrency(salesSummary.totalTax, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#059669', padding: '6px 8px' }}>{formatCurrency(salesSummary.totalSales, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#0284c7', padding: '6px 8px' }}>
                          {formatCurrency(partyWiseSales.reduce((s, p) => s + p.totalPaid, 0), 'INR')}
                        </td>
                        <td style={{ textAlign: 'right', color: '#dc2626', padding: '6px 8px' }}>
                          {formatCurrency(partyWiseSales.reduce((s, p) => s + p.totalDue, 0), 'INR')}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Party Invoices Drilldown Modal */}
          {partyDetailModal && (
            <div className="modal-backdrop" onClick={() => setPartyDetailModal(null)}>
              <div className="modal" style={{ maxWidth: '900px', width: '95%', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                      All Invoices for {partyDetailModal.name} ({partyDetailModal.billsCount} Bills)
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Total Sales: <strong style={{ color: '#059669' }}>{formatCurrency(partyDetailModal.totalSales, 'INR')}</strong> | Due: <strong style={{ color: '#dc2626' }}>{formatCurrency(partyDetailModal.totalDue, 'INR')}</strong>
                    </p>
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setPartyDetailModal(null)}>
                    <X size={15} />
                  </button>
                </div>
                <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '0.75rem 1rem' }}>
                  <table className="data-table" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Bill No</th>
                        <th>Company (फ़र्म)</th>
                        <th>Broker (दलाल)</th>
                        <th style={{ textAlign: 'right' }}>Pieces</th>
                        <th style={{ textAlign: 'right' }}>Meters</th>
                        <th style={{ textAlign: 'right' }}>Total (₹)</th>
                        <th style={{ textAlign: 'right' }}>Paid (₹)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partyDetailModal.bills.map((b, idx) => {
                        let bPcs = 0;
                        let bMtr = 0;
                        (b.data?.items || []).forEach(it => {
                          bPcs += Number(it.pcs) || 0;
                          bMtr += (it.unit === 'Mtr' || it.pcs ? Number(it.quantity) || 0 : 0);
                        });
                        return (
                          <tr key={idx}>
                            <td style={{ whiteSpace: 'nowrap' }}>{b.invoiceDate || '—'}</td>
                            <td className="font-semibold text-primary">{b.invoiceNumber}</td>
                            <td>
                              <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                                {getRecordCompanyName(b, businessName)}
                              </span>
                            </td>
                            <td style={{ color: b.data?.details?.brokerName ? '#4338ca' : 'var(--text-muted)' }}>
                              {b.data?.details?.brokerName || '—'}
                            </td>
                            <td style={{ textAlign: 'right', color: '#7c3aed' }}>{bPcs || '—'}</td>
                            <td style={{ textAlign: 'right', color: '#0284c7' }}>{bMtr ? bMtr.toFixed(2) : '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(b.totalAmount || 0, 'INR')}</td>
                            <td style={{ textAlign: 'right', color: '#0284c7' }}>{formatCurrency(b.paidAmount || 0, 'INR')}</td>
                            <td>
                              <span className={`status-badge status-${b.status || 'unpaid'}`} style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                                {b.status || 'unpaid'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer" style={{ padding: '0.6rem 1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setPartyDetailModal(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* PURCHASE REPORT TAB */}
      {activeTab === 'purchases' && (
        <div>
          {/* View Mode & Quick Date Presets Bar */}
          <div className="glass-panel" style={{ padding: '0.65rem 1rem', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>View Mode:</span>
              <button
                className={`btn ${purchaseViewMode === 'date' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => setPurchaseViewMode('date')}
              >
                <Calendar size={13} style={{ marginRight: 4 }} /> Date-wise Purchase Register (तारीख अनुसार)
              </button>
              <button
                className={`btn ${purchaseViewMode === 'party' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                onClick={() => setPurchaseViewMode('party')}
              >
                <Users size={13} style={{ marginRight: 4 }} /> Supplier-wise Summary (पार्टी/सप्लायर अनुसार)
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quick Dates:</span>
              {[
                { id: 'today', label: 'आज (Today)' },
                { id: 'yesterday', label: 'कल' },
                { id: 'this_week', label: '7 दिन' },
                { id: 'this_month', label: 'इस महीने' },
                { id: 'this_fy', label: 'चालू FY' },
                { id: 'all', label: 'सभी' },
              ].map((p) => (
                <button
                  key={p.id}
                  className={`btn ${purchaseDatePreset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.22rem 0.5rem', fontSize: '0.72rem', borderRadius: '4px' }}
                  onClick={() => applyPurchaseDatePreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Search (खोजें)</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '1.8rem', padding: '0.35rem 0.6rem 0.35rem 1.8rem', fontSize: '0.82rem' }}
                    placeholder="Bill, Supplier, Broker, Company..."
                    value={purchaseSearch}
                    onChange={e => setPurchaseSearch(e.target.value)}
                  />
                  {purchaseSearch && (
                    <button onClick={() => setPurchaseSearch('')} style={{ position: 'absolute', right: 6, top: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Supplier / Vendor</label>
                <select className="form-input" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} value={purchaseParty} onChange={e => setPurchaseParty(e.target.value)}>
                  <option value="">All Suppliers ({purchaseSuppliers.length})</option>
                  {purchaseSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Broker (दलाल)</label>
                <select className="form-input" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} value={purchaseBroker} onChange={e => setPurchaseBroker(e.target.value)}>
                  <option value="">All Brokers ({allBrokerNames.length})</option>
                  {allBrokerNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>From Date</label>
                <input type="date" className="form-input" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} value={purchaseFrom} onChange={e => { setPurchaseFrom(e.target.value); setPurchaseDatePreset('custom'); }} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>To Date</label>
                <input type="date" className="form-input" style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }} value={purchaseTo} onChange={e => { setPurchaseTo(e.target.value); setPurchaseDatePreset('custom'); }} />
              </div>
            </div>

            {(purchaseSearch || purchaseParty || purchaseBroker || purchaseFrom || purchaseTo) && (
              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => { setPurchaseSearch(''); setPurchaseParty(''); setPurchaseBroker(''); setPurchaseFrom(''); setPurchaseTo(''); setPurchaseDatePreset('all'); }}
                >
                  <X size={12} /> Reset Filters
                </button>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1rem', gap: '0.6rem' }}>
            <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="stat-icon stat-icon-purple"><ShoppingCart size={18} /></div>
              <div>
                <p className="stat-label">Purchase Bills</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem' }}>{purchaseSummary.count}</h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="stat-icon stat-icon-blue"><Wallet size={18} /></div>
              <div>
                <p className="stat-label">Total Purchases (₹)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#1e40af' }}>{formatCurrency(purchaseSummary.totalAmount, 'INR')}</h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
              <div className="stat-icon stat-icon-green"><TrendingDown size={18} /></div>
              <div>
                <p className="stat-label">Total ITC / GST (₹)</p>
                <h3 className="stat-value stat-value-green" style={{ fontSize: '1.25rem' }}>{formatCurrency(purchaseSummary.totalTax, 'INR')}</h3>
              </div>
            </div>
          </div>

          {/* DATE-WISE PURCHASE TABLE */}
          {purchaseViewMode === 'date' && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>
                    Purchase Register ({filteredPurchaseList.length} Bills)
                  </h3>
                  {selectedCompanyId === 'all' && (
                    <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '3px', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                      ⚡ All Companies
                    </span>
                  )}
                </div>
                <TableExport
                  title="Purchase Report"
                  filename={`Purchase-DateWise-${selectedCompanyId === 'all' ? 'Consolidated' : 'Single'}-${activeFY || 'All'}`}
                  subtitle={[selectedCompanyId === 'all' ? 'All Companies Consolidated' : businessName, activeFY ? `FY ${activeFY}` : ''].filter(Boolean).join(', ')}
                  headers={['Date', 'Bill No', 'Company', 'Supplier Name', 'Broker', 'Taxable (₹)', 'GST (₹)', 'Total Amount (₹)']}
                  rows={filteredPurchaseList.map(p => {
                    const amt = Number(p.totalAmount || p.amount) || 0;
                    const tax = Number(p.taxAmount || p.gstAmount || p.totalTaxAmount) || 0;
                    return [
                      p.billDate || p.date || '',
                      p.billNumber || p.id || '',
                      getRecordCompanyName(p, businessName),
                      p.vendorName || p.supplierName || p.sellerName || '',
                      p.brokerName || '—',
                      (amt - tax).toFixed(2),
                      tax.toFixed(2),
                      amt.toFixed(2),
                    ];
                  })}
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '6px 8px' }}>Date</th>
                      <th style={{ padding: '6px 8px' }}>Bill No</th>
                      <th style={{ padding: '6px 8px' }}>Company (फ़र्म)</th>
                      <th style={{ padding: '6px 8px' }}>Supplier / Vendor</th>
                      <th style={{ padding: '6px 8px' }}>Broker</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Taxable</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>GST</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchaseList.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                          No purchase records found matching the filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPurchaseList.map((p, idx) => {
                        const amt = Number(p.totalAmount || p.amount) || 0;
                        const tax = Number(p.taxAmount || p.gstAmount || p.totalTaxAmount) || 0;
                        const coName = getRecordCompanyName(p, businessName);
                        return (
                          <tr key={p.id || idx}>
                            <td style={{ whiteSpace: 'nowrap', padding: '5px 8px' }}>{p.billDate || p.date || '—'}</td>
                            <td className="font-semibold text-primary" style={{ padding: '5px 8px' }}>{p.billNumber || p.id || '—'}</td>
                            <td style={{ padding: '5px 8px' }}>
                              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {coName}
                              </span>
                            </td>
                            <td className="font-medium" style={{ padding: '5px 8px' }}>{p.vendorName || p.supplierName || p.sellerName || '—'}</td>
                            <td style={{ color: p.brokerName ? '#4338ca' : 'var(--text-muted)', padding: '5px 8px' }}>{p.brokerName || '—'}</td>
                            <td style={{ textAlign: 'right', padding: '5px 8px' }}>{formatCurrency(amt - tax, 'INR')}</td>
                            <td style={{ textAlign: 'right', color: '#9333ea', padding: '5px 8px' }}>{formatCurrency(tax, 'INR')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af', padding: '5px 8px' }}>{formatCurrency(amt, 'INR')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {filteredPurchaseList.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                        <td colSpan={5} style={{ padding: '6px 8px' }}>Total ({filteredPurchaseList.length} Bills)</td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{formatCurrency(purchaseSummary.totalAmount - purchaseSummary.totalTax, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#9333ea', padding: '6px 8px' }}>{formatCurrency(purchaseSummary.totalTax, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#1e40af', padding: '6px 8px' }}>{formatCurrency(purchaseSummary.totalAmount, 'INR')}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* SUPPLIER-WISE SUMMARY TABLE */}
          {purchaseViewMode === 'party' && (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>
                    Supplier-wise Consolidated Purchases ({supplierWisePurchases.length} Suppliers)
                  </h3>
                  {selectedCompanyId === 'all' && (
                    <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '3px', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                      ⚡ Combined Across All Sister Concerns
                    </span>
                  )}
                </div>
                <TableExport
                  title="Supplier-wise Consolidated Purchases"
                  filename={`Purchases-SupplierWise-${selectedCompanyId === 'all' ? 'Consolidated' : 'Single'}-${activeFY || 'All'}`}
                  subtitle={[selectedCompanyId === 'all' ? 'All Companies Consolidated' : businessName, activeFY ? `FY ${activeFY}` : ''].filter(Boolean).join(', ')}
                  headers={['Supplier Name', 'Total Bills', 'Companies', 'Taxable (₹)', 'GST (₹)', 'Total Purchases (₹)']}
                  rows={supplierWisePurchases.map(s => [
                    s.name,
                    s.billsCount,
                    Object.keys(s.companies || {}).join('; '),
                    (s.totalAmount - s.totalTax).toFixed(2),
                    s.totalTax.toFixed(2),
                    s.totalAmount.toFixed(2),
                  ])}
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '6px 8px' }}>Supplier / Vendor (पार्टी/सप्लायर)</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>Bills</th>
                      <th style={{ padding: '6px 8px' }}>Companies Involved (फ़र्में)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Taxable (₹)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>GST (₹)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Total Purchases (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierWisePurchases.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                          No supplier data found matching filters.
                        </td>
                      </tr>
                    ) : (
                      supplierWisePurchases.map((s) => {
                        const coList = Object.keys(s.companies || {});
                        return (
                          <tr key={s.name}>
                            <td className="font-semibold" style={{ padding: '5px 8px' }}>{s.name}</td>
                            <td style={{ textAlign: 'center', padding: '5px 8px' }}>
                              <span style={{ padding: '1px 6px', borderRadius: '3px', background: '#f1f5f9', fontWeight: 600 }}>
                                {s.billsCount}
                              </span>
                            </td>
                            <td style={{ padding: '5px 8px' }}>
                              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                {coList.map((co) => (
                                  <span key={co} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                    {co}: ₹{s.companies[co].toLocaleString('en-IN')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', padding: '5px 8px' }}>{formatCurrency(s.totalAmount - s.totalTax, 'INR')}</td>
                            <td style={{ textAlign: 'right', color: '#9333ea', padding: '5px 8px' }}>{formatCurrency(s.totalTax, 'INR')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e40af', padding: '5px 8px' }}>{formatCurrency(s.totalAmount, 'INR')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {supplierWisePurchases.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 8px' }}>Total ({supplierWisePurchases.length} Suppliers)</td>
                        <td style={{ textAlign: 'center', padding: '6px 8px' }}>{purchaseSummary.count}</td>
                        <td></td>
                        <td style={{ textAlign: 'right', padding: '6px 8px' }}>{formatCurrency(purchaseSummary.totalAmount - purchaseSummary.totalTax, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#9333ea', padding: '6px 8px' }}>{formatCurrency(purchaseSummary.totalTax, 'INR')}</td>
                        <td style={{ textAlign: 'right', color: '#1e40af', padding: '6px 8px' }}>{formatCurrency(purchaseSummary.totalAmount, 'INR')}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BROKER REPORT TAB */}
      {activeTab === 'brokers' && (
        <div>
          {/* Filters Bar */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ maxWidth: 360 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Search Broker (दलाल खोजें)</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2rem' }}
                  placeholder="Broker name or phone..."
                  value={brokerSearch}
                  onChange={e => setBrokerSearch(e.target.value)}
                />
                {brokerSearch && (
                  <button onClick={() => setBrokerSearch('')} style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.25rem', gap: '0.75rem' }}>
            <div className="stat-card" style={{ padding: '1rem' }}>
              <div className="stat-icon stat-icon-blue"><UserCheck size={20} /></div>
              <div>
                <p className="stat-label">Total Brokers</p>
                <h3 className="stat-value" style={{ fontSize: '1.4rem' }}>{brokerReportData.length}</h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '1rem' }}>
              <div className="stat-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}><Boxes size={20} /></div>
              <div>
                <p className="stat-label">Total Pieces (थान)</p>
                <h3 className="stat-value" style={{ fontSize: '1.4rem', color: '#7c3aed' }}>
                  {brokerReportData.reduce((s, b) => s + b.totalPcs, 0).toLocaleString('en-IN')}
                </h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '1rem' }}>
              <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}><Package size={20} /></div>
              <div>
                <p className="stat-label">Total Meters</p>
                <h3 className="stat-value" style={{ fontSize: '1.4rem', color: '#0284c7' }}>
                  {brokerReportData.reduce((s, b) => s + b.totalMeters, 0).toFixed(2)}
                </h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '1rem' }}>
              <div className="stat-icon stat-icon-green"><TrendingUp size={20} /></div>
              <div>
                <p className="stat-label">Total Sales (₹)</p>
                <h3 className="stat-value stat-value-green" style={{ fontSize: '1.4rem' }}>
                  {formatCurrency(brokerReportData.reduce((s, b) => s + b.totalAmount, 0), 'INR')}
                </h3>
              </div>
            </div>
            <div className="stat-card" style={{ padding: '1rem' }}>
              <div className="stat-icon stat-icon-purple"><Wallet size={20} /></div>
              <div>
                <p className="stat-label">Est. Brokerage @ 1%</p>
                <h3 className="stat-value stat-value-purple" style={{ fontSize: '1.4rem' }}>
                  {formatCurrency(brokerReportData.reduce((s, b) => s + b.totalAmount, 0) * 0.01, 'INR')}
                </h3>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                Broker Wise Performance Summary
              </h3>
              <TableExport
                title="Broker Report"
                filename={`Broker-Report-${activeFY || 'All'}`}
                subtitle={[businessName, activeFY ? `FY ${activeFY}` : ''].filter(Boolean).join(', ')}
                headers={['Broker Name', 'Contact Phone', 'Total Bills', 'Total Pieces (थान)', 'Total Meters', 'Total Sales (₹)', 'Est. Brokerage @1% (₹)']}
                rows={brokerReportData.map(b => [
                  b.name,
                  b.phone || '—',
                  b.billCount,
                  b.totalPcs,
                  b.totalMeters.toFixed(2),
                  b.totalAmount.toFixed(2),
                  (b.totalAmount * 0.01).toFixed(2),
                ])}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Broker Name</th>
                    <th>Contact Phone</th>
                    <th style={{ textAlign: 'right' }}>Total Bills</th>
                    <th style={{ textAlign: 'right' }}>Total Pieces (थान)</th>
                    <th style={{ textAlign: 'right' }}>Total Meters</th>
                    <th style={{ textAlign: 'right' }}>Total Sales (₹)</th>
                    <th style={{ textAlign: 'right' }}>Est. Brokerage (1%)</th>
                    <th style={{ textAlign: 'center' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {brokerReportData.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No broker data found.
                      </td>
                    </tr>
                  ) : (
                    brokerReportData.map((b, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold text-primary">{b.name}</td>
                        <td className="text-muted">{b.phone || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{b.billCount}</td>
                        <td style={{ textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>{b.totalPcs || '—'}</td>
                        <td style={{ textAlign: 'right', color: '#0284c7', fontWeight: 600 }}>{b.totalMeters ? b.totalMeters.toFixed(2) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(b.totalAmount, 'INR')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#9333ea' }}>{formatCurrency(b.totalAmount * 0.01, 'INR')}</td>
                        <td style={{ textAlign: 'center' }}>
                          {b.billCount > 0 ? (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                              onClick={() => setSelectedBroker(b)}
                            >
                              View ({b.billCount})
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Broker Bills Modal */}
          {selectedBroker && (
            <div className="modal-backdrop" onClick={() => setSelectedBroker(null)}>
              <div className="modal" style={{ maxWidth: '800px', width: '95%' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>
                    Invoices for {selectedBroker.name} ({selectedBroker.billCount} Bills)
                  </h3>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setSelectedBroker(null)}>
                    <X size={16} />
                  </button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Bill No</th>
                        <th>Party</th>
                        <th>Company (फ़र्म)</th>
                        <th style={{ textAlign: 'right' }}>Pieces</th>
                        <th style={{ textAlign: 'right' }}>Meters</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBroker.bills.map((b, i) => {
                        let bPcs = 0;
                        let bMtr = 0;
                        (b.data?.items || []).forEach(it => {
                          bPcs += Number(it.pcs) || 0;
                          bMtr += (it.unit === 'Mtr' || it.pcs ? Number(it.quantity) || 0 : 0);
                        });
                        return (
                          <tr key={i}>
                            <td>{b.invoiceDate}</td>
                            <td className="font-semibold text-primary">{b.invoiceNumber}</td>
                            <td>{b.clientName}</td>
                            <td>
                              <span style={{ fontSize: '0.72rem', padding: '1px 5px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                                {getRecordCompanyName(b, businessName)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: '#7c3aed' }}>{bPcs || '—'}</td>
                            <td style={{ textAlign: 'right', color: '#0284c7' }}>{bMtr ? bMtr.toFixed(2) : '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>{formatCurrency(b.totalAmount || 0, 'INR')}</td>
                            <td>
                              <span className={`status-badge status-${b.status || 'unpaid'}`} style={{ textTransform: 'capitalize' }}>
                                {b.status || 'unpaid'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Total Sales: <strong style={{ color: '#059669' }}>{formatCurrency(selectedBroker.totalAmount, 'INR')}</strong> | Brokerage @ 1%: <strong style={{ color: '#9333ea' }}>{formatCurrency(selectedBroker.totalAmount * 0.01, 'INR')}</strong>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setSelectedBroker(null)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pl' && (
        <>
          {/* P&L Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green"><TrendingUp size={22} /></div>
              <div><p className="stat-label">Revenue (ex. tax)</p><h2 className="stat-value stat-value-green">{formatCurrency(revenueExTax, currencyFilter)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple"><TrendingDown size={22} /></div>
              <div><p className="stat-label">Expenses (ex. GST)</p><h2 className="stat-value stat-value-purple">{formatCurrency(expenseExGST, currencyFilter)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: netProfit >= 0 ? 'var(--success-light)' : 'var(--danger-light)', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                <Wallet size={22} />
              </div>
              <div>
                <p className="stat-label">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</p>
                {/* v1.10.74 - a loss shows a minus sign, not just red colour */}
                <h2 className="stat-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(netProfit, currencyFilter)}</h2>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue"><BarChart3 size={22} /></div>
              <div><p className="stat-label">Margin</p><h2 className="stat-value">{revenueExTax > 0 ? Math.round((netProfit / revenueExTax) * 100) : 0}%</h2></div>
            </div>
          </div>

          {/* P&L Statement */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="table-header">
              <h3>Profit & Loss Statement</h3>
              {allCurrencies.length > 1 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                  Showing {currencyFilter} invoices only
                </span>
              )}
            </div>
            <div style={{ padding: '1.5rem' }}>
              <table style={{ width: '100%', maxWidth: '500px', margin: '0 auto', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Revenue</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalRevenue, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Less: GST Collected</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(totalTaxCollected, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Net Revenue</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(revenueExTax, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Expenses</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(totalExpenseAmount, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 500, color: 'var(--text-secondary)' }}>Less: GST on Expenses (ITC)</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', color: '#059669' }}>-{formatCurrency(totalExpenseGST, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Net Expenses</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(expenseExGST, currencyFilter)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '1rem 0', fontWeight: 800, fontSize: '1.1rem' }}>
                      Net {netProfit >= 0 ? 'Profit' : 'Loss'}
                    </td>
                    <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
                      {formatCurrency(netProfit, currencyFilter)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Breakdown */}
          {monthlyKeys.length > 0 && (
            <div className="glass-panel">
              <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3>Monthly Breakdown</h3>
                <TableExport title="Profit and loss by month" filename={`Profit-and-loss-${periodLabel}`} subtitle={exportSubtitle('before tax, GST left out')}
                  headers={['Month', 'Revenue', 'Expenses', 'Profit/Loss']}
                  rows={[
                    ...monthlyKeys.map(key => {
                      const m = monthlyPL[key];
                      const [y, mo] = key.split('-');
                      return [`${MONTHS[parseInt(mo) - 1]} ${y}`, r2(m.revenue - m.tax), r2(m.expense - m.expGst), r2((m.revenue - m.tax) - (m.expense - m.expGst))];
                    }),
                    ['Total', r2(revenueExTax), r2(expenseExGST), r2(netProfit)],
                  ]} />
              </div>
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '600px' }}>
                  <thead><tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Expenses</th>
                    <th style={{ textAlign: 'right' }}>Profit/Loss</th>
                  </tr></thead>
                  <tbody>
                    {monthlyKeys.map(key => {
                      const m = monthlyPL[key];
                      const rev = m.revenue - m.tax;
                      const exp = m.expense - m.expGst;
                      const pl = rev - exp;
                      const [y, mo] = key.split('-');
                      return (
                        <tr key={key}>
                          <td className="font-medium">{MONTHS[parseInt(mo) - 1]} {y}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(rev, currencyFilter)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(exp, currencyFilter)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: pl >= 0 ? '#059669' : '#dc2626' }}>
                            {formatCurrency(pl, currencyFilter)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'party' && (
        <PartyOutstandingReport
          bills={bills}
          businessName={selectedCompany?.businessName || businessName}
          allCompanies={allCompanies}
          selectedCompanyId={selectedCompanyId}
          onCompanyChange={setSelectedCompanyId}
        />
      )}

      {activeTab === 'stock' && <StockReport businessName={businessName} />}

      {activeTab === 'aging' && (
        <>
          {/* Aging Summary Cards — per currency */}
          {agingCurrencies.map(cur => (
            <div key={cur} style={{ marginBottom: '1rem' }}>
              {agingCurrencies.length > 1 && (
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{cur}</p>
              )}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div className="stat-card">
                  <div className="stat-icon stat-icon-blue"><Wallet size={22} /></div>
                  <div><p className="stat-label">Total Outstanding</p><h2 className="stat-value">{formatCurrency(agingByCurrency[cur].total, cur)}</h2></div>
                </div>
                <div className="stat-card">
                  <div><p className="stat-label">Current (0-30d)</p><h2 className="stat-value stat-value-green">{formatCurrency(agingByCurrency[cur].current, cur)}</h2></div>
                </div>
                <div className="stat-card">
                  <div><p className="stat-label">31-60 days</p><h2 className="stat-value stat-value-amber">{formatCurrency(agingByCurrency[cur]['31to60'], cur)}</h2></div>
                </div>
                <div className="stat-card">
                  <div><p className="stat-label">61-90 days</p><h2 className="stat-value stat-value-purple">{formatCurrency(agingByCurrency[cur]['61to90'], cur)}</h2></div>
                </div>
                <div className="stat-card">
                  <div><p className="stat-label">90+ days</p><h2 className="stat-value" style={{ color: '#dc2626' }}>{formatCurrency(agingByCurrency[cur]['90plus'], cur)}</h2></div>
                </div>
              </div>
            </div>
          ))}
          {agingCurrencies.length === 0 && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.5rem' }}>
              {['Total Outstanding', 'Current (0-30d)', '31-60 days', '61-90 days', '90+ days'].map(label => (
                <div key={label} className="stat-card">
                  <div><p className="stat-label">{label}</p><h2 className="stat-value">{formatCurrency(0)}</h2></div>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="glass-panel p-4 mb-6" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <div className="search-box" style={{ maxWidth: '350px' }}>
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Filter by client name..." value={agingSearch}
                onChange={e => setAgingSearch(e.target.value)} className="search-input" />
              {agingSearch && <button className="icon-btn" onClick={() => setAgingSearch('')}><X size={14} /></button>}
            </div>
          </div>

          {/* Aging Table */}
          <div className="glass-panel">
            <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3>Outstanding Receivables</h3>
              <TableExport title="Outstanding receivables" filename="Outstanding-receivables" landscape
                subtitle={[selectedCompany?.businessName || businessName, `unpaid as on ${today.toLocaleDateString('en-IN')}`].filter(Boolean).join(', ')}
                headers={['Company', 'Client', 'Invoice No', 'Date', 'Due date', 'Currency', 'Amount', 'Paid', 'Outstanding', 'Days overdue']}
                rows={agingSorted.map(a => [a.companyName || '', a.clientName, a.invoiceNumber || '', a.invoiceDate || '', a.dueDate || '', a.currency, r2(a.totalAmount), r2(a.paidAmount), r2(a.outstanding), a.daysOverdue])} />
            </div>
            {agingSorted.length === 0 ? (
              <div className="empty-state">
                <Wallet size={48} />
                <p>No outstanding receivables found.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '920px' }}>
                  <thead>
                    <tr>
                      <th>Company (फ़र्म)</th>
                      <th>Client</th>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Due Date</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th style={{ textAlign: 'right' }}>Outstanding</th>
                      <th style={{ textAlign: 'right' }}>Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agingSorted.map((r, i) => (
                      <tr key={i} className={r.daysOverdue > 90 ? 'row-overdue' : r.daysOverdue > 30 ? 'row-warning' : ''}>
                        <td>
                          <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                            {r.companyName}
                          </span>
                        </td>
                        <td className="font-medium">{r.clientName}</td>
                        <td><span className="invoice-badge">{r.invoiceNumber}</span></td>
                        <td className="text-muted">{r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="text-muted">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.totalAmount, r.currency)}</td>
                        <td style={{ textAlign: 'right' }} className="text-muted">{r.paidAmount > 0 ? formatCurrency(r.paidAmount, r.currency) : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(r.outstanding, r.currency)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                            background: r.daysOverdue > 90 ? 'rgba(220,38,38,0.15)' : r.daysOverdue > 60 ? 'rgba(139,92,246,0.15)' : r.daysOverdue > 30 ? 'rgba(217,119,6,0.15)' : 'rgba(5,150,105,0.15)',
                            color: r.daysOverdue > 90 ? '#dc2626' : r.daysOverdue > 60 ? '#8b5cf6' : r.daysOverdue > 30 ? '#d97706' : '#059669',
                          }}>
                            {r.daysOverdue === 0 ? 'Current' : `${r.daysOverdue}d`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* v1.9.5 — CLIENT ANALYTICS (revenue by client, aging, retention) */}
      {/* ============================================================ */}
      {activeTab === 'clients' && (() => {
        const filteredBills = allFilteredBills.filter(b => getBillCurrency(b) === currencyFilter);
        // Aggregate revenue + outstanding + count per client
        const byClient = {};
        filteredBills.forEach(b => {
          const name = b.clientName || '—';
          if (!byClient[name]) byClient[name] = { name, revenue: 0, paid: 0, outstanding: 0, count: 0, lastInvoiceDate: '' };
          const sign = salesSign(b);
          byClient[name].revenue += sign * (b.totalAmount || 0);
          if (sign > 0) {
            byClient[name].paid += (b.paidAmount || 0);
            byClient[name].outstanding += b.status === 'paid' ? 0 : Math.max(0, amountDue(b) - (b.paidAmount || 0));
            byClient[name].count += 1;
          }
          if (!byClient[name].lastInvoiceDate || b.invoiceDate > byClient[name].lastInvoiceDate) {
            byClient[name].lastInvoiceDate = b.invoiceDate;
          }
        });
        const clientArr = Object.values(byClient);
        const topByRevenue = [...clientArr].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        const worstPayers = clientArr.filter(c => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 10);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>🏆 Top clients by revenue</h3>
              {topByRevenue.length === 0 ? <p className="text-muted">No client data for this period.</p> : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Client</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Invoices</th></tr></thead>
                  <tbody>
                    {topByRevenue.map((c, i) => (
                      <tr key={i}>
                        <td className="font-medium">{c.name}</td>
                        <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>{formatCurrency(c.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right' }}>{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>⚠️ Highest outstanding (worst payers)</h3>
              {worstPayers.length === 0 ? <p className="text-muted">Everyone is up to date. 🎉</p> : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Client</th><th style={{ textAlign: 'right' }}>Outstanding</th><th style={{ textAlign: 'right' }}>% Unpaid</th></tr></thead>
                  <tbody>
                    {worstPayers.map((c, i) => (
                      <tr key={i}>
                        <td className="font-medium">{c.name}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{formatCurrency(c.outstanding, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{c.revenue > 0 ? `${Math.round((c.outstanding / c.revenue) * 100)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>📊 All clients breakdown ({clientArr.length})</h3>
                <TableExport title="Client analytics" filename={`Clients-${periodLabel}`} subtitle={exportSubtitle()}
                  headers={['Client', 'Invoices', 'Revenue', 'Paid', 'Outstanding', 'Last invoice']}
                  rows={[...clientArr].sort((a, b) => b.revenue - a.revenue).map(c => [c.name, c.count, r2(c.revenue), r2(c.paid), r2(c.outstanding), c.lastInvoiceDate || ''])} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Invoices</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                    <th>Last Invoice</th>
                  </tr></thead>
                  <tbody>
                    {clientArr.sort((a, b) => b.revenue - a.revenue).map((c, i) => (
                      <tr key={i}>
                        <td className="font-medium">{c.name}</td>
                        <td style={{ textAlign: 'right' }}>{c.count}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(c.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(c.paid, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: c.outstanding > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: c.outstanding > 0 ? 600 : 400 }}>
                          {c.outstanding > 0 ? formatCurrency(c.outstanding, currencyFilter) : '—'}
                        </td>
                        <td className="text-muted">{c.lastInvoiceDate ? new Date(c.lastInvoiceDate).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* v1.9.5 — PRODUCT PERFORMANCE (best sellers, revenue per SKU) */}
      {/* ============================================================ */}
      {activeTab === 'products' && (() => {
        const filteredBills = allFilteredBills.filter(b => getBillCurrency(b) === currencyFilter);
        // Aggregate quantity + revenue + last-sold per unique item name
        const byProduct = {};
        filteredBills.forEach(b => {
          (b.data?.items || []).forEach(item => {
            if (item.isCharge) return; // v1.10.77 (#87) - delivery charges are not a product
            const name = (item.name || item.description || 'Unnamed').trim();
            if (!name || name === 'Unnamed') return;
            if (!byProduct[name]) byProduct[name] = { name, hsn: item.hsn || '', qty: 0, revenue: 0, txns: 0, lastSold: '' };
            // A credit note takes returned quantities back off.
            const qty = salesSign(b) * (Number(item.quantity) || 0);
            // v1.10.74 - revenue is the line's taxable value (after discount,
            // tax backed out of tax-inclusive prices) so it matches the invoices.
            // totals.taxInclusive is set only when GST was charged: a bill of
            // supply's prices have no tax in them to back out.
            const { afterDiscount } = calculateLineItemTax(item, !!(b.data?.totals?.taxInclusive ?? b.data?.taxInclusive));
            byProduct[name].qty += qty;
            byProduct[name].revenue += salesSign(b) * afterDiscount;
            byProduct[name].txns += 1;
            if (!byProduct[name].lastSold || b.invoiceDate > byProduct[name].lastSold) byProduct[name].lastSold = b.invoiceDate;
            if (item.hsn && !byProduct[name].hsn) byProduct[name].hsn = item.hsn;
          });
        });
        // #96 - quantities rounded once, after adding up (6356.959999 -> 6356.96).
        const productArr = Object.values(byProduct).map((p) => ({ ...p, qty: roundQty(p.qty) }));
        const bestSellers = [...productArr].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        const mostSoldByUnits = [...productArr].sort((a, b) => b.qty - a.qty).slice(0, 10);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>💰 Top revenue producers</h3>
              {bestSellers.length === 0 ? <p className="text-muted">No product data for this period.</p> : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Qty sold</th></tr></thead>
                  <tbody>
                    {bestSellers.map((p, i) => (
                      <tr key={i}>
                        <td className="font-medium" title={p.hsn ? `HSN ${p.hsn}` : ''}>{p.name}</td>
                        <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>{formatCurrency(p.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right' }}>{p.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>📦 Most units sold</h3>
              {mostSoldByUnits.length === 0 ? <p className="text-muted">No product data.</p> : (
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Qty sold</th><th style={{ textAlign: 'right' }}>Txns</th></tr></thead>
                  <tbody>
                    {mostSoldByUnits.map((p, i) => (
                      <tr key={i}>
                        <td className="font-medium">{p.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.qty}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{p.txns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>📋 All products ({productArr.length})</h3>
                <TableExport title="Product performance" filename={`Products-sold-${periodLabel}`} subtitle={exportSubtitle('revenue before tax')}
                  headers={['Product', 'HSN', 'Qty sold', 'Revenue', 'Avg rate', 'Txns', 'Last sold']}
                  rows={[...productArr].sort((a, b) => b.revenue - a.revenue).map(p => [p.name, p.hsn || '', p.qty, r2(p.revenue), p.qty > 0 ? r2(p.revenue / p.qty) : 0, p.txns, p.lastSold || ''])} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead><tr>
                    <th>Product</th><th>HSN</th>
                    <th style={{ textAlign: 'right' }}>Qty sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Avg rate</th>
                    <th style={{ textAlign: 'right' }}>Txns</th>
                    <th>Last sold</th>
                  </tr></thead>
                  <tbody>
                    {productArr.sort((a, b) => b.revenue - a.revenue).map((p, i) => (
                      <tr key={i}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-muted" style={{ fontSize: '0.78rem' }}>{p.hsn || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{p.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{p.qty > 0 ? formatCurrency(p.revenue / p.qty, currencyFilter) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{p.txns}</td>
                        <td className="text-muted">{p.lastSold ? new Date(p.lastSold).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
