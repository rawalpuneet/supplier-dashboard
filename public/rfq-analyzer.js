let rfqData = null;
let currentCharts = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadRFQData();
    setupModal();
});

async function loadRFQData() {
    try {
        const response = await fetch('/api/rfq-analysis');
        rfqData = await response.json();
        
        if (!response.ok) {
            throw new Error(rfqData.error || 'Failed to load RFQ data');
        }
        
        renderProductsGrid();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading RFQ data:', error);
        document.getElementById('loading').innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> 
            Error loading RFQ data: ${error.message}
        `;
    }
}

function renderProductsGrid() {
    const grid = document.getElementById('productsGrid');
    
    grid.innerHTML = rfqData.products.map(product => `
        <div class="product-card" onclick="openProductModal('${product.part_description}')">
            <div class="product-title">${product.part_description}</div>
            <div class="product-stats">
                <div class="stat">
                    <div class="stat-value">${product.rfq_count}</div>
                    <div class="stat-label">RFQs</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${product.supplier_count}</div>
                    <div class="stat-label">Suppliers</div>
                </div>
                <div class="stat">
                    <div class="stat-value">$${product.avg_price.toFixed(0)}</div>
                    <div class="stat-label">Avg Price</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${product.avg_lead_time.toFixed(1)}w</div>
                    <div class="stat-label">Avg Lead Time</div>
                </div>
            </div>
            <div class="suppliers-preview">
                ${product.suppliers.slice(0, 3).map(s => `
                    <span class="supplier-tag">${s}</span>
                `).join('')}
                ${product.suppliers.length > 3 ? `<span class="supplier-tag">+${product.suppliers.length - 3} more</span>` : ''}
            </div>
        </div>
    `).join('');
}

async function openProductModal(productName) {
    try {
        const response = await fetch(`/api/rfq-product-analysis/${encodeURIComponent(productName)}`);
        const productData = await response.json();
        
        if (!response.ok) {
            throw new Error(productData.error || 'Failed to load product data');
        }
        
        document.getElementById('modalTitle').textContent = `${productName} - Supplier Analysis`;
        renderSupplierComparison(productData);
        renderPriceChart(productData);
        renderProductPerformanceCharts(productData);
        renderRFQResponsesTable(productData.all_responses);
        
        document.getElementById('productModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading product data:', error);
        alert('Failed to load product analysis');
    }
}

function renderSupplierComparison(productData) {
    const container = document.getElementById('suppliersComparison');
    
    container.innerHTML = productData.suppliers.map(supplier => `
        <div class="supplier-card">
            <div class="supplier-name">${supplier.supplier_name}</div>
            <div class="metrics-row">
                <div class="metric">
                    <div class="metric-value">${supplier.order_count}</div>
                    <div class="metric-label">Total Orders</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${supplier.quote_count}</div>
                    <div class="metric-label">Total Quotes</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${supplier.on_time_rate.toFixed(1)}%</div>
                    <div class="metric-label">On-Time</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${supplier.quality_rate.toFixed(1)}%</div>
                    <div class="metric-label">Quality</div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderPriceChart(productData) {
    const ctx = document.getElementById('priceComparisonChart').getContext('2d');
    const suppliers = productData.suppliers;
    const colors = ['#667eea', '#48bb78', '#ed8936', '#f56565', '#9f7aea', '#38b2ac'];
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: suppliers.map(s => s.supplier_name),
            datasets: [{
                label: 'Average Quoted Price ($)',
                data: suppliers.map(s => s.avg_quoted_price),
                backgroundColor: suppliers.map((_, i) => colors[i % colors.length]),
                borderColor: suppliers.map((_, i) => colors[i % colors.length]),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Price Comparison by Supplier'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Price ($)'
                    }
                }
            }
        }
    });
    
    currentCharts.push(chart);
}

