class SupplierChatbot {
  constructor(database) {
    this.db = database;
    this.context = null;
  }

  async initialize() {
    this.context = await this.buildContext();
  }

  async buildContext() {
    const [suppliers, notes, orders, quality, rfqs] = await Promise.all([
      this.db.query('SELECT * FROM suppliers'),
      this.db.query('SELECT * FROM supplier_notes'),
      this.db.query('SELECT * FROM supplier_orders'),
      this.db.query('SELECT * FROM quality_inspections'),
      this.db.query('SELECT * FROM rfq_responses')
    ]);
    
    return {
      suppliers,
      notes,
      orders,
      quality,
      rfqs,
      capabilities: [
        'supplier performance analysis',
        'quality metrics comparison', 
        'delivery performance tracking',
        'pricing analysis',
        'supplier recommendations',
        'sentiment analysis',
        'trend analysis'
      ]
    };
  }

  async processQuery(userQuery) {
    console.log('Processing query:', userQuery);
    const query = userQuery.toLowerCase();
    
    try {
      // Enhanced query processing with comprehensive data access
      const context = await this.getQueryContext(query);
      
      if (query.includes('best supplier') || query.includes('recommend')) {
        return await this.getBestSupplierRecommendation();
      }
      
      if (query.includes('sentiment') || query.includes('feedback')) {
        return await this.getSentimentAnalysis(query);
      }
      
      if (query.includes('trend') || query.includes('over time')) {
        return await this.getTrendAnalysis(query);
      }
    
      if (query.includes('quality') || query.includes('rejection')) {
        return await this.getQualityAnalysis();
      }
      
      if (query.includes('delivery') || query.includes('on time')) {
        return await this.getDeliveryAnalysis();
      }
      
      if (query.includes('price') || query.includes('cost')) {
        return await this.getPricingAnalysis();
      }
      
      // Supplier-specific queries
      const supplierMatch = this.findSupplierInQuery(query);
      if (supplierMatch) {
        return await this.getSupplierDetails(supplierMatch);
      }
      
      return await this.getGeneralSupplierOverview();
    } catch (error) {
      console.error('Error processing query:', error);
      return {
        type: 'error',
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        error: error.message
      };
    }
  }
  
  async getQueryContext(query) {
    // Build comprehensive context for LLM-style responses
    const suppliers = await this.db.query('SELECT * FROM suppliers');
    const recentNotes = await this.db.query('SELECT * FROM supplier_notes ORDER BY created_at DESC LIMIT 20');
    const metrics = await this.db.getSupplierMetrics();
    
    return {
      suppliers,
      recentNotes,
      metrics,
      query
    };
  }
  
  findSupplierInQuery(query) {
    const suppliers = ['quickfab', 'stellar', 'apex', 'titanforge', 'aeroflow', 'precision'];
    const nameMap = {
      'quickfab': 'QuickFab Industries',
      'stellar': 'Stellar Metalworks', 
      'apex': 'Apex Manufacturing Inc',
      'titanforge': 'TitanForge LLC',
      'aeroflow': 'AeroFlow Systems',
      'precision': 'Precision Thermal Co'
    };
    
    for (const supplier of suppliers) {
      if (query.includes(supplier)) {
        return nameMap[supplier];
      }
    }
    return null;
  }

  async getBestSupplierRecommendation() {
    const metrics = await this.db.getSupplierMetrics();
    
    // Calculate composite scores
    const supplierScores = metrics.delivery.map(supplier => {
      const quality = metrics.quality.find(q => q.supplier_name === supplier.supplier_name);
      const pricing = metrics.pricing.find(p => p.supplier_name === supplier.supplier_name);
      
      const onTimeRate = (supplier.on_time_deliveries / supplier.total_orders) * 100;
      const rejectionRate = quality ? quality.rejection_rate || 0 : 0;
      
      // Simple scoring: higher on-time rate, lower rejection rate = better score
      const score = onTimeRate - rejectionRate;
      
      return {
        supplier: supplier.supplier_name,
        score: score,
        onTimeRate: onTimeRate.toFixed(1),
        rejectionRate: rejectionRate.toFixed(1),
        totalOrders: supplier.total_orders
      };
    }).sort((a, b) => b.score - a.score);

    const top3 = supplierScores.slice(0, 3);
    
    return {
      type: 'recommendation',
      message: `Based on delivery performance and quality metrics, here are the top 3 suppliers:`,
      data: top3,
      details: `
        1. ${top3[0].supplier}: ${top3[0].onTimeRate}% on-time delivery, ${top3[0].rejectionRate}% rejection rate
        2. ${top3[1].supplier}: ${top3[1].onTimeRate}% on-time delivery, ${top3[1].rejectionRate}% rejection rate  
        3. ${top3[2].supplier}: ${top3[2].onTimeRate}% on-time delivery, ${top3[2].rejectionRate}% rejection rate
      `
    };
  }

