function renderProductCharts() {
    const { productData } = supplierData;
    const container = document.getElementById('productCharts');
    
    if (!productData || productData.length === 0) {
        container.innerHTML = '<p>No product data available</p>';
        return;
    }
    
    container.innerHTML = productData.map((product, index) => `
        <div class="product-chart">
            <div class="product-header">
                <div class="product-title">${product.part_description} (${product.part_number})</div>
                <div class="product-metrics">
                    <span>Orders: ${product.orders.length}</span>
                    <span>Avg Price: $${product.avgPrice.toFixed(2)}</span>
                    <span>On-Time: ${product.onTimeRate.toFixed(1)}%</span>
                    <span>Quality: ${product.qualityRate.toFixed(1)}%</span>
                </div>
            </div>
            <div class="product-charts-grid">
                <div class="mini-chart">
                    <canvas id="priceChart${index}"></canvas>
                </div>
                <div class="mini-chart">
                    <canvas id="deliveryChart${index}"></canvas>
                </div>
                <div class="mini-chart">
                    <canvas id="qualityChart${index}"></canvas>
                </div>
            </div>
        </div>
    `).join('');
    
    // Render individual product charts
    productData.forEach((product, index) => {
        renderProductPriceChart(product, index);
        renderProductDeliveryChart(product, index);
        renderProductQualityChart(product, index);
    });
}

function renderProductPriceChart(product, index) {
    const ctx = document.getElementById(`priceChart${index}`).getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: product.orders.map(o => o.order_date.substring(0, 7)),
            datasets: [{
                label: 'Unit Price ($)',
                data: product.orders.map(o => o.unit_price),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Price Trend'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Price ($)'
                    }
                },
                x: {
                    display: false
                }
            }
        }
    });
}

function renderProductDeliveryChart(product, index) {
    const ctx = document.getElementById(`deliveryChart${index}`).getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: product.orders.map(o => o.order_date.substring(0, 7)),
            datasets: [{
                label: 'On-Time',
                data: product.orders.map(o => o.on_time ? 1 : 0),
                backgroundColor: product.orders.map(o => o.on_time ? '#48bb78' : '#f56565')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Delivery Performance'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        callback: function(value) {
                            return value === 1 ? 'On-Time' : 'Late';
                        }
                    }
                },
                x: {
                    display: false
                }
            }
        }
    });
}

function renderProductQualityChart(product, index) {
    const ctx = document.getElementById(`qualityChart${index}`).getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: product.orders.map(o => o.order_date.substring(0, 7)),
            datasets: [{
                label: 'Quality Score',
                data: product.orders.map(o => o.quality_score || 95),
                backgroundColor: product.orders.map(o => {
                    const score = o.quality_score || 95;
                    return score >= 95 ? '#48bb78' : score >= 85 ? '#ed8936' : '#f56565';
                })
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Quality Score'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Score (%)'
                    }
                },
                x: {
                    display: false
                }
            }
        }
    });
}