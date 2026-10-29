import { useState, useEffect } from 'react';
import { Folder, FileText, Plus, Trash2, Printer, Check, ArrowRight } from 'lucide-react';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';

// Folder-wise Crystal / Custom Print Templates stored in localStorage
const TEMPLATE_KEY = 'fgsb_folder_print_templates';

const DEFAULT_FOLDERS = [
  { id: 'challan', name: 'Challan (चालान प्रिंट फाइल्स)', desc: 'Delivery Challan & Taka report templates' },
  { id: 'invoice', name: 'Invoice (बिल / टैक्स इनवॉइस)', desc: 'Tax invoice & Bill of Supply report templates' },
  { id: 'receipt', name: 'Receipts & Payments', desc: 'Receipt and payment voucher print layouts' },
  { id: 'outstanding', name: 'Outstanding & Ledger', desc: 'Party outstanding & ledger statement templates' },
];

export default function PrintTemplatesHub() {
  const [templates, setTemplates] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const [activeFolder, setActiveFolder] = useState('challan');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: '', folder: 'challan', layoutType: 'standard', content: '' });

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
    } catch { /* private mode */ }
  }, [templates]);

  const handleAddTemplate = (e) => {
    e.preventDefault();
    if (!newTpl.name.trim()) { toast('Template name required', 'warning'); return; }
    const tpl = {
      id: 'tpl_' + Date.now(),
      ...newTpl,
      createdAt: new Date().toISOString(),
    };
    setTemplates(prev => [tpl, ...prev]);
    toast(`Template "${tpl.name}" added to ${tpl.folder} folder successfully!`, 'success');
    setNewTpl({ name: '', folder: activeFolder, layoutType: 'standard', content: '' });
    setShowAddModal(false);
  };

  const handleDelete = async (id) => {
    const ok = await confirmAction({
      title: 'Delete Print Template?',
      message: 'Are you sure you want to remove this template file reference?',
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast('Template removed', 'success');
  };

  const folderTemplates = templates.filter(t => t.folder === activeFolder);

  return (
    <div className="view-container">
      <div className="page-header-row">
        <div>
          <h2>Crystal Reports & Folder Print Templates (रिपोर्ट्स फोल्डर)</h2>
          <p className="page-subtitle">Organize and connect your custom print files and report layouts folder-wise</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <HelpButton topic="crystal-reports" />
          <button className="btn btn-primary" onClick={() => { setNewTpl({ name: '', folder: activeFolder, layoutType: 'standard', content: '' }); setShowAddModal(true); }}>
            <Plus size={16} /> Add Report File / Template
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* Folders Sidebar */}
        <div className="card" style={{ padding: '1rem', height: 'fit-content' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Report Folders</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {DEFAULT_FOLDERS.map(f => {
              const count = templates.filter(t => t.folder === f.id).length;
              return (
                <button
                  key={f.id}
                  className={`btn ${activeFolder === f.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'space-between', textAlign: 'left', padding: '0.7rem 0.9rem' }}
                  onClick={() => setActiveFolder(f.id)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Folder size={16} /> {f.name.split(' ')[0]}
                  </span>
                  <span style={{ background: activeFolder === f.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.78rem' }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Templates List */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                Folder: {DEFAULT_FOLDERS.find(f => f.id === activeFolder)?.name}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {DEFAULT_FOLDERS.find(f => f.id === activeFolder)?.desc}
              </p>
            </div>
          </div>

          {folderTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Folder size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontWeight: 500 }}>No report files connected in this folder yet.</p>
              <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>Click "Add Report File / Template" to link your custom print files.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {folderTemplates.map(t => (
                <div key={t.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <FileText size={18} style={{ color: 'var(--primary)' }} />
                      <strong style={{ fontSize: '0.98rem' }}>{t.name}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      Layout: <span className="badge">{t.layoutType}</span> &middot; Added: {new Date(t.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => toast(`Connected report "${t.name}" active for printing!`, 'success')}>
                      <Check size={14} /> Active
                    </button>
                    <button className="btn-icon btn-icon-red" onClick={() => handleDelete(t.id)} title="Remove">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 className="section-title">Link Custom Report / Print File</h3>
            <form onSubmit={handleAddTemplate} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label className="form-label">Template / Report Name *</label>
                <input type="text" className="form-input" placeholder="e.g. Taka Challan Format 1.rpt" value={newTpl.name} onChange={e => setNewTpl({ ...newTpl, name: e.target.value })} required autoFocus />
              </div>
              <div>
                <label className="form-label">Target Folder</label>
                <select className="form-input" value={newTpl.folder} onChange={e => setNewTpl({ ...newTpl, folder: e.target.value })}>
                  {DEFAULT_FOLDERS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Report Engine Format</label>
                <select className="form-input" value={newTpl.layoutType} onChange={e => setNewTpl({ ...newTpl, layoutType: e.target.value })}>
                  <option value="standard">Crystal Reports (.rpt)</option>
                  <option value="html">HTML Custom Layout</option>
                  <option value="tally">Tally Format Layout</option>
                  <option value="compact">Compact Thermal Layout</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Link Report</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
