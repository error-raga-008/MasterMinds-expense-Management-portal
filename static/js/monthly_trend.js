(function () {
    async function loadMonthlyTrend() {
        const canvas = document.getElementById('monthlyChart');
        const emptyState = document.getElementById('trendEmpty');
        if (!canvas) return;

        try {
            const response = await fetch('/api/monthly-trend');
            if (!response.ok) {
                throw new Error('Failed to load monthly trend data');
            }

            const data = await response.json();
            const months = Array.isArray(data.months) ? data.months : [];
            const totals = Array.isArray(data.totals) ? data.totals : [];

            if (months.length === 0 || totals.length === 0) {
                canvas.hidden = true;
                if (emptyState) emptyState.hidden = false;
                return;
            }

            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Monthly Spending',
                            data: totals,
                            borderColor: '#0f7bff',
                            backgroundColor: 'rgba(15, 123, 255, 0.14)',
                            borderWidth: 3,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#0f7bff',
                            fill: true,
                            tension: 0.35
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return `Monthly Spending: ${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function (value) {
                                    return value;
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error(error);
            canvas.hidden = true;
            if (emptyState) {
                emptyState.hidden = false;
                emptyState.textContent = 'Unable to load spending trend right now.';
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadMonthlyTrend);
    } else {
        loadMonthlyTrend();
    }
})();
