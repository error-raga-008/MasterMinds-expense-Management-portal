(function () {
    function isReady() {
        return typeof Chart !== 'undefined' && typeof vis !== 'undefined' && vis.Network;
    }

    function setEmptyState(elementId, shouldShow, text) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (text) el.textContent = text;
        el.hidden = !shouldShow;
    }

    function formatMoney(value, currency) {
        const amount = Number(value || 0);
        return `${currency} ${amount.toFixed(2)}`;
    }

    function colorByIntensity(value, maxValue) {
        if (!value || value <= 0 || !maxValue || maxValue <= 0) {
            return 'transparent';
        }
        const ratio = Math.max(0.12, Math.min(1, value / maxValue));
        return `rgba(0, 184, 217, ${ratio.toFixed(2)})`;
    }

    function textColorByIntensity(value, maxValue) {
        if (!value || value <= 0 || !maxValue || maxValue <= 0) {
            return 'var(--text)';
        }
        const ratio = Math.min(1, value / maxValue);
        return ratio > 0.58 ? '#ffffff' : 'var(--text)';
    }

    async function fetchJson(url) {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            throw new Error(`Request failed: ${url}`);
        }
        return response.json();
    }

    function renderGroupExpenseChart(data, currency) {
        const canvas = document.getElementById('groupExpenseInsightsChart');
        if (!canvas) return;

        const categories = Array.isArray(data.categories) ? data.categories : [];
        const amounts = Array.isArray(data.amounts) ? data.amounts : [];

        if (categories.length === 0 || amounts.length === 0) {
            canvas.hidden = true;
            setEmptyState('groupExpenseInsightsEmpty', true, 'No categorized expense data available.');
            return;
        }

        setEmptyState('groupExpenseInsightsEmpty', false);
        canvas.hidden = false;

        const total = amounts.reduce((acc, item) => acc + Number(item || 0), 0);
        const colors = [
            '#0f7bff', '#00b8d9', '#00c2a8', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#3b82f6'
        ];

        new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: amounts,
                    backgroundColor: categories.map((_, idx) => colors[idx % colors.length]),
                    borderColor: 'rgba(255,255,255,0.9)',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const amount = Number(context.parsed || 0);
                                const percent = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0';
                                return `${context.label}: ${formatMoney(amount, currency)} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderGroupDebtNetwork(data) {
        const container = document.getElementById('groupDebtNetworkGraph');
        if (!container) return;

        const nodes = Array.isArray(data.nodes) ? data.nodes : [];
        const edges = Array.isArray(data.edges) ? data.edges : [];

        if (nodes.length === 0 || edges.length === 0) {
            container.innerHTML = '';
            setEmptyState('groupDebtNetworkEmpty', true, 'No debt links in this group right now.');
            return;
        }

        setEmptyState('groupDebtNetworkEmpty', false);
        container.innerHTML = '';

        const network = new vis.Network(
            container,
            {
                nodes: new vis.DataSet(nodes.map((node) => ({
                    id: node.id,
                    label: node.label,
                    shape: 'dot',
                    size: 18,
                    color: { background: '#00b8d9', border: '#0891b2' },
                    font: { color: '#111827', size: 14, face: 'Manrope' }
                }))),
                edges: new vis.DataSet(edges.map((edge) => ({
                    from: edge.from,
                    to: edge.to,
                    label: edge.label,
                    arrows: 'to',
                    color: { color: '#64748b' },
                    font: {
                        align: 'top',
                        size: 12,
                        face: 'Manrope',
                        strokeWidth: 4,
                        strokeColor: '#f2f4f7',
                        background: '#ffffff',
                        vadjust: -12
                    },
                    smooth: {
                        enabled: true,
                        type: edge.from < edge.to ? 'curvedCW' : 'curvedCCW',
                        roundness: 0.2
                    },
                    width: Math.max(1.2, Math.min(4.2, Number(edge.amount || 0) / 160)),
                    arrows: {
                        to: {
                            enabled: true,
                            scaleFactor: 0.8
                        }
                    }
                })))
            },
            {
                autoResize: true,
                physics: {
                    enabled: true,
                    stabilization: { iterations: 100 }
                },
                interaction: {
                    dragNodes: true,
                    dragView: true,
                    zoomView: true
                },
                layout: {
                    improvedLayout: true
                }
            }
        );

        window.addEventListener('resize', function () {
            network.redraw();
        });
    }

    function renderGroupDebtHeatmap(data) {
        const table = document.getElementById('groupDebtHeatmapTable');
        if (!table) return;

        const labels = Array.isArray(data.labels) ? data.labels : [];
        const matrix = Array.isArray(data.matrix) ? data.matrix : [];
        const maxValue = Number(data.max_value || 0);

        if (labels.length === 0 || matrix.length === 0) {
            table.innerHTML = '';
            setEmptyState('groupDebtHeatmapEmpty', true, 'No group debt matrix available.');
            return;
        }

        setEmptyState('groupDebtHeatmapEmpty', false);

        let html = '<thead><tr><th>From / To</th>';
        labels.forEach((label) => {
            html += `<th>${label}</th>`;
        });
        html += '</tr></thead><tbody>';

        labels.forEach((fromLabel, rowIndex) => {
            html += `<tr><th>${fromLabel}</th>`;
            labels.forEach((_, colIndex) => {
                const value = matrix[rowIndex] ? matrix[rowIndex][colIndex] : null;
                if (value === null || typeof value === 'undefined') {
                    html += '<td class="heatmap-diagonal">-</td>';
                    return;
                }
                const amount = Number(value || 0);
                const bg = colorByIntensity(amount, maxValue);
                const fg = textColorByIntensity(amount, maxValue);
                html += `<td style="background:${bg};color:${fg};">${amount > 0 ? amount.toFixed(2) : '0'}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody>';
        table.innerHTML = html;
    }

    function renderSimplifiedTransactions(data, currency) {
        const list = document.getElementById('groupSimplifiedTransactionsList');
        if (!list) return;

        const transactions = Array.isArray(data.transactions) ? data.transactions : [];

        if (transactions.length === 0) {
            list.innerHTML = '';
            setEmptyState('groupSimplifiedTransactionsEmpty', true, 'Everyone is already settled.');
            return;
        }

        setEmptyState('groupSimplifiedTransactionsEmpty', false);

        list.innerHTML = transactions
            .map((tx) => {
                const amount = Number(tx.amount || 0);
                return `
                    <div class="analytics-tx-item">
                        <div class="analytics-tx-flow">
                            <strong>${tx.from}</strong>
                            <span class="analytics-arrow">→</span>
                            <strong>${tx.to}</strong>
                        </div>
                        <span class="analytics-tx-badge">${formatMoney(amount, currency)}</span>
                    </div>
                `;
            })
            .join('');
    }

    async function initGroupAnalytics() {
        const root = document.getElementById('groupInsightsRoot');
        if (!root) return;

        if (!isReady()) {
            setEmptyState('groupExpenseInsightsEmpty', true, 'Analytics libraries failed to load.');
            setEmptyState('groupDebtNetworkEmpty', true, 'Analytics libraries failed to load.');
            setEmptyState('groupDebtHeatmapEmpty', true, 'Analytics libraries failed to load.');
            setEmptyState('groupSimplifiedTransactionsEmpty', true, 'Analytics libraries failed to load.');
            return;
        }

        const groupId = root.dataset.groupId;
        const currency = root.dataset.currency || 'INR';
        if (!groupId) return;

        try {
            const [networkData, heatmapData, expenseData, transactionData] = await Promise.all([
                fetchJson(`/api/group-debt-network/${groupId}`),
                fetchJson(`/api/group-debt-heatmap/${groupId}`),
                fetchJson(`/api/group-expense-insights/${groupId}`),
                fetchJson(`/api/group-simplified-settlements/${groupId}`)
            ]);

            renderGroupDebtNetwork(networkData);
            renderGroupDebtHeatmap(heatmapData);
            renderGroupExpenseChart(expenseData, currency);
            renderSimplifiedTransactions(transactionData, currency);
        } catch (error) {
            console.error('Group analytics load failed:', error);
            setEmptyState('groupExpenseInsightsEmpty', true, 'Unable to load group analytics right now.');
            setEmptyState('groupDebtNetworkEmpty', true, 'Unable to load group analytics right now.');
            setEmptyState('groupDebtHeatmapEmpty', true, 'Unable to load group analytics right now.');
            setEmptyState('groupSimplifiedTransactionsEmpty', true, 'Unable to load group analytics right now.');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGroupAnalytics);
    } else {
        initGroupAnalytics();
    }
})();