function renderProductPerformanceCharts(productData) {
    const colors = ['#667eea', '#48bb78', '#ed8936', '#f56565', '#9f7aea', '#38b2ac'];
    
    // Group data by supplier
    const supplierPriceData = {};
    const supplierDeliveryData = {};
    const supplierQualityData = {};
    
    productData.price_trend.forEach(d => {
        if (!supplierPriceData[d.supplier_name]) supplierPriceData[d.supplier_name] = [];
        supplierPriceData[d.supplier_name].push({month: d.month, price: d.avg_price});
    });
    
    productData.delivery_trend.forEach(d => {
        if (!supplierDeliveryData[d.supplier_name]) supplierDeliveryData[d.supplier_name] = [];
        supplierDeliveryData[d.supplier_name].push({month: d.month, rate: (d.on_time_orders / d.total_orders * 100)});
    });
    
    productData.quality_trend.forEach(d => {
        if (!supplierQualityData[d.supplier_name]) supplierQualityData[d.supplier_name] = [];
        supplierQualityData[d.supplier_name].push({month: d.month, score: d.quality_score});
    });
    
    // Get all unique months
    const allMonths = [...new Set([
        ...productData.price_trend.map(d => d.month),
        ...productData.delivery_trend.map(d => d.month),
        ...productData.quality_trend.map(d => d.month)
    ])].sort();
    
    // Price Trend Chart
    const priceTrendCtx = document.getElementById('productPriceTrendChart').getContext('2d');
    const priceDatasets = Object.keys(supplierPriceData).map((supplier, i) => ({
        label: supplier,
        data: allMonths.map(month => {
            const data = supplierPriceData[supplier].find(d => d.month === month);
            return data ? data.price : null;
        }),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        tension: 0.4
    }));
    
    const priceTrendChart = new Chart(priceTrendCtx, {
        type: 'line',
        data: {
            labels: allMonths,
            datasets: priceDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Price Trend by Supplier'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Price ($)'
                    }
                }
            }
        }
    });
    
    // Delivery Performance Chart
    const deliveryCtx = document.getElementById('productDeliveryChart').getContext('2d');
    const deliveryDatasets = Object.keys(supplierDeliveryData).map((supplier, i) => ({
        label: supplier,
        data: allMonths.map(month => {
            const data = supplierDeliveryData[supplier].find(d => d.month === month);
            return data ? data.rate : null;
        }),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        tension: 0.4
    }));
    
    const deliveryChart = new Chart(deliveryCtx, {
        type: 'line',
        data: {
            labels: allMonths,
            datasets: deliveryDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Delivery Performance by Supplier'
                }
            },
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
    
    // Quality Score Chart
    const qualityCtx = document.getElementById('productQualityChart').getContext('2d');
    const qualityDatasets = Object.keys(supplierQualityData).map((supplier, i) => ({
        label: supplier,
        data: allMonths.map(month => {
            const data = supplierQualityData[supplier].find(d => d.month === month);
            return data ? data.score : null;
        }),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        tension: 0.4
    }));
    
    const qualityChart = new Chart(qualityCtx, {
        type: 'line',
        data: {
            labels: allMonths,
            datasets: qualityDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Quality Score by Supplier'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Quality Score (%)'
                    }
                }
            }
        }
    });
    
    currentCharts.push(priceTrendChart, deliveryChart, qualityChart);
}

function renderRFQResponsesTable(responses) {
    const container = document.getElementById('rfqResponsesTable');
    
    if (!responses || responses.length === 0) {
        container.innerHTML = '<p>No RFQ responses found.</p>';
        return;
    }
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>RFQ ID</th>
                    <th>Supplier</th>
                    <th>Quote Date</th>
                    <th>Price</th>
                    <th>Lead Time</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                ${responses.map(response => `
                    <tr>
                        <td>${response.rfq_id}</td>
                        <td>${response.supplier_name}</td>
                        <td>${new Date(response.quote_date).toLocaleDateString()}</td>
                        <td>$${response.quoted_price.toFixed(2)}</td>
                        <td>${response.lead_time_weeks}w</td>
                        <td>${response.notes || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function setupModal() {
    const modal = document.getElementById('productModal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
        currentCharts.forEach(chart => chart.destroy());
        currentCharts = [];
    }
    
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
            currentCharts.forEach(chart => chart.destroy());
            currentCharts = [];
        }
    }
}