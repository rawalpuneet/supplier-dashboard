import crypto from 'crypto';

class SupplierManager {
  constructor() {
    this.suppliers = new Map(); // supplier_id -> supplier data
    this.nameIndex = new Map(); // normalized name -> supplier_id
  }

  normalizeSupplierName(name) {
    let normalized = name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\b(inc|llc|corp|corporation|company|co|ltd|limited)\b/g, '') // Remove legal suffixes
      .replace(/\bmfg\b/g, 'manufacturing') // Normalize mfg to manufacturing
      .replace(/\bmanufacturing\b/g, 'mfg') // Standardize to mfg for consistency
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // Special cases for known suppliers
    if (normalized.includes('apex')) {
      return 'apex';
    }
    
    return normalized;
  }

  generateSupplierId(name) {
    const normalized = this.normalizeSupplierName(name);
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 8);
  }

  findOrCreateSupplier(supplierName) {
    const normalized = this.normalizeSupplierName(supplierName);
    
    // Check if supplier already exists
    if (this.nameIndex.has(normalized)) {
      const existingSupplierId = this.nameIndex.get(normalized);
      return this.suppliers.get(existingSupplierId);
    }

    // Create new supplier
    const supplierId = this.generateSupplierId(supplierName);
    const supplier = {
      supplier_id: supplierId,
      supplier_name: supplierName,
      normalized_name: normalized,
      created_at: new Date().toISOString()
    };

    this.suppliers.set(supplierId, supplier);
    this.nameIndex.set(normalized, supplierId);
    
    return supplier;
  }

  getAllSuppliers() {
    return Array.from(this.suppliers.values());
  }

  getSupplierById(supplierId) {
    return this.suppliers.get(supplierId);
  }
}

export default SupplierManager;