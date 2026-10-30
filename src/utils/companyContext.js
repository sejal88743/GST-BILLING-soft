// Utility for Multi-Company and Financial Year filtering & scoping

/**
 * Calculates Indian Financial Year string (e.g. '2025-2026') from any date string or Date object.
 * Financial Year runs from 1st April to 31st March.
 */
export function getIndianFinancialYear(dateInput) {
  if (!dateInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    const now = new Date();
    const year = now.getFullYear();
    return `${year}-${year + 1}`;
  }
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

/**
 * Returns available Indian Financial Year options.
 */
export function getFinancialYearOptions() {
  const currentFY = getIndianFinancialYear();
  const [startYear] = currentFY.split('-').map(Number);
  const years = [];
  // 3 past years, current, and 2 future years
  for (let y = startYear - 2; y <= startYear + 2; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

/**
 * Checks if a date (YYYY-MM-DD) falls inside an Indian FY (e.g., '2025-2026')
 */
export function isDateInFinancialYear(dateStr, fy) {
  if (!fy || fy === 'all') return true;
  if (!dateStr) return false;
  const parts = fy.split('-').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return true;
  const from = `${parts[0]}-04-01`;
  const to = `${parts[1]}-03-31`;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

/**
 * Normalizes company name for case-insensitive and whitespace-trimmed comparison.
 */
export function normalizeCompanyName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Returns the company name associated with a record (Bill, Challan, Purchase, Expense)
 */
export function getRecordCompanyName(item, fallback = '') {
  if (!item) return fallback;
  return (
    item.companyName ||
    item.profileBusinessName ||
    item.ownerName ||
    item.data?.profile?.businessName ||
    item.businessName ||
    fallback ||
    'Main Firm'
  );
}

/**
 * Returns the company GSTIN associated with a record
 */
export function getRecordCompanyGstin(item) {
  if (!item) return '';
  return (
    item.companyGstin ||
    item.ownerGstin ||
    item.data?.profile?.gstin ||
    item.gstin ||
    ''
  );
}

/**
 * Checks if a record (Bill, Challan, Purchase, Expense) belongs to the selected company.
 * If activeCompany is null, 'all', or { id: 'all' }, returns true (consolidated multi-company mode).
 */
export function matchesCompany(item, activeCompany) {
  if (!activeCompany || activeCompany === 'all' || activeCompany?.id === 'all') return true;
  const targetName = normalizeCompanyName(activeCompany.businessName || activeCompany.name || activeCompany);
  const targetGstin = String(activeCompany.gstin || '').trim().toUpperCase();

  // Check item's company tags
  const itemGstin = String(item.companyGstin || item.ownerGstin || item.data?.profile?.gstin || item.gstin || '').trim().toUpperCase();
  if (targetGstin && itemGstin && targetGstin === itemGstin) return true;

  const itemName = normalizeCompanyName(
    item.companyName || item.ownerName || item.profileBusinessName || item.data?.profile?.businessName || item.businessName || ''
  );
  if (targetName && itemName && targetName === itemName) return true;

  // If item has no explicit company tag and we only have one company or it matches default
  if (!itemGstin && !itemName) return true;

  return false;
}

/**
 * Checks if a record matches both the active company AND the active financial year.
 */
export function matchesCompanyAndYear(item, activeCompany, activeFY) {
  if (!matchesCompany(item, activeCompany)) return false;
  if (!activeFY || activeFY === 'all') return true;

  // 1. Direct explicit financialYear field
  if (item.financialYear && item.financialYear === activeFY) return true;

  // 2. Date fallback
  const dateStr = item.invoiceDate || item.challanDate || item.date || item.createdDate || item.billDate;
  if (dateStr) {
    return isDateInFinancialYear(dateStr, activeFY);
  }

  return true;
}

/**
 * Aggregates all distinct companies discovered across saved profiles and records.
 */
export function extractAllCompanies(profiles = [], records = []) {
  const companies = [];
  const gstinIndex = new Map();
  const nameIndex = new Map();

  function addOrMerge(data, isProfile = false) {
    if (!data) return;
    const name = String(data.businessName || data.name || '').trim();
    if (!name) return;
    const gstin = String(data.gstin || '').trim().toUpperCase();
    const normName = normalizeCompanyName(name);

    let existing = null;
    if (gstin && gstinIndex.has(gstin)) {
      existing = gstinIndex.get(gstin);
    } else if (normName && nameIndex.has(normName)) {
      existing = nameIndex.get(normName);
    }

    if (existing) {
      if (!existing.gstin && gstin) {
        existing.gstin = gstin;
        gstinIndex.set(gstin, existing);
      }
      if (isProfile) {
        existing.id = data.id || existing.id;
        if (data.address) existing.address = data.address;
        if (data.phone) existing.phone = data.phone;
      }
    } else {
      const entry = {
        id: data.id || (isProfile ? `prof_${companies.length + 1}` : `comp_${companies.length + 1}`),
        businessName: name,
        gstin: gstin,
        address: data.address || '',
        phone: data.phone || '',
      };
      companies.push(entry);
      if (gstin) gstinIndex.set(gstin, entry);
      if (normName) nameIndex.set(normName, entry);
    }
  }

  // 1. Add from saved profiles
  (profiles || []).forEach(p => addOrMerge(p, true));

  // 2. Add any other companies found in bills/records
  (records || []).forEach(r => {
    if (!r) return;
    const name = getRecordCompanyName(r, '');
    const gstin = getRecordCompanyGstin(r);
    if (name) {
      addOrMerge({ businessName: name, gstin });
    }
  });

  return companies;
}


