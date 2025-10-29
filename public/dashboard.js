// Dashboard JavaScript
let dashboardData = null;
let charts = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await loadDashboardData();
    renderSummaryCards();
    renderSupplierTable();
    renderCharts();
    await loadSupplierNotes();
    await loadSentimentData();
});

// Load dashboard data from API
async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard');
        dashboardData = await response.json();
        console.log('Dashboard data loaded:', dashboardData);
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// Render summary cards
function renderSummaryCards() {
    const container = document.getElementById('summaryCards');
    
    if (!dashboardData || !dashboardData.summary) {
        container.innerHTML = '<div class="card">Loading...</div>';
        return;
    }
    
    const { summary } = dashboardData;
    
    container.innerHTML = `
        <div class="card summary-card">
            <h3>${summary.totalSuppliers || 0}</h3>
            <p>Active Suppliers</p>
        </div>
        <div class="card summary-card">
            <h3>${summary.totalOrders || 0}</h3>
            <p>Total Orders</p>
        </div>
        <div class="card summary-card">
            <h3>$${((summary.totalValue || 0) / 1000000).toFixed(1)}M</h3>
            <p>Total Value</p>
        </div>
        <div class="card summary-card">
            <h3>${(summary.avgOnTimeRate || 0).toFixed(1)}%</h3>
            <p>Avg On-Time Rate</p>
        </div>
    `;
}

