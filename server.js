const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('./database');
const SupplierChatbot = require('./chatbot');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API logging middleware
app.use('/api', (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database and chatbot
let db, chatbot;

async function initializeApp() {
  try {
    console.log('Initializing database...');
    db = new Database();
    await db.loadData();
    
    console.log('Initializing chatbot...');
    chatbot = new SupplierChatbot(db);
    await chatbot.initialize();
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// API Routes

// Get supplier dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const metrics = await db.getSupplierMetrics();
    const supplierNotes = await db.query('SELECT * FROM supplier_notes');
    
    // Calculate summary statistics
    const summary = {
      totalSuppliers: metrics.delivery.length,
      totalOrders: metrics.delivery.reduce((sum, s) => sum + s.total_orders, 0),
      totalValue: metrics.delivery.reduce((sum, s) => sum + s.total_value, 0),
      avgOnTimeRate: metrics.delivery.reduce((sum, s) => sum + (s.on_time_deliveries / s.total_orders), 0) / metrics.delivery.length * 100
    };

    res.json({
      summary,
      metrics,
      notes: supplierNotes
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get supplier list
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await db.query(`
      SELECT DISTINCT supplier_name 
      FROM supplier_orders 
      ORDER BY supplier_name
    `);
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Get supplier details
app.get('/api/suppliers/:name', async (req, res) => {
  try {
    const supplierName = req.params.name;
    
    const [orders, quality, rfqs, notes] = await Promise.all([
      db.query(`
        SELECT COUNT(*) as total_orders, 
               SUM(po_amount) as total_value,
               SUM(CASE WHEN actual_delivery_date <= promised_date THEN 1 ELSE 0 END) as on_time_deliveries,
               AVG(julianday(actual_delivery_date) - julianday(promised_date)) as avg_delay_days
        FROM supplier_orders 
        WHERE supplier_name = ? AND actual_delivery_date IS NOT NULL
      `, [supplierName]),
      
      db.query(`
        SELECT COUNT(*) as total_inspections,
               SUM(parts_inspected) as total_parts,
               SUM(parts_rejected) as total_rejected,
               AVG(CAST(parts_rejected AS FLOAT) / parts_inspected * 100) as rejection_rate
        FROM quality_inspections qi
        JOIN supplier_orders so ON qi.order_id = so.order_id
        WHERE so.supplier_name = ?
      `, [supplierName]),
      
      db.query(`
        SELECT COUNT(*) as total_quotes,
               AVG(quoted_price) as avg_price,
               MIN(quoted_price) as min_price,
               MAX(quoted_price) as max_price,
               AVG(lead_time_weeks) as avg_lead_time
        FROM rfq_responses 
        WHERE supplier_name = ?
      `, [supplierName]),
      
      db.query('SELECT * FROM supplier_notes WHERE supplier_name = ?', [supplierName])
    ]);

    res.json({
      supplier: supplierName,
      orders: orders[0],
      quality: quality[0],
      rfqs: rfqs[0],
      notes: notes
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supplier details' });
  }
});

// Chatbot endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await chatbot.processQuery(message);
    res.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Quality trends endpoint
app.get('/api/quality-trends', async (req, res) => {
  try {
    const trends = await db.query(`
      SELECT 
        so.supplier_name,
        substr(qi.inspection_date, 1, 7) as month,
        AVG(CAST(qi.parts_rejected AS FLOAT) / qi.parts_inspected * 100) as rejection_rate
      FROM supplier_orders so
      JOIN quality_inspections qi ON so.order_id = qi.order_id
      WHERE qi.inspection_date IS NOT NULL
      GROUP BY so.supplier_name, substr(qi.inspection_date, 1, 7)
      ORDER BY month, so.supplier_name
    `);
    
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quality trends' });
  }
});

// Delivery performance endpoint
app.get('/api/delivery-performance', async (req, res) => {
  try {
    const performance = await db.query(`
      SELECT 
        supplier_name,
        substr(order_date, 1, 7) as month,
        COUNT(*) as total_orders,
        SUM(CASE WHEN actual_delivery_date <= promised_date THEN 1 ELSE 0 END) as on_time_orders,
        AVG(julianday(actual_delivery_date) - julianday(promised_date)) as avg_delay
      FROM supplier_orders
      WHERE actual_delivery_date IS NOT NULL
      GROUP BY supplier_name, substr(order_date, 1, 7)
      ORDER BY month, supplier_name
    `);
    
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch delivery performance' });
  }
});

// Get supplier notes with sentiment analysis
app.get('/api/supplier-notes/:supplier?', async (req, res) => {
  try {
    const supplierName = req.params.supplier;
    let query = `
      SELECT sn.*, s.supplier_id, s.normalized_name 
      FROM supplier_notes sn 
      LEFT JOIN suppliers s ON sn.supplier_id = s.supplier_id
    `;
    let params = [];
    
    if (supplierName) {
      query += ' WHERE sn.supplier_name = ?';
      params = [supplierName];
    }
    
    query += ' ORDER BY sn.date DESC';
    
    const notes = await db.query(query, params);
    
    // Parse keywords back to array
    const processedNotes = notes.map(note => ({
      ...note,
      keywords: note.keywords ? JSON.parse(note.keywords) : []
    }));
    
    res.json(processedNotes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supplier notes' });
  }
});

// Get suppliers with deduplication info
app.get('/api/suppliers-detailed', async (req, res) => {
  try {
    const suppliers = await db.query(`
      SELECT 
        s.*,
        COUNT(sn.id) as note_count,
        COUNT(DISTINCT so.order_id) as order_count
      FROM suppliers s
      LEFT JOIN supplier_notes sn ON s.supplier_id = sn.supplier_id
      LEFT JOIN supplier_orders so ON s.supplier_name = so.supplier_name OR s.normalized_name = LOWER(REPLACE(REPLACE(so.supplier_name, ' Inc', ''), ' LLC', ''))
      GROUP BY s.supplier_id
      ORDER BY s.supplier_name
    `);
    
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch detailed suppliers' });
  }
});

// Get supplier drill-down data
app.get('/api/supplier-drilldown/:supplierId', async (req, res) => {
  try {
    const { supplierId } = req.params;
    
    const [supplier, sentimentTrend, deliveryTrend, qualityTrend, notes] = await Promise.all([
      db.query('SELECT * FROM suppliers WHERE supplier_id = ?', [supplierId]),
      db.query(`
        SELECT 
          DATE(sn.date) as date,
          AVG(sn.sentiment_score) as avg_sentiment,
          COUNT(*) as note_count
        FROM supplier_notes sn
        WHERE sn.supplier_id = ? AND sn.date IS NOT NULL
        GROUP BY DATE(sn.date)
        ORDER BY date
      `, [supplierId]),
      db.query(`
        SELECT 
          substr(so.order_date, 1, 7) as month,
          COUNT(*) as total_orders,
          SUM(CASE WHEN so.actual_delivery_date <= so.promised_date THEN 1 ELSE 0 END) as on_time_orders,
          ROUND(AVG(julianday(so.actual_delivery_date) - julianday(so.promised_date)), 1) as avg_delay
        FROM suppliers s
        JOIN supplier_orders so ON s.supplier_name = so.supplier_name OR s.normalized_name = LOWER(REPLACE(REPLACE(so.supplier_name, ' Inc', ''), ' LLC', ''))
        WHERE s.supplier_id = ? AND so.actual_delivery_date IS NOT NULL
        GROUP BY substr(so.order_date, 1, 7)
        ORDER BY month
      `, [supplierId]),
      db.query(`
        SELECT 
          substr(qi.inspection_date, 1, 7) as month,
          AVG(CAST(qi.parts_rejected AS FLOAT) / qi.parts_inspected * 100) as rejection_rate,
          COUNT(*) as inspection_count
        FROM suppliers s
        JOIN supplier_orders so ON s.supplier_name = so.supplier_name OR s.normalized_name = LOWER(REPLACE(REPLACE(so.supplier_name, ' Inc', ''), ' LLC', ''))
        JOIN quality_inspections qi ON so.order_id = qi.order_id
        WHERE s.supplier_id = ? AND qi.inspection_date IS NOT NULL
        GROUP BY substr(qi.inspection_date, 1, 7)
        ORDER BY month
      `, [supplierId]),
      db.query('SELECT * FROM supplier_notes WHERE supplier_id = ? ORDER BY date DESC LIMIT 10', [supplierId])
    ]);
    
    res.json({
      supplier: supplier[0],
      sentimentTrend,
      deliveryTrend,
      qualityTrend,
      recentNotes: notes.map(note => ({
        ...note,
        keywords: note.keywords ? JSON.parse(note.keywords) : []
      }))
    });
  } catch (error) {
    console.error('Supplier drilldown error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier drilldown data' });
  }
});

// Get sentiment analysis summary
app.get('/api/sentiment-analysis', async (req, res) => {
  try {
    const sentimentSummary = await db.query(`
      SELECT 
        supplier_name,
        COUNT(*) as total_notes,
        SUM(CASE WHEN sentiment = 'POSITIVE' THEN 1 ELSE 0 END) as positive_notes,
        SUM(CASE WHEN sentiment = 'NEGATIVE' THEN 1 ELSE 0 END) as negative_notes,
        SUM(CASE WHEN sentiment = 'NEUTRAL' THEN 1 ELSE 0 END) as neutral_notes,
        ROUND(AVG(sentiment_score), 2) as avg_sentiment_score
      FROM supplier_notes
      GROUP BY supplier_name
      ORDER BY avg_sentiment_score DESC
    `);
    
    res.json(sentimentSummary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sentiment analysis' });
  }
});

// Test notes parser
app.get('/api/test-parser', (req, res) => {
  try {
    const NotesParser = require('./notesParser');
    const parser = new NotesParser();
    const notesFilePath = path.join(__dirname, 'requirements/Solutions Architect sample data/supplier_notes.txt');
    
    if (!fs.existsSync(notesFilePath)) {
      return res.status(404).json({ error: 'Notes file not found' });
    }
    
    const parsedNotes = parser.parseNotesFile(notesFilePath);
    res.json({ 
      message: 'Parser test successful',
      notesCount: parsedNotes.length,
      sampleNote: parsedNotes[0] || null
    });
  } catch (error) {
    console.error('Test parser error:', error);
    res.status(500).json({ error: `Parser test failed: ${error.message}` });
  }
});

// Parse and reload supplier notes
app.post('/api/parse-notes', async (req, res) => {
  try {
    console.log('Starting notes parsing...');
    
    // Clear existing notes
    await db.query('DELETE FROM supplier_notes');
    console.log('Cleared existing notes');
    
    // Reload with parsed data
    await db.loadSupplierNotes();
    console.log('Loaded new parsed notes');
    
    res.json({ message: 'Supplier notes parsed and reloaded successfully' });
  } catch (error) {
    console.error('Parse notes error:', error);
    res.status(500).json({ error: `Failed to parse supplier notes: ${error.message}` });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve supplier detail page
app.get('/supplier-detail.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'supplier-detail.html'));
});

// Start server
initializeApp().then(() => {
  app.listen(PORT, () => {
    console.log(`Supplier Dashboard running on http://localhost:${PORT}`);
  });
});

module.exports = app;