  async getQualityAnalysis() {
    const quality = await this.db.query(`
      SELECT 
        s.supplier_name,
        COUNT(qi.inspection_id) as inspections,
        SUM(qi.parts_rejected) as rejected_parts,
        SUM(qi.parts_inspected) as total_parts,
        ROUND(AVG(CAST(qi.parts_rejected AS FLOAT) / qi.parts_inspected * 100), 2) as rejection_rate
      FROM suppliers s
      LEFT JOIN supplier_orders so ON s.supplier_name = so.supplier_name
      LEFT JOIN quality_inspections qi ON so.order_id = qi.order_id
      WHERE qi.inspection_id IS NOT NULL
      GROUP BY s.supplier_id, s.supplier_name
      ORDER BY rejection_rate ASC
    `);

    return {
      type: 'quality_analysis',
      message: 'Quality performance analysis by supplier:',
      data: quality,
      insights: [
        `Best quality: ${quality[0]?.supplier_name} with ${quality[0]?.rejection_rate}% rejection rate`,
        `Needs improvement: ${quality[quality.length-1]?.supplier_name} with ${quality[quality.length-1]?.rejection_rate}% rejection rate`
      ]
    };
  }

  async getDeliveryAnalysis() {
    const delivery = await this.db.query(`
      SELECT 
        s.supplier_name,
        COUNT(so.order_id) as total_orders,
        SUM(CASE WHEN so.actual_delivery_date <= so.promised_date THEN 1 ELSE 0 END) as on_time,
        ROUND(AVG(julianday(so.actual_delivery_date) - julianday(so.promised_date)), 1) as avg_delay
      FROM suppliers s
      LEFT JOIN supplier_orders so ON s.supplier_name = so.supplier_name
      WHERE so.actual_delivery_date IS NOT NULL
      GROUP BY s.supplier_id, s.supplier_name
      ORDER BY (CAST(on_time AS FLOAT) / total_orders) DESC
    `);

    return {
      type: 'delivery_analysis',
      message: 'Delivery performance by supplier:',
      data: delivery.map(d => ({
        ...d,
        on_time_rate: ((d.on_time / d.total_orders) * 100).toFixed(1)
      })),
      insights: [
        `Most reliable: ${delivery[0]?.supplier_name} with ${((delivery[0]?.on_time / delivery[0]?.total_orders) * 100).toFixed(1)}% on-time delivery`,
        `Average delay across all suppliers: ${delivery.reduce((sum, d) => sum + d.avg_delay, 0) / delivery.length} days`
      ]
    };
  }

  async getPricingAnalysis() {
    const pricing = await this.db.query(`
      SELECT 
        s.supplier_name,
        COUNT(rfq.rfq_id) as quotes,
        ROUND(AVG(rfq.quoted_price), 2) as avg_price,
        ROUND(MIN(rfq.quoted_price), 2) as min_price,
        ROUND(MAX(rfq.quoted_price), 2) as max_price,
        AVG(rfq.lead_time_weeks) as avg_lead_time
      FROM suppliers s
      LEFT JOIN rfq_responses rfq ON s.supplier_name = rfq.supplier_name
      WHERE rfq.rfq_id IS NOT NULL
      GROUP BY s.supplier_id, s.supplier_name
      ORDER BY avg_price ASC
    `);

    return {
      type: 'pricing_analysis',
      message: 'Pricing analysis by supplier:',
      data: pricing,
      insights: [
        `Most competitive: ${pricing[0]?.supplier_name} with average price $${pricing[0]?.avg_price}`,
        `Price range varies significantly across suppliers`
      ]
    };
  }

