(function () {
    function isChartReady() {
        return typeof Chart !== 'undefined';
    }

    function isNetworkReady() {
        return typeof vis !== 'undefined' && !!vis.Network;
    }

    function setEmptyState(elementId, shouldShow, text) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (text) el.textContent = text;
        el.hidden = !shouldShow;
    }

    function colorByIntensity(value, maxValue) {
        if (!value || value <= 0 || !maxValue || maxValue <= 0) {
            return 'transparent';
        }
        const ratio = Math.max(0.12, Math.min(1, value / maxValue));
        return `rgba(15, 123, 255, ${ratio.toFixed(2)})`;
    }

    function textColorByIntensity(value, maxValue) {
        if (!value || value <= 0 || !maxValue || maxValue <= 0) {
            return 'var(--text)';
        }
        const ratio = Math.min(1, value / maxValue);
        return ratio > 0.58 ? '#ffffff' : 'var(--text)';
    }

    function formatCurrency(value) {
        const num = Number(value || 0);
        return `₹${Math.round(num).toLocaleString('en-IN')}`;
    }

    function formatSignedCurrency(value) {
        const num = Number(value || 0);
        const sign = num > 0 ? '+' : num < 0 ? '-' : '';
        return `${sign}${formatCurrency(Math.abs(num))}`;
    }

    function normalizeLabel(text) {
        return (text || '').replace(/^\s*Rs\s+/i, '₹');
    }

    function toRelativeTime(timestamp) {
        if (!timestamp) {
            return 'Just now';
        }

        const parsed = new Date(timestamp);
        if (Number.isNaN(parsed.getTime())) {
            return 'Recently';
        }

        const diffMs = Date.now() - parsed.getTime();
        const minutes = Math.floor(diffMs / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hr ago`;

        const days = Math.floor(hours / 24);
        if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;

        return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    async function fetchJson(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${url}`);
        }

        return response.json();
    }

    function animateCounter(element) {
        if (!element) return;

        const target = Number(element.dataset.counterValue || 0);
        const prefix = element.dataset.counterPrefix || '';
        const duration = 900;
        const start = performance.now();

        function frame(now) {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = target * eased;

            if (prefix === '₹') {
                element.textContent = `${prefix}${Math.round(value).toLocaleString('en-IN')}`;
            } else {
                element.textContent = `${Math.round(value).toLocaleString('en-IN')}`;
            }

            if (progress < 1) {
                requestAnimationFrame(frame);
            }
        }

        requestAnimationFrame(frame);
    }

    function animateAllCounters() {
        document.querySelectorAll('[data-counter-value]').forEach(animateCounter);
    }

    function setCounterValue(id, value, prefix) {
        const el = document.getElementById(id);
        if (!el) return;
        el.dataset.counterValue = String(Math.max(0, Number(value || 0)));
        if (prefix) {
            el.dataset.counterPrefix = prefix;
        }
    }

    function renderExpenseInsightsChart(data) {
        const canvas = document.getElementById('userExpenseInsightsChart');
        if (!canvas) return 0;

        const categories = Array.isArray(data.categories) ? data.categories : [];
        const amounts = Array.isArray(data.amounts) ? data.amounts : [];

        if (categories.length === 0 || amounts.length === 0) {
            canvas.hidden = true;
            setEmptyState('userExpenseInsightsEmpty', true, 'No personal expense data found yet.');
            return 0;
        }

        setEmptyState('userExpenseInsightsEmpty', false);
        canvas.hidden = false;

        if (!isChartReady()) {
            setEmptyState('userExpenseInsightsEmpty', true, 'Chart library is unavailable.');
            return amounts.reduce((acc, item) => acc + Number(item || 0), 0);
        }

        const total = amounts.reduce((acc, item) => acc + Number(item || 0), 0);
        const colors = ['#0f7bff', '#00b8d9', '#00c2a8', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#3b82f6'];

        new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: amounts,
                    backgroundColor: categories.map(function (_, idx) {
                        return colors[idx % colors.length];
                    }),
                    borderColor: 'rgba(255,255,255,0.9)',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 950, easing: 'easeOutQuart' },
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
                                return `${context.label}: ${formatCurrency(amount)} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });

        return total;
    }

    function renderDebtNetwork(data) {
        const container = document.getElementById('userDebtNetworkGraph');
        if (!container) return;

        const nodes = Array.isArray(data.nodes) ? data.nodes : [];
        const edges = Array.isArray(data.edges) ? data.edges : [];

        if (nodes.length === 0 || edges.length === 0) {
            container.innerHTML = '';
            setEmptyState('userDebtNetworkEmpty', true, 'No debt links found right now.');
            return;
        }

        if (!isNetworkReady()) {
            setEmptyState('userDebtNetworkEmpty', true, 'Graph library is unavailable.');
            return;
        }

        setEmptyState('userDebtNetworkEmpty', false);
        container.innerHTML = '';

        const network = new vis.Network(
            container,
            {
                nodes: new vis.DataSet(nodes.map(function (node) {
                    return {
                        id: node.id,
                        label: node.label,
                        shape: 'dot',
                        size: node.label === 'You' ? 24 : 18,
                        color: node.label === 'You'
                            ? { background: '#0f7bff', border: '#0b5ec4' }
                            : { background: '#00b8d9', border: '#0891b2' },
                        font: { color: '#111827', size: 14, face: 'Manrope' }
                    };
                })),
                edges: new vis.DataSet(edges.map(function (edge) {
                    return {
                        from: edge.from,
                        to: edge.to,
                        label: normalizeLabel(edge.label || ''),
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
                    };
                }))
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

    function renderDebtHeatmap(data) {
        const table = document.getElementById('userDebtHeatmapTable');
        if (!table) return;

        const labels = Array.isArray(data.labels) ? data.labels : [];
        const matrix = Array.isArray(data.matrix) ? data.matrix : [];
        const maxValue = Number(data.max_value || 0);

        if (labels.length === 0 || matrix.length === 0) {
            table.innerHTML = '';
            setEmptyState('userDebtHeatmapEmpty', true, 'No personal debt matrix to display.');
            return;
        }

        setEmptyState('userDebtHeatmapEmpty', false);

        let html = '<thead><tr><th>From / To</th>';
        labels.forEach(function (label) {
            html += `<th>${label}</th>`;
        });
        html += '</tr></thead><tbody>';

        labels.forEach(function (fromLabel, rowIndex) {
            html += `<tr><th>${fromLabel}</th>`;
            labels.forEach(function (_, colIndex) {
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

    function computeDebtSummary(heatmapData, currentUser) {
        const users = Array.isArray(heatmapData.users) ? heatmapData.users : [];
        const labels = Array.isArray(heatmapData.labels) ? heatmapData.labels : [];
        const matrix = Array.isArray(heatmapData.matrix) ? heatmapData.matrix : [];

        if (users.length === 0 || matrix.length === 0) {
            return {
                owe: 0,
                owed: 0,
                net: 0,
                friendBalances: [],
                pendingDebts: 0
            };
        }

        let userIndex = users.indexOf(currentUser);
        if (userIndex < 0) {
            userIndex = 0;
        }

        let owe = 0;
        let owed = 0;
        const friendBalances = [];
        let pendingDebts = 0;

        for (let i = 0; i < users.length; i += 1) {
            if (i === userIndex) continue;

            const toFriend = Number((matrix[userIndex] && matrix[userIndex][i]) || 0);
            const fromFriend = Number((matrix[i] && matrix[i][userIndex]) || 0);

            owe += toFriend;
            owed += fromFriend;

            if (toFriend > 0.01) {
                pendingDebts += 1;
            }

            const net = fromFriend - toFriend;
            if (Math.abs(net) > 0.01) {
                friendBalances.push({
                    username: users[i],
                    displayName: labels[i] || users[i],
                    net: net,
                    youOwe: toFriend,
                    youAreOwed: fromFriend
                });
            }
        }

        friendBalances.sort(function (a, b) {
            return Math.abs(b.net) - Math.abs(a.net);
        });

        return {
            owe: owe,
            owed: owed,
            net: owed - owe,
            friendBalances: friendBalances,
            pendingDebts: pendingDebts
        };
    }

    function renderBalanceOverview(summary) {
        const oweEl = document.getElementById('balanceOverviewOwe');
        const owedEl = document.getElementById('balanceOverviewOwed');
        const netEl = document.getElementById('balanceOverviewNet');

        if (oweEl) oweEl.textContent = formatCurrency(summary.owe);
        if (owedEl) owedEl.textContent = formatCurrency(summary.owed);

        if (netEl) {
            netEl.textContent = formatSignedCurrency(summary.net);
            netEl.classList.remove('fin-balance-success', 'fin-balance-danger');
            if (summary.net >= 0) {
                netEl.classList.add('fin-balance-success');
            } else {
                netEl.classList.add('fin-balance-danger');
            }
        }

        setCounterValue('statYouOwe', summary.owe, '₹');
        setCounterValue('statYouAreOwed', summary.owed, '₹');
    }

    function renderUserBalanceInfo(friendBalances) {
        const list = document.getElementById('userBalancesList');
        if (!list) return;

        if (!Array.isArray(friendBalances) || friendBalances.length === 0) {
            list.innerHTML = '';
            setEmptyState('userBalancesEmpty', true, 'No active balances with friends right now.');
            return;
        }

        setEmptyState('userBalancesEmpty', false);

        list.innerHTML = friendBalances.slice(0, 6).map(function (item) {
            const positive = item.net > 0;
            const initial = (item.displayName || '?').charAt(0).toUpperCase();
            return `
                <li class="fin-balance-item">
                    <span class="fin-balance-item-name">
                        <span class="fin-activity-avatar" aria-hidden="true">${initial}</span>
                        ${item.displayName}
                    </span>
                    <strong class="${positive ? 'fin-chip-positive' : 'fin-chip-negative'}">${positive ? 'Owes you' : 'You owe'} ${formatCurrency(Math.abs(item.net))}</strong>
                </li>
            `;
        }).join('');
    }

    function renderRecentActivity(currentName, groups, friends, summary) {
        const list = document.getElementById('recentActivityList');
        if (!list) return;

        const activity = [];

        (friends || []).slice(0, 4).forEach(function (friend) {
            activity.push({
                name: friend.full_name || friend.username || 'Friend',
                avatar: friend.profile_pic_url || '',
                text: `${friend.full_name || friend.username} connected with you as a friend`,
                time: friend.created_at
            });
        });

        (groups || []).slice(0, 4).forEach(function (group) {
            activity.push({
                name: currentName || 'You',
                avatar: '',
                text: `You are active in ${group.group_name}`,
                time: group.created_at
            });
        });

        (summary.friendBalances || []).slice(0, 3).forEach(function (item) {
            if (item.youOwe > 0.01) {
                activity.push({
                    name: currentName || 'You',
                    avatar: '',
                    text: `You need to pay ${formatCurrency(item.youOwe)} to ${item.displayName}`,
                    time: ''
                });
            } else if (item.youAreOwed > 0.01) {
                activity.push({
                    name: item.displayName,
                    avatar: '',
                    text: `${item.displayName} owes you ${formatCurrency(item.youAreOwed)}`,
                    time: ''
                });
            }
        });

        activity.sort(function (a, b) {
            const aTime = a.time ? new Date(a.time).getTime() : 0;
            const bTime = b.time ? new Date(b.time).getTime() : 0;
            return bTime - aTime;
        });

        if (activity.length === 0) {
            list.innerHTML = '';
            setEmptyState('recentActivityEmpty', true, 'No recent activity available yet.');
            return;
        }

        setEmptyState('recentActivityEmpty', false);

        list.innerHTML = activity.slice(0, 8).map(function (item) {
            const initial = (item.name || '?').charAt(0).toUpperCase();
            const avatar = item.avatar
                ? `<img class="fin-activity-avatar" src="${item.avatar}" alt="${item.name}">`
                : `<span class="fin-activity-avatar" aria-hidden="true">${initial}</span>`;

            return `
                <li class="fin-activity-item">
                    ${avatar}
                    <div>
                        <p class="fin-activity-text">${item.text}</p>
                        <p class="fin-activity-time">${toRelativeTime(item.time)}</p>
                    </div>
                </li>
            `;
        }).join('');
    }

    function updateQuickAddExpense(groups) {
        const addExpenseBtn = document.getElementById('quickAddExpenseBtn');
        if (!addExpenseBtn) return;

        if (!Array.isArray(groups) || groups.length === 0) {
            addExpenseBtn.href = '/groups/create';
            return;
        }

        const firstGroup = groups[0];
        addExpenseBtn.href = `/groups/${firstGroup.group_id}`;
        addExpenseBtn.title = `Add expense in ${firstGroup.group_name}`;
    }

    async function fetchGroupMetrics(groups, currentUser) {
        if (!Array.isArray(groups) || groups.length === 0) {
            return { groupCards: [], groupScores: [] };
        }

        const requests = groups.map(function (group) {
            return Promise.allSettled([
                fetchJson(`/api/groups/${group.group_id}/balances`),
                fetchJson(`/api/group-health/${group.group_id}`)
            ]).then(function (results) {
                const balancesData = results[0].status === 'fulfilled' ? results[0].value : { balances: {} };
                const healthData = results[1].status === 'fulfilled' ? results[1].value : { score: 0 };

                const balances = balancesData && balancesData.balances ? balancesData.balances : {};
                const myBalance = Number((balances && balances[currentUser]) || 0);

                return {
                    group: group,
                    myBalance: myBalance,
                    healthScore: Number(healthData.score || 0)
                };
            });
        });

        const rows = await Promise.all(requests);
        return {
            groupCards: rows,
            groupScores: rows.map(function (row) { return row.healthScore; }).filter(function (score) { return score > 0; })
        };
    }

    function renderGroupOverview(groupCards) {
        const grid = document.getElementById('groupOverviewGrid');
        if (!grid) return;

        if (!Array.isArray(groupCards) || groupCards.length === 0) {
            grid.innerHTML = '';
            setEmptyState('groupOverviewEmpty', true, 'No active groups yet. Create your first group to start tracking shared expenses.');
            return;
        }

        setEmptyState('groupOverviewEmpty', false);
        grid.innerHTML = groupCards.map(function (item) {
            const group = item.group;
            const amount = Math.abs(item.myBalance || 0);

            let netText = 'Settled';
            let netClass = 'fin-chip-positive';

            if (item.myBalance < -0.01) {
                netText = `You Owe ${formatCurrency(amount)}`;
                netClass = 'fin-chip-negative';
            } else if (item.myBalance > 0.01) {
                netText = `You Are Owed ${formatCurrency(amount)}`;
                netClass = 'fin-chip-positive';
            }

            return `
                <article class="fin-group-card">
                    <h4 class="fin-group-title">${group.group_name}</h4>
                    <p class="fin-group-meta">Members: ${Number(group.member_count || 0)}</p>
                    <p class="fin-group-net"><span class="${netClass}">${netText}</span></p>
                    <a class="btn btn-ghost btn-sm" href="/groups/${group.group_id}">Open Group</a>
                </article>
            `;
        }).join('');
    }

    function renderSmartSuggestion(summary) {
        const suggestionEl = document.getElementById('smartSuggestionText');
        if (!suggestionEl) return;

        const balances = summary.friendBalances || [];
        if (balances.length === 0) {
            suggestionEl.textContent = 'Great work. You are fully balanced with your network right now.';
            return;
        }

        const highest = balances.reduce(function (acc, item) {
            return Math.abs(item.net) > Math.abs(acc.net) ? item : acc;
        }, balances[0]);

        if (highest.net < 0) {
            suggestionEl.textContent = `You can settle ${formatCurrency(Math.abs(highest.net))} with ${highest.displayName} to clear most of your pending debt.`;
        } else {
            suggestionEl.textContent = `${highest.displayName} owes you ${formatCurrency(highest.net)}. Requesting settlement here will improve your net balance quickly.`;
        }
    }

    function renderFinancialHealthScore(summary, groupScores) {
        const scoreEl = document.getElementById('financialHealthScore');
        const hintEl = document.getElementById('financialHealthHint');
        const progressEl = document.getElementById('financialHealthProgress');

        if (!scoreEl || !hintEl || !progressEl) return;

        const totalExposure = summary.owe + summary.owed;
        const balanceQuality = totalExposure > 0 ? Math.max(0, 1 - Math.abs(summary.net) / totalExposure) : 1;
        const pendingPenalty = Math.min(45, summary.pendingDebts * 9);
        const balancePenalty = Math.round((1 - balanceQuality) * 30);
        const settlementBonus = summary.friendBalances.length === 0 ? 20 : Math.max(0, 20 - summary.friendBalances.length * 3);

        let localScore = 100 - pendingPenalty - balancePenalty + settlementBonus;
        localScore = Math.max(0, Math.min(100, localScore));

        let finalScore = localScore;
        if (Array.isArray(groupScores) && groupScores.length > 0) {
            const avgGroupScore = groupScores.reduce(function (acc, score) { return acc + score; }, 0) / groupScores.length;
            finalScore = Math.round(avgGroupScore * 0.65 + localScore * 0.35);
        }

        finalScore = Math.max(0, Math.min(100, finalScore));

        scoreEl.dataset.counterValue = String(finalScore);
        hintEl.textContent = `Score factors: pending debts (${summary.pendingDebts}), settlement quality, and balanced expenses.`;
        progressEl.style.width = `${finalScore}%`;
        progressEl.classList.remove('health-red', 'health-yellow', 'health-green');

        if (finalScore < 45) {
            progressEl.classList.add('health-red');
        } else if (finalScore < 75) {
            progressEl.classList.add('health-yellow');
        } else {
            progressEl.classList.add('health-green');
        }
    }

    async function initPersonalAnalytics() {
        const root = document.getElementById('userInsightsRoot');
        if (!root) return;

        const currentUser = root.dataset.currentUser || '';
        const currentName = root.dataset.currentName || 'You';

        try {
            const [expenseResult, networkResult, heatmapResult, groupsResult, friendsResult] = await Promise.allSettled([
                fetchJson('/api/user-expense-insights'),
                fetchJson('/api/user-debt-network'),
                fetchJson('/api/user-debt-heatmap'),
                fetchJson('/api/groups'),
                fetchJson('/api/get-friends')
            ]);

            const expenseData = expenseResult.status === 'fulfilled' ? expenseResult.value : { categories: [], amounts: [] };
            const networkData = networkResult.status === 'fulfilled' ? networkResult.value : { nodes: [], edges: [] };
            const heatmapData = heatmapResult.status === 'fulfilled' ? heatmapResult.value : { labels: [], users: [], matrix: [], max_value: 0 };
            const groups = groupsResult.status === 'fulfilled' && Array.isArray(groupsResult.value.groups) ? groupsResult.value.groups : [];
            const friends = friendsResult.status === 'fulfilled' && Array.isArray(friendsResult.value.friends) ? friendsResult.value.friends : [];

            const totalExpenses = renderExpenseInsightsChart(expenseData);
            renderDebtNetwork(networkData);
            renderDebtHeatmap(heatmapData);

            const debtSummary = computeDebtSummary(heatmapData, currentUser);

            renderBalanceOverview(debtSummary);
            renderUserBalanceInfo(debtSummary.friendBalances);
            renderRecentActivity(currentName, groups, friends, debtSummary);
            renderSmartSuggestion(debtSummary);

            setCounterValue('statTotalExpenses', totalExpenses, '₹');
            setCounterValue('statTotalGroups', groups.length, '');
            setCounterValue('statTotalFriends', friends.length, '');

            updateQuickAddExpense(groups);

            const groupMetrics = await fetchGroupMetrics(groups, currentUser);
            renderGroupOverview(groupMetrics.groupCards);
            renderFinancialHealthScore(debtSummary, groupMetrics.groupScores);

            animateAllCounters();
        } catch (error) {
            console.error('Dashboard analytics load failed:', error);
            setEmptyState('userExpenseInsightsEmpty', true, 'Unable to load personal analytics right now.');
            setEmptyState('userDebtNetworkEmpty', true, 'Unable to load personal analytics right now.');
            setEmptyState('userDebtHeatmapEmpty', true, 'Unable to load personal analytics right now.');
            setEmptyState('recentActivityEmpty', true, 'Unable to load recent activity right now.');
            setEmptyState('groupOverviewEmpty', true, 'Unable to load group overview right now.');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPersonalAnalytics);
    } else {
        initPersonalAnalytics();
    }
})();
