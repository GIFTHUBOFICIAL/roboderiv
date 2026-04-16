export class Dashboard {
    constructor() {
        this.chart = null;
        this.history = [0];
        this.labels = ['0'];
        this.setupChart();
    }

    setupChart() {
        const ctx = document.getElementById('equityChart').getContext('2d');

        // Gradient for the area chart
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.labels,
                datasets: [{
                    label: 'Lucro ($)',
                    data: this.history,
                    borderColor: '#22c55e',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointBackgroundColor: (context) => {
                        const index = context.dataIndex;
                        const value = context.dataset.data[index];
                        const prevValue = index > 0 ? context.dataset.data[index - 1] : 0;
                        return value >= prevValue ? '#22c55e' : '#ef4444';
                    },
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#64748b',
                            callback: (value) => '$' + value.toFixed(2)
                        }
                    }
                }
            }
        });
    }

    updateStats(data) {
        if (data.balance !== undefined) {
            document.getElementById('current-balance').textContent = `$${parseFloat(data.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        }
        if (data.sessionPL !== undefined) {
            const el = document.getElementById('session-pl');
            const val = parseFloat(data.sessionPL);
            el.textContent = (val >= 0 ? '+' : '') + `$${val.toFixed(2)}`;
            el.className = val >= 0 ? 'pl-positive' : 'pl-negative';
        }
        if (data.attackLevel !== undefined) {
            document.getElementById('attack-level').textContent = data.attackLevel;
        }
        if (data.maxWins !== undefined && data.maxLosses !== undefined) {
            document.getElementById('max-sequence').textContent = `${data.maxWins} / ${data.maxLosses}`;
        }
        if (data.consecutiveWins !== undefined) {
            document.getElementById('consecutive-wins').textContent = data.consecutiveWins;
        }
    }

    addTradeResult(profit) {
        const lastValue = this.history[this.history.length - 1];
        const newValue = lastValue + profit;
        this.history.push(newValue);
        this.labels.push(this.history.length - 1 + '');

        // Update Chart
        this.chart.update();

        // Add dot to sequence
        this.addSequenceDot(profit > 0);
    }

    addSequenceDot(isWin) {
        const container = document.getElementById('win-dots');
        const dot = document.createElement('div');
        dot.className = `dot-item ${isWin ? 'dot-win' : 'dot-loss'}`;
        container.appendChild(dot);

        // Keep only last 15 dots
        if (container.children.length > 15) {
            container.removeChild(container.firstChild);
        }
    }

    updateStatus(text, type = 'idle') {
        const dot = document.getElementById('status-dot');
        const label = document.getElementById('status-text');

        dot.className = `dot ${type}`;
        label.textContent = text;
    }
}