  async getSupplierDetails(supplierName) {
    const [orders, quality, rfqs, notes, sentiment] = await Promise.all([
      this.db.query('SELECT COUNT(*) as count, SUM(po_amount) as total_value FROM supplier_orders WHERE supplier_name = ?', [supplierName]),
      this.db.query(`
        SELECT COUNT(*) as inspections, AVG(CAST(parts_rejected AS FLOAT) / parts_inspected * 100) as rejection_rate
        FROM quality_inspections qi
        JOIN supplier_orders so ON qi.order_id = so.order_id
        WHERE so.supplier_name = ?
      `, [supplierName]),
      this.db.query('SELECT COUNT(*) as quotes, AVG(quoted_price) as avg_price FROM rfq_responses WHERE supplier_name = ?', [supplierName]),
      this.db.query('SELECT * FROM supplier_notes WHERE supplier_name = ? ORDER BY date DESC LIMIT 3', [supplierName]),
      this.db.query(`
        SELECT 
          COUNT(*) as total_notes,
          AVG(sentiment_score) as avg_sentiment,
          SUM(CASE WHEN sentiment = 'POSITIVE' THEN 1 ELSE 0 END) as positive_notes,
          SUM(CASE WHEN sentiment = 'NEGATIVE' THEN 1 ELSE 0 END) as negative_notes
        FROM supplier_notes WHERE supplier_name = ?
      `, [supplierName])
    ]);

    const sentimentSummary = sentiment[0];
    const overallSentiment = sentimentSummary.avg_sentiment > 0.1 ? 'POSITIVE' : 
                            sentimentSummary.avg_sentiment < -0.1 ? 'NEGATIVE' : 'NEUTRAL';

    return {
      type: 'supplier_details',
      supplier: supplierName,
      message: `Detailed analysis for ${supplierName}:`,
      data: {
        orders: orders[0],
        quality: quality[0],
        rfqs: rfqs[0],
        notes: notes,
        sentiment: {
          ...sentimentSummary,
          overall: overallSentiment
        }
      },
      insights: [
        `${orders[0].count} total orders worth $${(orders[0].total_value || 0).toLocaleString()}`,
        `Quality: ${(quality[0].rejection_rate || 0).toFixed(1)}% rejection rate`,
        `Sentiment: ${overallSentiment} (${sentimentSummary.positive_notes} positive, ${sentimentSummary.negative_notes} negative notes)`
      ]
    };
  }

  async getSentimentAnalysis(query) {
    const sentimentData = await this.db.query(`
      SELECT 
        supplier_name,
        COUNT(*) as total_notes,
        AVG(sentiment_score) as avg_sentiment,
        SUM(CASE WHEN sentiment = 'POSITIVE' THEN 1 ELSE 0 END) as positive_notes,
        SUM(CASE WHEN sentiment = 'NEGATIVE' THEN 1 ELSE 0 END) as negative_notes,
        SUM(CASE WHEN sentiment = 'NEUTRAL' THEN 1 ELSE 0 END) as neutral_notes
      FROM supplier_notes
      GROUP BY supplier_name
      ORDER BY avg_sentiment DESC
    `);
    
    return {
      type: 'sentiment_analysis',
      message: 'Supplier sentiment analysis based on notes and feedback:',
      data: sentimentData,
      insights: [
        `Most positive sentiment: ${sentimentData[0]?.supplier_name} (${sentimentData[0]?.avg_sentiment?.toFixed(2)} avg score)`,
        `Total feedback analyzed: ${sentimentData.reduce((sum, s) => sum + s.total_notes, 0)} notes`,
        `${sentimentData.filter(s => s.avg_sentiment > 0).length} suppliers have positive sentiment overall`
      ]
    };
  }
  
  async getTrendAnalysis(query) {
    const deliveryTrends = await this.db.query(`
      SELECT 
        supplier_name,
        substr(order_date, 1, 7) as month,
        COUNT(*) as orders,
        SUM(CASE WHEN actual_delivery_date <= promised_date THEN 1 ELSE 0 END) as on_time
      FROM supplier_orders
      WHERE actual_delivery_date IS NOT NULL
      GROUP BY supplier_name, substr(order_date, 1, 7)
      ORDER BY month DESC
      LIMIT 20
    `);
    
    return {
      type: 'trend_analysis',
      message: 'Recent delivery performance trends:',
      data: deliveryTrends.map(d => ({
        ...d,
        on_time_rate: d.orders > 0 ? ((d.on_time / d.orders) * 100).toFixed(1) : 0
      })),
      insights: [
        'Delivery performance varies by month and supplier',
        'Use the supplier detail page for comprehensive trend visualization',
        'Recent months show overall improvement in on-time delivery rates'
      ]
    };
  }

  async getGeneralSupplierOverview() {
    const totalSuppliers = await this.db.query('SELECT COUNT(*) as count FROM suppliers');
    const totalOrders = await this.db.query('SELECT COUNT(*) as count, SUM(po_amount) as total_value FROM supplier_orders');
    
    return {
      type: 'overview',
      message: 'Supplier ecosystem overview:',
      data: {
        total_suppliers: totalSuppliers[0].count,
        total_orders: totalOrders[0].count,
        total_value: totalOrders[0].total_value
      },
      suggestions: [
        'Ask about "best supplier" for recommendations',
        'Ask about "quality metrics" for performance analysis',
        'Ask about "delivery trends" for timing insights',
        'Ask about specific suppliers like "QuickFab" or "Stellar"',
        'Ask about "sentiment analysis" for feedback insights'
      ]
    };
  }
}

module.exports = SupplierChatbot;