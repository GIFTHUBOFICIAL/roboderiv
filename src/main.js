import { DerivAPI } from './deriv-api.js';
import { TradingEngine } from './trading-engine.js';
import { Dashboard } from './dashboard.js';

const TOKENS = {
    demo: '5aQsUg4jrdPlBy5',
    real: 'g8Q4VeOnXZYVtkr'
};

class App {
    constructor() {
        this.api = new DerivAPI();
        this.engine = new TradingEngine();
        this.dashboard = new Dashboard();

        this.isBotRunning = false;
        this.isTrading = false;
        this.currentAccount = 'demo'; // Default
        this.stake = 1.00;
        this.baseStake = 1.00;

        this.stats = {
            balance: 0,
            sessionPL: 0,
            attackLevel: 0,
            maxWins: 0,
            maxLosses: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.connectAndAuth();
    }

    setupEventListeners() {
        document.getElementById('account-toggle-input').addEventListener('change', (e) => {
            this.switchAccount(e.target.checked ? 'real' : 'demo');
        });

        document.getElementById('start-stop-btn').addEventListener('click', () => {
            this.toggleBot();
        });
    }

    async connectAndAuth() {
        this.dashboard.updateStatus('Conectando...', 'idle');
        try {
            await this.api.connect();
            const authResponse = await this.api.authorize(TOKENS[this.currentAccount]);

            if (authResponse.error) {
                this.dashboard.updateStatus('Erro de Autenticação', 'error');
                return;
            }

            this.dashboard.updateStatus('Conectado', 'idle');

            // Subscribe to Balance
            this.api.on('balance', (res) => {
                this.stats.balance = res.balance.balance;
                this.dashboard.updateStats({ balance: this.stats.balance });
            });
            this.api.subscribeBalance();

            // Subscribe to Ticks for R_75
            this.api.on('tick', (res) => {
                const price = res.tick.quote;
                this.engine.addTick(price);
                if (this.isBotRunning && !this.isTrading) {
                    this.checkStrategy();
                }
            });
            this.api.subscribeTicks('R_75');

        } catch (err) {
            console.error('Connection failed:', err);
            this.dashboard.updateStatus('Falha na Conexão', 'error');
        }
    }

    async switchAccount(type) {
        this.isBotRunning = false;
        this.updateBotUI();

        this.currentAccount = type;
        this.dashboard.updateStatus(`Mudando para ${type.toUpperCase()}...`, 'idle');

        // Re-init connection
        if (this.api.socket) this.api.socket.close();
        await this.connectAndAuth();
    }

    toggleBot() {
        this.isBotRunning = !this.isBotRunning;
        this.updateBotUI();

        if (this.isBotRunning) {
            this.dashboard.updateStatus('Robô Ativo - Analisando R_75', 'active');
        } else {
            this.dashboard.updateStatus('Robô Pausado', 'idle');
        }
    }

    updateBotUI() {
        const btn = document.getElementById('start-stop-btn');
        btn.textContent = this.isBotRunning ? 'DESATIVAR ROBO' : 'ATIVAR ROBO';
        btn.style.background = this.isBotRunning ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : '';
    }

    async checkStrategy() {
        const signal = this.engine.analyze();
        if (signal) {
            this.executeTrade(signal);
        }
    }

    async executeTrade(signal) {
        if (this.isTrading) return;
        this.isTrading = true;

        this.dashboard.updateStatus(`Sinal Detectado: ${signal.action}`, 'active');

        try {
            // 1. Get Proposal
            const proposal = await this.api.getPriceProposal(this.stake, 'R_75', 5, signal.action === 'CALL' ? 'CALL' : 'PUT');

            if (proposal.error) {
                throw new Error(proposal.error.message);
            }

            // 2. Buy
            const buyRes = await this.api.buyContract(proposal.proposal.id, this.stake);

            if (buyRes.error) {
                throw new Error(buyRes.error.message);
            }

            const contractId = buyRes.buy.contract_id;
            this.dashboard.updateStatus('Operação em Andamento...', 'active');

            // 3. Monitor
            this.api.on('proposal_open_contract', (res) => {
                const contract = res.proposal_open_contract;
                if (contract.is_expired) {
                    this.handleTradeResult(contract);
                    // Unsubscribe from this specific contract
                    this.api.send({ forget: res.subscription.id });
                }
            });
            this.api.subscribeContract(contractId);

        } catch (err) {
            console.error('Trade Execution Error:', err);
            this.dashboard.updateStatus('Erro na Operação', 'error');
            this.isTrading = false;
        }
    }

    handleTradeResult(contract) {
        const profit = contract.profit;
        const isWin = profit > 0;

        // Update Stats
        this.stats.sessionPL += profit;

        if (isWin) {
            this.stats.consecutiveWins++;
            this.stats.consecutiveLosses = 0;
            if (this.stats.consecutiveWins > this.stats.maxWins) this.stats.maxWins = this.stats.consecutiveWins;

            // Reset stake on win
            this.stake = this.baseStake;
            this.stats.attackLevel = 0;
        } else {
            this.stats.consecutiveLosses++;
            this.stats.consecutiveWins = 0;
            if (this.stats.consecutiveLosses > this.stats.maxLosses) this.stats.maxLosses = this.stats.consecutiveLosses;

            // Smart Martingale Recovery
            this.stake = this.engine.calculateRecoveryStake(Math.abs(this.stats.sessionPL < 0 ? this.stats.sessionPL : profit));
            this.stats.attackLevel++;
        }

        // Update UI
        this.dashboard.addTradeResult(profit);
        this.dashboard.updateStats({
            sessionPL: this.stats.sessionPL,
            attackLevel: this.stats.attackLevel,
            maxWins: this.stats.maxWins,
            maxLosses: this.stats.maxLosses,
            consecutiveWins: this.stats.consecutiveWins
        });

        this.isTrading = false;
        if (this.isBotRunning) {
            this.dashboard.updateStatus('Aguardando Próxima Oportunidade', 'active');
        }
    }
}

// Start App when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
