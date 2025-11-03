let supplierData = null;
let charts = {};

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const supplierId = urlParams.get('id');
    
    if (!supplierId) {
        alert('No supplier ID provided');
        window.location.href = '/';
        return;
    }
    
    await loadSupplierData(supplierId);
});

async function loadSupplierData(supplierId) {
    try {
        const response = await fetch(`/api/supplier-drilldown/${supplierId}`);
        supplierData = await response.json();
        
        if (!response.ok) {
            throw new Error(supplierData.error || 'Failed to load supplier data');
        }
        
        renderSupplierData();
        renderCharts();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading supplier data:', error);
        document.getElementById('loading').innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> 
            Error loading supplier data: ${error.message}
        `;
    }
}

function renderSupplierData() {
    const { supplier, deliveryTrend, qualityTrend, recentNotes } = supplierData;
    
    document.getElementById('supplierName').textContent = supplier.supplier_name;
    document.getElementById('supplierTitle').textContent = `${supplier.supplier_name} (ID: ${supplier.supplier_id})`;
    
    // Calculate metrics
    const totalOrders = deliveryTrend.reduce((sum, d) => sum + d.total_orders, 0);
    const totalOnTime = deliveryTrend.reduce((sum, d) => sum + d.on_time_orders, 0);
    const onTimeRate = totalOrders > 0 ? ((totalOnTime / totalOrders) * 100).toFixed(1) : 0;
    
    const avgRejectionRate = qualityTrend.length > 0 
        ? (qualityTrend.reduce((sum, q) => sum + (q.rejection_rate || 0), 0) / qualityTrend.length).toFixed(1)
        : 0;
    
    const avgSentiment = supplierData.sentimentTrend.length > 0
        ? (supplierData.sentimentTrend.reduce((sum, s) => sum + s.avg_sentiment, 0) / supplierData.sentimentTrend.length).toFixed(2)
        : 0;
    
    document.getElementById('metricsGrid').innerHTML = `
        <div class="metric-card">
            <div class="metric-value">${onTimeRate}%</div>
            <div class="metric-label">On-Time Rate</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${(100 - avgRejectionRate).toFixed(1)}%</div>
            <div class="metric-label">Quality Rate</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${avgSentiment}</div>
            <div class="metric-label">Avg Sentiment</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${totalOrders}</div>
            <div class="metric-label">Total Orders</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${recentNotes.length}</div>
            <div class="metric-label">Recent Notes</div>
        </div>
    `;
    
    // Render recent notes
    const notesContainer = document.getElementById('recentNotes');
    if (recentNotes.length === 0) {
        notesContainer.innerHTML = '<p>No recent notes available</p>';
    } else {
        notesContainer.innerHTML = recentNotes.map(note => `
            <div class="note-item">
                <div class="note-header">
                    <div>
                        <span class="note-type">${note.note_type}</span>
                        <strong>${note.author}</strong>
                        <span class="sentiment-badge sentiment-${note.sentiment.toLowerCase()}">
                            ${note.sentiment} (${note.sentiment_score.toFixed(2)})
                        </span>
                    </div>
                    <div style="font-size: 0.875rem; color: #666;">
                        ${note.date || 'No date'}
                    </div>
                </div>
                <div style="margin-top: 0.5rem;">
                    ${note.content}
                </div>
            </div>
        `).join('');
    }
}

function renderCharts() {
    renderSentimentChart();
    renderDeliveryChart();
    renderQualityChart();
    renderProductCharts();
}

function renderSentimentChart() {
    const ctx = document.getElementById('sentimentChart').getContext('2d');
    const { sentimentTrend } = supplierData;
    
    charts.sentiment = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sentimentTrend.map(s => s.date),
            datasets: [{
                label: 'Average Sentiment Score',
                data: sentimentTrend.map(s => s.avg_sentiment),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    min: -1,
                    max: 1,
                    title: {
                        display: true,
                        text: 'Sentiment Score'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Sentiment Trend Over Time'
                }
            }
        }
    });
}

function renderDeliveryChart() {
    const ctx = document.getElementById('deliveryChart').getContext('2d');
    const { deliveryTrend } = supplierData;
    
    charts.delivery = new Chart(ctx, {
        type: 'line',
        data: {
            labels: deliveryTrend.map(d => d.month),
            datasets: [{
                label: 'On-Time Rate (%)',
                data: deliveryTrend.map(d => d.total_orders > 0 ? (d.on_time_orders / d.total_orders) * 100 : 0),
                borderColor: '#48bb78',
                backgroundColor: 'rgba(72, 187, 120, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'On-Time Rate (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Delivery Performance Over Time'
                }
            }
        }
    });
}

function renderQualityChart() {
    const ctx = document.getElementById('qualityChart').getContext('2d');
    const { qualityTrend } = supplierData;
    
    charts.quality = new Chart(ctx, {
        type: 'line',
        data: {
            labels: qualityTrend.map(q => q.month),
            datasets: [{
                label: 'Quality Rate (%)',
                data: qualityTrend.map(q => 100 - (q.rejection_rate || 0)),
                borderColor: '#ed8936',
                backgroundColor: 'rgba(237, 137, 54, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Quality Rate (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Quality Performance Over Time'
                }
            }
        }
    });
}