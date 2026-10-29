import { useState } from 'react';
import { X, Users, Scissors, Package, Check } from 'lucide-react';
import { saveClient, saveBroker, saveProduct } from '../store';
import { toast } from './Toast';

export default function QuickAddModal({ isOpen, onClose, onAdded }) {
  if (!isOpen) return null;

  const [tab, setTab] = useState('party'); // 'party' | 'broker' | 'product'

  // Party Form
  const [partyForm, setPartyForm] = useState({ name: '', gstin: '', phone: '', address: '', state: '' });
  // Broker Form
  const [brokerForm, setBrokerForm] = useState({ name: '', phone: '' });
  // Product Form
  const [productForm, setProductForm] = useState({ name: '', hsn: '', unit: 'Pcs', salesPrice: '', taxPercent: '5', stock: '' });

  const handleSaveParty = async (e) => {
    e.preventDefault();
    if (!partyForm.name.trim()) { toast('Party name is required', 'warning'); return; }
    try {
      await saveClient({ id: 'cli_' + Date.now(), ...partyForm });
      toast(`Party "${partyForm.name}" added successfully!`, 'success');
      setPartyForm({ name: '', gstin: '', phone: '', address: '', state: '' });
      if (onAdded) onAdded('client');
      onClose();
    } catch {
      toast('Failed to save party', 'error');
    }
  };

  const handleSaveBroker = async (e) => {
    e.preventDefault();
    if (!brokerForm.name.trim()) { toast('Broker name is required', 'warning'); return; }
    try {
      await saveBroker({ id: 'brk_' + Date.now(), ...brokerForm });
      toast(`Broker "${brokerForm.name}" added successfully!`, 'success');
      setBrokerForm({ name: '', phone: '' });
      if (onAdded) onAdded('broker');
      onClose();
    } catch {
      toast('Failed to save broker', 'error');
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim()) { toast('Item name is required', 'warning'); return; }
    try {
      await saveProduct({
        id: 'prod_' + Date.now(),
        ...productForm,
        salesPrice: parseFloat(productForm.salesPrice) || 0,
        taxPercent: parseFloat(productForm.taxPercent) || 0,
        stock: parseInt(productForm.stock, 10) || 0,
      });
      toast(`Item "${productForm.name}" added successfully!`, 'success');
      setProductForm({ name: '', hsn: '', unit: 'Pcs', salesPrice: '', taxPercent: '5', stock: '' });
      if (onAdded) onAdded('product');
      onClose();
    } catch {
      toast('Failed to save item', 'error');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '580px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--primary)' }}>Quick Add Masters (किक ऐड)</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Add Party, Broker, or Item instantly in one place</p>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            className={`btn ${tab === 'party' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.88rem', padding: '0.6rem' }}
            onClick={() => setTab('party')}
          >
            <Users size={15} /> Party / Client
          </button>
          <button
            className={`btn ${tab === 'broker' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.88rem', padding: '0.6rem' }}
            onClick={() => setTab('broker')}
          >
            <Scissors size={15} /> Broker (दलाल)
          </button>
          <button
            className={`btn ${tab === 'product' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.88rem', padding: '0.6rem' }}
            onClick={() => setTab('product')}
          >
            <Package size={15} /> Item / Product
          </button>
        </div>

        {tab === 'party' && (
          <form onSubmit={handleSaveParty} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Party Name *</label>
              <input type="text" className="form-input" placeholder="e.g. Sharma Textiles" value={partyForm.name} onChange={e => setPartyForm({ ...partyForm, name: e.target.value })} required autoFocus />
            </div>
            <div>
              <label className="form-label">GSTIN</label>
              <input type="text" className="form-input" placeholder="24AAAAA0000A1Z5" value={partyForm.gstin} onChange={e => setPartyForm({ ...partyForm, gstin: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-input" placeholder="9876543210" value={partyForm.phone} onChange={e => setPartyForm({ ...partyForm, phone: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Address</label>
              <input type="text" className="form-input" placeholder="Street address, City" value={partyForm.address} onChange={e => setPartyForm({ ...partyForm, address: e.target.value })} />
            </div>
            <div>
              <label className="form-label">State</label>
              <input type="text" className="form-input" placeholder="e.g. Gujarat" value={partyForm.state} onChange={e => setPartyForm({ ...partyForm, state: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Check size={16} /> Save Party</button>
            </div>
          </form>
        )}

        {tab === 'broker' && (
          <form onSubmit={handleSaveBroker} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem' }}>
            <div>
              <label className="form-label">Broker Name (दलाल का नाम) *</label>
              <input type="text" className="form-input" placeholder="e.g. Ramesh Bhai Broker" value={brokerForm.name} onChange={e => setBrokerForm({ ...brokerForm, name: e.target.value })} required autoFocus />
            </div>
            <div>
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-input" placeholder="9876543210" value={brokerForm.phone} onChange={e => setBrokerForm({ ...brokerForm, phone: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Check size={16} /> Save Broker</button>
            </div>
          </form>
        )}

        {tab === 'product' && (
          <form onSubmit={handleSaveProduct} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Item / Product Name *</label>
              <input type="text" className="form-input" placeholder="e.g. Rayon Cotton Fabric" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} required autoFocus />
            </div>
            <div>
              <label className="form-label">HSN / SAC Code</label>
              <input type="text" className="form-input" placeholder="5407" value={productForm.hsn} onChange={e => setProductForm({ ...productForm, hsn: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Unit</label>
              <select className="form-input" value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value })}>
                <option value="Mtr">Mtr (Meter)</option>
                <option value="Pcs">Pcs (Pieces)</option>
                <option value="Kgs">Kgs (Kilograms)</option>
                <option value="Set">Set</option>
                <option value="Box">Box</option>
              </select>
            </div>
            <div>
              <label className="form-label">Price / Rate (₹)</label>
              <input type="number" className="form-input" placeholder="0.00" value={productForm.salesPrice} onChange={e => setProductForm({ ...productForm, salesPrice: e.target.value })} />
            </div>
            <div>
              <label className="form-label">GST Rate (%)</label>
              <select className="form-input" value={productForm.taxPercent} onChange={e => setProductForm({ ...productForm, taxPercent: e.target.value })}>
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
            <div>
              <label className="form-label">Opening Stock</label>
              <input type="number" className="form-input" placeholder="0" value={productForm.stock} onChange={e => setProductForm({ ...productForm, stock: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Check size={16} /> Save Item</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