// Render supplier table
function renderSupplierTable() {
    const container = document.getElementById('supplierTable');
    
    if (!dashboardData || !dashboardData.metrics) {
        container.innerHTML = '<div>Loading supplier data...</div>';
        return;
    }
    
    const { metrics, notes } = dashboardData;
    
    if (!metrics.delivery || metrics.delivery.length === 0) {
        container.innerHTML = '<div>No supplier data available</div>';
        return;
    }
    
    // Combine metrics data
    const suppliers = metrics.delivery.map(supplier => {
        const quality = metrics.quality.find(q => q.supplier_name === supplier.supplier_name);
        const pricing = metrics.pricing.find(p => p.supplier_name === supplier.supplier_name);
        const note = notes.find(n => n.supplier_name === supplier.supplier_name);
        
        return {
            id: supplier.supplier_id,
            name: supplier.supplier_name,
            onTimeRate: ((supplier.on_time_deliveries / supplier.total_orders) * 100).toFixed(1),
            rejectionRate: quality ? (quality.rejection_rate || 0).toFixed(1) : '0.0',
            avgPrice: pricing ? pricing.avg_price.toFixed(0) : 'N/A',
            totalOrders: supplier.total_orders,
            status: note ? note.note_type : 'STANDARD',
            avgDelay: supplier.avg_delay_days.toFixed(1)
        };
    });
    
    const getStatusClass = (status) => {
        const statusMap = {
            'GOLD STANDARD': 'status-gold',
            'CAUTION': 'status-caution',
            'RELIABLE': 'status-reliable',
            'SPECIALIST': 'status-specialist',
            'NICHE SPECIALIST': 'status-specialist',
            'ELECTRONICS EXPERT': 'status-specialist'
        };
        return statusMap[status] || 'status-reliable';
    };
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Supplier</th>
                    <th>On-Time Rate</th>
                    <th>Quality Rate</th>
                    <th>Avg Price</th>
                    <th>Orders</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${suppliers.map(supplier => `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <a href="/supplier-detail.html?id=${supplier.id}" 
                                   style="color: #667eea; text-decoration: none; font-weight: bold;"
                                   onmouseover="this.style.textDecoration='underline'"
                                   onmouseout="this.style.textDecoration='none'">
                                    ${supplier.name}
                                </a>
                                <i class="fas fa-comments" 
                                   style="color: #667eea; cursor: pointer; font-size: 0.875rem;"
                                   onclick="startSupplierChat('${supplier.name}')"
                                   title="Chat about ${supplier.name}"></i>
                            </div>
                        </td>
                        <td>${supplier.onTimeRate}%</td>
                        <td>${(100 - parseFloat(supplier.rejectionRate)).toFixed(1)}%</td>
                        <td>$${supplier.avgPrice}</td>
                        <td>${supplier.totalOrders}</td>
                        <td><span class="status-badge ${getStatusClass(supplier.status)}">${supplier.status}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Render charts
function renderCharts() {
    renderQualityChart();
    renderDeliveryChart();
    renderPricingChart();
}

// Load supplier notes
let supplierNotes = [];
let sentimentData = [];

async function loadSupplierNotes() {
    try {
        const response = await fetch('/api/supplier-notes');
        supplierNotes = await response.json();
        populateSupplierFilter();
        renderNotes();
    } catch (error) {
        console.error('Failed to load supplier notes:', error);
    }
}

async function loadSentimentData() {
    try {
        const response = await fetch('/api/sentiment-analysis');
        sentimentData = await response.json();
        renderSentimentChart();
    } catch (error) {
        console.error('Failed to load sentiment data:', error);
    }
}

function populateSupplierFilter() {
    const filter = document.getElementById('supplierFilter');
    const suppliers = [...new Set(supplierNotes.map(note => note.supplier_name))].sort();
    
    filter.innerHTML = '<option value="">All Suppliers</option>' +
        suppliers.map(supplier => `<option value="${supplier}">${supplier}</option>`).join('');
}

function renderNotes(filterSupplier = '') {
    const container = document.getElementById('notesContainer');
    const filteredNotes = filterSupplier ? 
        supplierNotes.filter(note => note.supplier_name === filterSupplier) : 
        supplierNotes;
    
    if (filteredNotes.length === 0) {
        container.innerHTML = '<div class="note-item">No notes available</div>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedNotes = filteredNotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    container.innerHTML = sortedNotes.map(note => {
        const noteTypeIcon = {
            'EMAIL': '<i class="fas fa-envelope"></i>',
            'MEETING': '<i class="fas fa-users"></i>',
            'NOTE': '<i class="fas fa-sticky-note"></i>'
        };
        
        const sentimentIcon = {
            'POSITIVE': '<i class="fas fa-smile"></i>',
            'NEGATIVE': '<i class="fas fa-frown"></i>',
            'NEUTRAL': '<i class="fas fa-meh"></i>'
        };
        
        return `
            <div class="note-item">
                <div class="note-header">
                    <div>
                        <span class="note-type">
                            ${noteTypeIcon[note.note_type] || ''} ${note.note_type}
                        </span>
                        <strong>${note.supplier_name}</strong>
                        <span class="sentiment-badge sentiment-${note.sentiment.toLowerCase()}">
                            ${sentimentIcon[note.sentiment] || ''} ${note.sentiment} (${note.sentiment_score.toFixed(2)})
                        </span>
                    </div>
                    <div class="note-meta">
                        ${note.author} • ${note.date || 'No date'}
                    </div>
                </div>
                <div class="note-content">
                    ${note.content}
                </div>
                ${note.keywords && note.keywords.length > 0 ? `
                    <div class="keywords">
                        ${note.keywords.map(keyword => `<span class="keyword-tag">${keyword}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderSentimentChart() {
    const ctx = document.getElementById('sentimentChart');
    if (!ctx || !sentimentData.length) return;
    
    const chartCtx = ctx.getContext('2d');
    
    // Destroy existing chart if it exists
    if (charts.sentiment) {
        charts.sentiment.destroy();
    }
    
    charts.sentiment = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: sentimentData.map(s => s.supplier_name.length > 15 ? 
                s.supplier_name.substring(0, 12) + '...' : s.supplier_name),
            datasets: [
                {
                    label: 'Positive Notes',
                    data: sentimentData.map(s => s.positive_notes),
                    backgroundColor: 'rgba(72, 187, 120, 0.8)',
                    borderColor: 'rgba(72, 187, 120, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Negative Notes',
                    data: sentimentData.map(s => s.negative_notes),
                    backgroundColor: 'rgba(245, 101, 101, 0.8)',
                    borderColor: 'rgba(245, 101, 101, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Neutral Notes',
                    data: sentimentData.map(s => s.neutral_notes),
                    backgroundColor: 'rgba(160, 174, 192, 0.8)',
                    borderColor: 'rgba(160, 174, 192, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    stacked: true,
                    ticks: {
                        maxRotation: 45
                    }
                },
                y: { 
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Notes'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Sentiment Distribution by Supplier'
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const supplier = sentimentData[context.dataIndex];
                            return `Avg Score: ${supplier.avg_sentiment_score}`;
                        }
                    }
                }
            }
        }
    });
}

