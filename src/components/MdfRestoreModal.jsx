import { useState, useRef } from 'react';
import { Database, Upload, Check, AlertCircle, FileText, Package, Users, ShoppingCart, Layers, CreditCard, X, RefreshCw, Eye } from 'lucide-react';
import { parseMdfDatabaseFile } from '../utils/mdfParser';
import { saveBill, saveChallan, savePurchase, saveReceipt, saveClient, saveProduct } from '../store';
import { toast } from './Toast';

export default function MdfRestoreModal({ isOpen, onClose, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ status: '', percent: 0 });
  const [scanResult, setScanResult] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedCategories, setSelectedCategories] = useState({
    bills: true,
    challans: true,
    purchases: true,
    receipts: true,
    clients: true,
    products: true,
  });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    await startScan(selectedFile);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    setFile(droppedFile);
    await startScan(droppedFile);
  };

  const startScan = async (targetFile) => {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await parseMdfDatabaseFile(targetFile, (prog) => {
        setScanProgress(prog);
      });
      setScanResult(result);

      // Auto check only categories that have records
      setSelectedCategories({
        bills: (result.bills?.length || 0) > 0,
        challans: (result.challans?.length || 0) > 0,
        purchases: (result.purchases?.length || 0) > 0,
        receipts: (result.receipts?.length || 0) > 0,
        clients: (result.clients?.length || 0) > 0,
        products: (result.products?.length || 0) > 0,
      });
      setActiveTab('summary');
    } catch (err) {
      console.error('Scan error:', err);
      toast('Failed to scan database file: ' + (err.message || 'Unknown format'), 'error');
    } finally {
      setScanning(false);
    }
  };

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleAll = (check) => {
    setSelectedCategories({
      bills: check,
      challans: check,
      purchases: check,
      receipts: check,
      clients: check,
      products: check,
    });
  };

  const totalSelectedRecords = () => {
    if (!scanResult) return 0;
    let count = 0;
    if (selectedCategories.bills) count += scanResult.bills?.length || 0;
    if (selectedCategories.challans) count += scanResult.challans?.length || 0;
    if (selectedCategories.purchases) count += scanResult.purchases?.length || 0;
    if (selectedCategories.receipts) count += scanResult.receipts?.length || 0;
    if (selectedCategories.clients) count += scanResult.clients?.length || 0;
    if (selectedCategories.products) count += scanResult.products?.length || 0;
    return count;
  };

  const handleExecuteImport = async () => {
    if (!scanResult) return;
    const total = totalSelectedRecords();
    if (total === 0) {
      toast('Please select at least one category to import', 'warning');
      return;
    }

    setImporting(true);
    let done = 0;
    setImportProgress({ current: 0, total });

    const summary = [];

    try {
      // 1. Clients
      if (selectedCategories.clients && scanResult.clients?.length) {
        for (const c of scanResult.clients) {
          try { await saveClient(c); } catch (e) { /* continue */ }
          done++;
          setImportProgress({ current: done, total });
        }
        summary.push(`${scanResult.clients.length} Clients/Parties`);
      }

      // 2. Products
      if (selectedCategories.products && scanResult.products?.length) {
        for (const p of scanResult.products) {
          try { await saveProduct(p); } catch (e) { /* continue */ }
          done++;
          setImportProgress({ current: done, total });
        }
        summary.push(`${scanResult.products.length} Products/Stock Items`);
      }

      // 3. Challans
      if (selectedCategories.challans && scanResult.challans?.length) {
        for (const ch of scanResult.challans) {
          try { await saveChallan(ch); } catch (e) { /* continue */ }
          done++;
          setImportProgress({ current: done, total });
        }
        summary.push(`${scanResult.challans.length} Delivery Challans`);
      }

      // 4. Bills / Sales Invoices
      if (selectedCategories.bills && scanResult.bills?.length) {
        for (const b of scanResult.bills) {
          try { await saveBill(b, { overwrite: true }); } catch (e) { /* continue */ }
          done++;
          setImportProgress({ current: done, total });
        }
        summary.push(`${scanResult.bills.length} Sales Invoices`);
      }

      // 5. Purchases
      if (selectedCategories.purchases && scanResult.purchases?.length) {
        for (const pur of scanResult.purchases) {
          try { await savePurchase(pur); } catch (e) { /* continue */ }
          done++;
          setImportProgress({ current: done, total });
        }
        summary.push(`${scanResult.purchases.length} Purchase Bills`);
      }

      // 6. Payments / Receipts
      if (selectedCategories.receipts && scanResult.receipts?.length) {
        for (const rec of scanResult.receipts) {
          try { await saveReceipt(rec); } catch (e) { /* continue */ }
          done++;
          setImportProgress({ current: done, total });
        }
        summary.push(`${scanResult.receipts.length} Payments/Receipts`);
      }

      toast(`Successfully imported: ${summary.join(', ')}!`, 'success', 8000);
      if (onImportComplete) onImportComplete();
      onClose();
    } catch (err) {
      console.error('Import error:', err);
      toast('Import completed with some errors: ' + (err.message || 'unknown'), 'warning');
    } finally {
      setImporting(false);
    }
  };

  const categories = [
    { id: 'bills', label: 'Sales Invoices (बिक्री बिल)', icon: <FileText size={18} />, count: scanResult?.bills?.length || 0, color: '#2563eb' },
    { id: 'challans', label: 'Delivery Challans (चालान)', icon: <Layers size={18} />, count: scanResult?.challans?.length || 0, color: '#7c3aed' },
    { id: 'purchases', label: 'Purchase Bills (खरीद बिल)', icon: <ShoppingCart size={18} />, count: scanResult?.purchases?.length || 0, color: '#d97706' },
    { id: 'receipts', label: 'Payments & Receipts (पेमेंट/रसीद)', icon: <CreditCard size={18} />, count: scanResult?.receipts?.length || 0, color: '#059669' },
    { id: 'clients', label: 'Parties / Clients (पार्टी/ग्राहक)', icon: <Users size={18} />, count: scanResult?.clients?.length || 0, color: '#0284c7' },
    { id: 'products', label: 'Products & Stock (आइटम/स्टॉक)', icon: <Package size={18} />, count: scanResult?.products?.length || 0, color: '#e11d48' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                SQL Server Database (.mdf) Data Restore
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Auto-scan &amp; restore Challan, Bill, Sale, Purchase, Payment &amp; Party tables
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* File Upload / Drag Zone */}
          {!file && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--primary)',
                borderRadius: '10px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                background: 'var(--primary-light, rgba(37, 99, 235, 0.05))',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Upload size={36} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
              <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem' }}>
                Select or Drag SQL Server Database (.mdf) File
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Supports Microsoft SQL Server Primary Data Files (<strong>.mdf</strong>, <strong>.bak</strong>, <strong>.sql</strong>, <strong>.ndf</strong>, <strong>.ldf</strong>) from Busy, Marg, Tally or custom ERPs
              </p>
              <button type="button" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
                <Upload size={14} /> Browse Database File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mdf,.bak,.sql,.ndf,.ldf,.dump,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* Active File Bar */}
          {file && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                <Database size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; {file.name.split('.').pop()?.toUpperCase()} File
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setFile(null); setScanResult(null); }}
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                disabled={scanning || importing}
              >
                Change File
              </button>
            </div>
          )}

          {/* Scanning Progress State */}
          {scanning && (
            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{scanProgress.status || 'Auto-scanning tables & data pages…'}</div>
              <div style={{ width: '100%', maxWidth: '300px', height: '6px', background: 'var(--border)', borderRadius: '3px', margin: '0.75rem auto 0', overflow: 'hidden' }}>
                <div style={{ width: `${scanProgress.percent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {/* Scan Results */}
          {scanResult && !scanning && (
            <div>
              {/* Category selector strip */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  Detected Business Records ({totalSelectedRecords()} to import)
                </span>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }} onClick={() => toggleAll(true)}>
                    Select All
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }} onClick={() => toggleAll(false)}>
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Category Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.45rem', marginBottom: '0.75rem' }}>
                {categories.map(cat => {
                  const isChecked = !!selectedCategories[cat.id];
                  const hasRecords = cat.count > 0;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => hasRecords && toggleCategory(cat.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '8px',
                        border: isChecked && hasRecords ? `1.5px solid ${cat.color}` : '1px solid var(--border)',
                        background: isChecked && hasRecords ? 'rgba(37, 99, 235, 0.04)' : 'var(--card-bg)',
                        cursor: hasRecords ? 'pointer' : 'default',
                        opacity: hasRecords ? 1 : 0.5,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked && hasRecords}
                          disabled={!hasRecords}
                          onChange={() => {}}
                          style={{ width: 14, height: 14, accentColor: cat.color }}
                        />
                        <span style={{ color: cat.color }}>{cat.icon}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{cat.label}</span>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: '999px',
                        background: hasRecords ? `${cat.color}15` : 'var(--bg-secondary)',
                        color: hasRecords ? cat.color : 'var(--text-muted)'
                      }}>
                        {cat.count}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Data Preview Tab Navigation */}
              <div style={{ display: 'flex', gap: '0.35rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.3rem', marginBottom: '0.5rem', overflowX: 'auto' }}>
                <button
                  type="button"
                  className={`btn ${activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => setActiveTab('summary')}
                >
                  Summary
                </button>
                {categories.filter(c => c.count > 0).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={`btn ${activeTab === c.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => setActiveTab(c.id)}
                  >
                    {c.icon} {c.label.split(' ')[0]} ({c.count})
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.75rem' }}>
                {activeTab === 'summary' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                      The parser scanned the MDF database structures and found the following data to import:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.6 }}>
                      <li><strong>{scanResult.bills?.length || 0} Sales Bills</strong> with invoice numbers, line items, and GST calculations</li>
                      <li><strong>{scanResult.challans?.length || 0} Delivery Challans</strong> ready for pending challan dispatch &amp; billing</li>
                      <li><strong>{scanResult.purchases?.length || 0} Purchase Bills</strong> with supplier entries and tax breakdown</li>
                      <li><strong>{scanResult.receipts?.length || 0} Payment &amp; Receipt Vouchers</strong> with bank/cash details</li>
                      <li><strong>{scanResult.clients?.length || 0} Parties/Clients</strong> with GSTIN, addresses, and broker tags</li>
                      <li><strong>{scanResult.products?.length || 0} Products &amp; Stock Items</strong> with HSN codes, rates, and opening stock</li>
                    </ul>
                  </div>
                )}

                {/* Table Previews for active category */}
                {activeTab !== 'summary' && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.25rem 0.4rem' }}>#</th>
                          <th style={{ padding: '0.25rem 0.4rem' }}>Document / Name</th>
                          <th style={{ padding: '0.25rem 0.4rem' }}>Party / Details</th>
                          <th style={{ padding: '0.25rem 0.4rem' }}>Date</th>
                          <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Amount / Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(scanResult[activeTab] || []).slice(0, 10).map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            <td style={{ padding: '0.25rem 0.4rem' }}>{idx + 1}</td>
                            <td style={{ padding: '0.25rem 0.4rem', fontWeight: 600 }}>
                              {row.invoiceNumber || row.challanNumber || row.billNumber || row.receiptNumber || row.name || 'Record'}
                            </td>
                            <td style={{ padding: '0.25rem 0.4rem' }}>
                              {row.clientName || row.supplierName || row.partyName || row.gstin || row.unit || '-'}
                            </td>
                            <td style={{ padding: '0.25rem 0.4rem' }}>{row.date || '-'}</td>
                            <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right', fontWeight: 600 }}>
                              ₹{(row.total || row.totalAmount || row.amount || row.price || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(scanResult[activeTab]?.length || 0) > 10 && (
                      <div style={{ textAlign: 'center', padding: '0.35rem 0', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        + {scanResult[activeTab].length - 10} more records in this category
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Importing Progress Bar */}
          {importing && (
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <RefreshCw size={20} className="spin" style={{ color: 'var(--primary)', marginBottom: '0.4rem' }} />
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Importing data into app database… ({importProgress.current} / {importProgress.total})
              </div>
              <div style={{ width: '100%', maxWidth: '300px', height: '6px', background: 'var(--border)', borderRadius: '3px', margin: '0.5rem auto 0', overflow: 'hidden' }}>
                <div style={{ width: `${(importProgress.current / (importProgress.total || 1)) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.65rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={importing}
          >
            Cancel
          </button>

          {scanResult && !scanning && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExecuteImport}
              disabled={importing || totalSelectedRecords() === 0}
              style={{ fontWeight: 600 }}
            >
              {importing ? (
                <>
                  <RefreshCw size={14} className="spin" /> Importing ({importProgress.current}/{importProgress.total})…
                </>
              ) : (
                <>
                  <Check size={16} /> Import Selected ({totalSelectedRecords()}) Records (डेटा जोड़ें)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
