import sqlite3 from 'sqlite3';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
  constructor() {
    this.db = new sqlite3.Database(':memory:');
    this.initTables();
  }

  initTables() {
    this.db.serialize(() => {
      // Quality inspections table
      this.db.run(`CREATE TABLE quality_inspections (
        inspection_id TEXT PRIMARY KEY,
        order_id TEXT,
        inspection_date TEXT,
        parts_inspected INTEGER,
        parts_rejected INTEGER,
        rejection_reason TEXT,
        rework_required TEXT
      )`);

      // RFQ responses table
      this.db.run(`CREATE TABLE rfq_responses (
        rfq_id TEXT,
        supplier_name TEXT,
        part_description TEXT,
        quote_date TEXT,
        quoted_price REAL,
        lead_time_weeks INTEGER,
        notes TEXT
      )`);

      // Supplier orders table
      this.db.run(`CREATE TABLE supplier_orders (
        order_id TEXT,
        supplier_name TEXT,
        part_number TEXT,
        part_description TEXT,
        order_date TEXT,
        promised_date TEXT,
        actual_delivery_date TEXT,
        quantity INTEGER,
        unit_price REAL,
        po_amount REAL
      )`);

      // Suppliers table
      this.db.run(`CREATE TABLE suppliers (
        supplier_id TEXT PRIMARY KEY,
        supplier_name TEXT,
        normalized_name TEXT,
        created_at TEXT
      )`);

      // Supplier notes table - enhanced schema
      this.db.run(`CREATE TABLE supplier_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id TEXT,
        supplier_name TEXT,
        supplier_status TEXT,
        note_type TEXT,
        author TEXT,
        date TEXT,
        content TEXT,
        sentiment TEXT,
        sentiment_score REAL,
        keywords TEXT,
        created_at TEXT,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
      )`);
    });
  }

  async loadData() {
    await this.loadQualityInspections();
    await this.loadRFQResponses();
    await this.loadSupplierOrders();
    await this.loadSupplierNotes();
  }

  loadQualityInspections() {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`INSERT INTO quality_inspections VALUES (?, ?, ?, ?, ?, ?, ?)`);
      
      fs.createReadStream(path.join(__dirname, 'requirements/Solutions Architect sample data/quality_inspections.csv'))
        .pipe(csv())
        .on('data', (row) => {
          stmt.run([
            row.inspection_id,
            row.order_id,
            row.inspection_date,
            parseInt(row.parts_inspected),
            parseInt(row.parts_rejected),
            row.rejection_reason,
            row.rework_required
          ]);
        })
        .on('end', () => {
          stmt.finalize();
          resolve();
        })
        .on('error', reject);
    });
  }

  loadRFQResponses() {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`INSERT INTO rfq_responses VALUES (?, ?, ?, ?, ?, ?, ?)`);
      
      fs.createReadStream(path.join(__dirname, 'requirements/Solutions Architect sample data/rfq_responses.csv'))
        .pipe(csv())
        .on('data', (row) => {
          stmt.run([
            row.rfq_id,
            row.supplier_name,
            row.part_description,
            row.quote_date,
            parseFloat(row.quoted_price),
            parseInt(row.lead_time_weeks),
            row.notes
          ]);
        })
        .on('end', () => {
          stmt.finalize();
          resolve();
        })
        .on('error', reject);
    });
  }

  loadSupplierOrders() {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`INSERT INTO supplier_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      fs.createReadStream(path.join(__dirname, 'requirements/Solutions Architect sample data/supplier_orders.csv'))
        .pipe(csv())
        .on('data', (row) => {
          stmt.run([
            row.order_id,
            row.supplier_name,
            row.part_number,
            row.part_description,
            row.order_date,
            row.promised_date,
            row.actual_delivery_date,
            parseInt(row.quantity),
            parseFloat(row.unit_price),
            parseFloat(row.po_amount)
          ]);
        })
        .on('end', () => {
          stmt.finalize();
          resolve();
        })
        .on('error', reject);
    });
  }

  async loadSupplierNotes() {
    const { default: NotesParser } = await import('./notesParser.js');
    const { default: SupplierManager } = await import('./supplierManager.js');
    const parser = new NotesParser();
    const supplierManager = new SupplierManager();
    
    try {
      const notesFilePath = path.join(__dirname, 'requirements/Solutions Architect sample data/supplier_notes.txt');
      console.log('Loading notes from:', notesFilePath);
      
      if (!fs.existsSync(notesFilePath)) {
        throw new Error(`Notes file not found: ${notesFilePath}`);
      }
      
      const parsedNotes = parser.parseNotesFile(notesFilePath);
      console.log(`Parsed ${parsedNotes.length} notes`);
      
      if (parsedNotes.length === 0) {
        console.warn('No notes were parsed from the file');
        return;
      }
      
      // Process suppliers and create unique IDs
      const supplierStmt = this.db.prepare(`INSERT OR IGNORE INTO suppliers 
        (supplier_id, supplier_name, normalized_name, created_at) 
        VALUES (?, ?, ?, ?)`);
      
      const noteStmt = this.db.prepare(`INSERT INTO supplier_notes 
        (supplier_id, supplier_name, supplier_status, note_type, author, date, content, sentiment, sentiment_score, keywords, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      parsedNotes.forEach((note, index) => {
        try {
          const supplier = supplierManager.findOrCreateSupplier(note.supplier_name || 'Unknown');
          
          // Insert supplier if not exists
          supplierStmt.run([
            supplier.supplier_id,
            supplier.supplier_name,
            supplier.normalized_name,
            supplier.created_at
          ]);
          
          // Insert note with supplier_id
          noteStmt.run([
            supplier.supplier_id,
            note.supplier_name || 'Unknown',
            note.supplier_status || 'STANDARD',
            note.type || 'NOTE',
            note.author || 'Unknown',
            note.date || null,
            note.content || '',
            note.sentiment || 'NEUTRAL',
            note.sentiment_score || 0,
            JSON.stringify(note.keywords || []),
            note.created_at || new Date().toISOString()
          ]);
        } catch (noteError) {
          console.error(`Error inserting note ${index}:`, noteError, note);
        }
      });
      
      supplierStmt.finalize();
      noteStmt.finalize();
      
      const uniqueSuppliers = supplierManager.getAllSuppliers();
      console.log(`Successfully loaded ${parsedNotes.length} notes for ${uniqueSuppliers.length} unique suppliers`);
      uniqueSuppliers.forEach(s => console.log(`  ${s.supplier_id}: ${s.supplier_name} (${s.normalized_name})`));
    } catch (error) {
      console.error('Error loading supplier notes:', error);
      throw error;
    }
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getSupplierMetrics() {
    return new Promise((resolve, reject) => {
      const queries = {
        qualityMetrics: `
          SELECT 
            s.supplier_id,
            s.supplier_name,
            COUNT(qi.inspection_id) as total_inspections,
            SUM(qi.parts_inspected) as total_parts,
            SUM(qi.parts_rejected) as total_rejected,
            ROUND(AVG(CAST(qi.parts_rejected AS FLOAT) / qi.parts_inspected * 100), 2) as rejection_rate,
            SUM(CASE WHEN qi.rework_required = 'Yes' THEN 1 ELSE 0 END) as rework_count
          FROM suppliers s
          LEFT JOIN supplier_orders so ON s.supplier_name = so.supplier_name OR s.normalized_name = LOWER(REPLACE(REPLACE(so.supplier_name, ' Inc', ''), ' LLC', ''))
          LEFT JOIN quality_inspections qi ON so.order_id = qi.order_id
          GROUP BY s.supplier_id, s.supplier_name
        `,
        deliveryMetrics: `
          SELECT 
            s.supplier_id,
            s.supplier_name,
            COUNT(so.order_id) as total_orders,
            SUM(CASE WHEN so.actual_delivery_date <= so.promised_date THEN 1 ELSE 0 END) as on_time_deliveries,
            ROUND(AVG(julianday(so.actual_delivery_date) - julianday(so.promised_date)), 1) as avg_delay_days,
            SUM(so.po_amount) as total_value
          FROM suppliers s
          LEFT JOIN supplier_orders so ON s.supplier_name = so.supplier_name OR s.normalized_name = LOWER(REPLACE(REPLACE(so.supplier_name, ' Inc', ''), ' LLC', ''))
          WHERE so.actual_delivery_date IS NOT NULL
          GROUP BY s.supplier_id, s.supplier_name
        `,
        pricingMetrics: `
          SELECT 
            s.supplier_id,
            s.supplier_name,
            COUNT(rfq.rfq_id) as quote_count,
            AVG(rfq.quoted_price) as avg_price,
            AVG(rfq.lead_time_weeks) as avg_lead_time,
            MIN(rfq.quoted_price) as min_price,
            MAX(rfq.quoted_price) as max_price
          FROM suppliers s
          LEFT JOIN rfq_responses rfq ON s.supplier_name = rfq.supplier_name OR s.normalized_name = LOWER(REPLACE(REPLACE(rfq.supplier_name, ' Inc', ''), ' LLC', ''))
          GROUP BY s.supplier_id, s.supplier_name
        `
      };

      Promise.all([
        this.query(queries.qualityMetrics),
        this.query(queries.deliveryMetrics),
        this.query(queries.pricingMetrics)
      ]).then(([quality, delivery, pricing]) => {
        resolve({ quality, delivery, pricing });
      }).catch(reject);
    });
  }
}

export default Database;