function filterNotes() {
    const filter = document.getElementById('supplierFilter');
    renderNotes(filter.value);
}

async function testParser() {
    const button = event.target;
    const originalText = button.innerHTML;
    
    try {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        button.disabled = true;
        
        const response = await fetch('/api/test-parser');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned non-JSON response. Make sure the server is running.');
        }
        
        const result = await response.json();
        
        button.innerHTML = '<i class="fas fa-check"></i> Success!';
        alert(`Parser test successful! Found ${result.notesCount} notes.\n\nSample note: ${JSON.stringify(result.sampleNote, null, 2)}`);
        
    } catch (error) {
        button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
        console.error('Parser test error:', error);
        alert('Parser test failed: ' + error.message);
    } finally {
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
    }
}

async function parseNotes() {
    const button = event.target;
    const originalText = button.innerHTML;
    
    try {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Parsing...';
        button.disabled = true;
        
        const response = await fetch('/api/parse-notes', { method: 'POST' });
        const result = await response.json();
        
        if (response.ok) {
            button.innerHTML = '<i class="fas fa-check"></i> Success!';
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);
            
            await loadSupplierNotes();
            await loadSentimentData();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
        alert('Error parsing notes: ' + error.message);
    }
}

async function showSupplierDeduplication() {
    try {
        const response = await fetch('/api/suppliers-detailed');
        const suppliers = await response.json();
        
        const content = document.getElementById('supplierDeduplicationContent');
        content.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 0.5rem; border: 1px solid #e2e8f0;">Supplier ID</th>
                        <th style="padding: 0.5rem; border: 1px solid #e2e8f0;">Name</th>
                        <th style="padding: 0.5rem; border: 1px solid #e2e8f0;">Normalized Name</th>
                        <th style="padding: 0.5rem; border: 1px solid #e2e8f0;">Notes</th>
                        <th style="padding: 0.5rem; border: 1px solid #e2e8f0;">Orders</th>
                        <th style="padding: 0.5rem; border: 1px solid #e2e8f0;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${suppliers.map(s => `
                        <tr>
                            <td style="padding: 0.5rem; border: 1px solid #e2e8f0; font-family: monospace;">${s.supplier_id}</td>
                            <td style="padding: 0.5rem; border: 1px solid #e2e8f0;">${s.supplier_name}</td>
                            <td style="padding: 0.5rem; border: 1px solid #e2e8f0; font-style: italic;">${s.normalized_name}</td>
                            <td style="padding: 0.5rem; border: 1px solid #e2e8f0; text-align: center;">${s.note_count}</td>
                            <td style="padding: 0.5rem; border: 1px solid #e2e8f0; text-align: center;">${s.order_count}</td>
                            <td style="padding: 0.5rem; border: 1px solid #e2e8f0; text-align: center;">
                                <button onclick="viewSupplierDetail('${s.supplier_id}')" style="background: #667eea; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
                                    View Detail
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p style="margin-top: 1rem; font-size: 0.875rem; color: #666;">
                <strong>Total:</strong> ${suppliers.length} unique suppliers identified
            </p>
        `;
        
        document.getElementById('supplierDeduplicationModal').style.display = 'block';
    } catch (error) {
        alert('Error loading supplier data: ' + error.message);
    }
}

function viewSupplierDetail(supplierId) {
    window.open(`/supplier-detail.html?id=${supplierId}`, '_blank');
}

function startSupplierChat(supplierName) {
    const chatInput = document.getElementById('chatInput');
    chatInput.value = `Tell me about ${supplierName}`;
    chatInput.focus();
    sendMessage();
}

function closeSupplierModal() {
    document.getElementById('supplierDeduplicationModal').style.display = 'none';
}

function renderQualityChart() {
    const ctx = document.getElementById('qualityChart').getContext('2d');
    const { quality } = dashboardData.metrics;
    
    charts.quality = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: quality.map(q => q.supplier_name.split(' ')[0]),
            datasets: [{
                label: 'Rejection Rate (%)',
                data: quality.map(q => q.rejection_rate || 0),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Rejection Rate (%)'
                    }
                }
            }
        }
    });
}

function renderDeliveryChart() {
    const ctx = document.getElementById('deliveryChart').getContext('2d');
    const { delivery } = dashboardData.metrics;
    
    charts.delivery = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: delivery.map(d => d.supplier_name.split(' ')[0]),
            datasets: [{
                label: 'On-Time Rate (%)',
                data: delivery.map(d => (d.on_time_deliveries / d.total_orders) * 100),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
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
                }
            }
        }
    });
}

function renderPricingChart() {
    const ctx = document.getElementById('pricingChart').getContext('2d');
    const { pricing } = dashboardData.metrics;
    
    charts.pricing = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Price vs Lead Time',
                data: pricing.map(p => ({
                    x: p.avg_lead_time,
                    y: p.avg_price
                })),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                pointRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Average Lead Time (weeks)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Average Price ($)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const supplier = pricing[context.dataIndex];
                            return `${supplier.supplier_name}: $${context.parsed.y.toFixed(0)}, ${context.parsed.x} weeks`;
                        }
                    }
                }
            }
        }
    });
}

// Tab switching
function switchTab(tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// Chatbot functionality
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addMessage(message, 'user');
    input.value = '';
    
    // Show loading
    document.getElementById('chatLoading').style.display = 'block';
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        // Hide loading
        document.getElementById('chatLoading').style.display = 'none';
        
        // Add bot response
        addMessage(formatBotResponse(data), 'bot');
        
    } catch (error) {
        document.getElementById('chatLoading').style.display = 'none';
        addMessage('Sorry, I encountered an error processing your request.', 'bot');
    }
}

function addMessage(message, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatBotResponse(data) {
    if (!data || !data.message) {
        return 'Sorry, I received an invalid response.';
    }
    
    let response = data.message;
    
    if (data.type === 'recommendation' && data.data && Array.isArray(data.data)) {
        response += '<br><br><strong>Top Suppliers:</strong><br>';
        data.data.forEach((supplier, index) => {
            if (supplier && supplier.supplier) {
                response += `${index + 1}. ${supplier.supplier} (Score: ${(supplier.score || 0).toFixed(1)})<br>`;
            }
        });
    }
    
    if (data.type === 'quality_analysis' && data.data) {
        response += '<br><br><strong>Quality Rankings:</strong><br>';
        data.data.slice(0, 5).forEach((supplier, index) => {
            response += `${index + 1}. ${supplier.supplier_name}: ${supplier.rejection_rate}% rejection rate<br>`;
        });
    }
    
    if (data.type === 'delivery_analysis' && data.data) {
        response += '<br><br><strong>Delivery Performance:</strong><br>';
        data.data.slice(0, 5).forEach((supplier, index) => {
            response += `${index + 1}. ${supplier.supplier_name}: ${supplier.on_time_rate}% on-time<br>`;
        });
    }
    
    if (data.insights) {
        response += '<br><br><strong>Key Insights:</strong><br>';
        data.insights.forEach(insight => {
            response += `• ${insight}<br>`;
        });
    }
    
    if (data.suggestions) {
        response += '<br><br><strong>Try asking:</strong><br>';
        data.suggestions.forEach(suggestion => {
            response += `• ${suggestion}<br>`;
        });
    }
    
    return response;
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function showSupplierDetails(supplierName) {
    addMessage(`Tell me about ${supplierName}`, 'user');
    
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: supplierName })
    })
    .then(response => response.json())
    .then(data => {
        addMessage(formatBotResponse(data), 'bot');
    })
    .catch(error => {
        addMessage('Sorry, I could not retrieve supplier details.', 'bot');
    });
}