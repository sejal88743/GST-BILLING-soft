import assert from 'node:assert';
import {
  matchesCompany,
  getRecordCompanyName,
  extractAllCompanies
} from '../src/utils/companyContext.js';
import { partyOutstanding, periodMonths } from '../src/utils/partyOutstanding.js';

console.log('Testing Multi-Company Utility and Party Outstanding Logic...');

// 1. Test matchesCompany with 'all'
assert.strictEqual(matchesCompany({ businessName: 'A Mills' }, 'all'), true, 'Matches company should be true for "all"');
assert.strictEqual(matchesCompany({ businessName: 'A Mills' }, { id: 'all' }), true, 'Matches company should be true for { id: "all" }');
assert.strictEqual(matchesCompany({ businessName: 'A Mills' }, null), true, 'Matches company should be true for null');

// 2. Test matchesCompany with specific company
const firm1 = { id: 'p1', businessName: 'Shree Ram Textiles', gstin: '24AAAAA0000A1Z5' };
const firm2 = { id: 'p2', businessName: 'Radha Fab', gstin: '24BBBBB0000B1Z6' };

const bill1 = { companyId: 'p1', companyName: 'Shree Ram Textiles', clientName: 'Surat Traders' };
const bill2 = { data: { profile: { businessName: 'Radha Fab' } }, clientName: 'Surat Traders' };

assert.strictEqual(matchesCompany(bill1, firm1), true, 'Bill1 matches firm1');
assert.strictEqual(matchesCompany(bill1, firm2), false, 'Bill1 does not match firm2');
assert.strictEqual(matchesCompany(bill2, firm2), true, 'Bill2 matches firm2');

// 3. Test getRecordCompanyName fallback
assert.strictEqual(getRecordCompanyName(bill1, 'Default'), 'Shree Ram Textiles');
assert.strictEqual(getRecordCompanyName(bill2, 'Default'), 'Radha Fab');
assert.strictEqual(getRecordCompanyName({}, 'Default'), 'Default');

// 4. Test extractAllCompanies
const profiles = [
  { id: 'p1', businessName: 'Firm 1', gstin: '24AAAAA0000A1Z5' },
  { id: 'p2', businessName: 'Firm 2', gstin: '24BBBBB0000B1Z6' },
];
const rawRecords = [
  { companyName: 'Firm 1' },
  { companyName: 'Firm 3 Legacy', companyGstin: '24CCCCC0000C1Z7' },
];
const extracted = extractAllCompanies(profiles, rawRecords);
assert.strictEqual(extracted.length, 3, 'Should extract 3 distinct companies');
assert(extracted.some(c => c.businessName === 'Firm 1'));
assert(extracted.some(c => c.businessName === 'Firm 2'));
assert(extracted.some(c => c.businessName === 'Firm 3 Legacy'));

// 5. Test partyOutstanding with multi-company bills
const testBills = [
  {
    invoiceNumber: 'INV-01',
    invoiceDate: '2026-05-10',
    clientName: 'Shree Fashion',
    totalAmount: 50000,
    paidAmount: 20000,
    status: 'partial',
    companyName: 'Firm 1',
  },
  {
    invoiceNumber: 'INV-02',
    invoiceDate: '2026-06-15',
    clientName: 'Shree Fashion',
    totalAmount: 30000,
    paidAmount: 0,
    status: 'unpaid',
    companyName: 'Firm 2',
  },
  {
    invoiceNumber: 'INV-03',
    invoiceDate: '2026-07-20',
    clientName: 'Krishna Sarees',
    totalAmount: 40000,
    paidAmount: 40000,
    status: 'paid',
    companyName: 'Firm 1',
  }
];

const months = periodMonths('fy', 2026);
const result = partyOutstanding(testBills, months);
const shreeFashion = result.find(r => r.name === 'Shree Fashion');
assert(shreeFashion, 'Shree Fashion row exists');
assert.strictEqual(shreeFashion.total, 60000, 'Total due across both firms: 30k + 30k = 60k');
assert.strictEqual(shreeFashion.companies['Firm 1'], 30000, 'Firm 1 due: 30,000');
assert.strictEqual(shreeFashion.companies['Firm 2'], 30000, 'Firm 2 due: 30,000');
assert.strictEqual(shreeFashion.bills.length, 2, '2 pending bills recorded');

console.log('✓ All Multi-Company tests passed successfully!');
