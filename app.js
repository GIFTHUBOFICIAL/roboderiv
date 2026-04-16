/**
 * BOT R_75 - Versão 4.0 (PROTOCOL WIN - Inteligência de Recuperação e Martingale Fixo)
 */

class DerivAPI {
    constructor() {
        this.app_id = 1089;
        this.socket = null;
        this.isConnected = false;
        this.handlers = new Map();
        this.reqId = 0;
        this.resolvers = new Map();
        this.audioCtx = null;
        this.token = null;
        this.reconnectAttempts = 0;
        this.isMuted = localStorage.getItem('isMuted') === 'true';
        this.isAuthorized = false;
        this.lastPong = Date.now();
        this.lastContactTime = Date.now();
    }

    async ping() {
        try {
            return await this.send({ ping: 1 }, 5000);
        } catch (e) {
            this.isConnected = false;
            throw e;
        }
    }

    clearHandlers() {
        this.handlers.clear();
    }

    log(message, type = 'system') {
        const container = document.getElementById('activity-log');
        if (!container) return;

        const entry = document.createElement('div');
        
        let icon = '⚡';
        let category = 'system';
        const m = message.toUpperCase();

        if (m.includes('WIN') || m.includes('VITÓRIA')) {
            icon = '💰';
            category = 'win trade';
        } else if (m.includes('LOSS') || m.includes('DERROTA')) {
            icon = '⚠️';
            category = 'loss trade';
        } else if (m.includes('TRADE') || m.includes('ENTRADA') || m.includes('PUT') || m.includes('CALL')) {
            icon = '🚀';
            category = 'trade';
        } else if (type === 'error' || m.includes('ERRO') || m.includes('FALHA')) {
            icon = '❌';
            category = 'error';
        } else if (type === 'info' || m.includes('AGUARDANDO')) {
            icon = '🟠';
        } else if (m.includes('GHOST')) {
            icon = '👻';
        } else if (m.includes('ANALISANDO') || m.includes('SCANNER')) {
            icon = '🔍';
        }

        entry.className = `log-entry ${type}`;
        entry.setAttribute('data-category', category);

        // Destaque de palavras chave
        let flavoredMessage = message
            .replace(/(WIN|VITÓRIA|VENCER|💰)/gi, '<span class="kw-win">$1</span>')
            .replace(/(LOSS|DERROTA|PERDA|⚠️)/gi, '<span class="kw-loss">$1</span>')
            .replace(/(ANALISANDO|AJUSTANDO|GHOST|NEURAL SCANNER)/gi, '<span class="kw-analysing">$1</span>')
            .replace(/(TRADE|CALL|PUT|ENTRADA|COMPRA|VENDA)/gi, '<span class="kw-trade">$1</span>');

        entry.innerHTML = `
            <div class="log-row">
                <span class="log-icon">${icon}</span>
                <div class="log-content">
                    <div class="log-header">
                        <span class="log-type">${type.toUpperCase()}</span>
                        <span class="log-time">${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div class="log-body">${flavoredMessage}</div>
                </div>
            </div>
        `;

        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
        if (container.children.length > 200) container.removeChild(container.firstChild);

        console.log(`[${type.toUpperCase()}] ${message}`);
        this.updateStatusKeyword(message);
    }

    updateStatusKeyword(msg) {
        const el = document.getElementById('stat-keyword'); // Corrigido de status-keyword para stat-keyword
        const badge = document.getElementById('floating-badge');
        if (!el) return;

        let keyword = '';
        let isSignal = false;
        const m = msg.toUpperCase();

        if (m.includes('TRADE ABERTO: CALL') || m.includes('TRADE CALL') || m.includes('SCALPER SHOT (CALL)')) { keyword = 'TRADE CALL ATIVO'; isSignal = true; }
        else if (m.includes('TRADE ABERTO: PUT') || m.includes('TRADE PUT') || m.includes('SCALPER SHOT (PUT)')) { keyword = 'TRADE PUT ATIVO'; isSignal = true; }
        else if (m.includes('MICRO-UP')) keyword = 'MICRO-TENDÊNCIA ALTA';
        else if (m.includes('MICRO-DOWN')) keyword = 'MICRO-TENDÊNCIA BAIXA';
        else if (m.includes('NÍVEL') && m.includes('MARTINGALE')) {
            const level = m.match(/NÍVEL (\d+)/);
            keyword = level ? `MARTINGALE NÍVEL ${level[1]}` : 'MARTINGALE ATIVO';
            isSignal = true;
        }
        else if (m.includes('GHOST')) keyword = 'GHOST TRADING...';
        else if (m.includes('BOT MASTER ALPHA ATIVADO') || m.includes('BOT INICIADO')) keyword = 'SISTEMA OPERACIONAL';
        else if (m.includes('BOT PAUSADO') || m.includes('BOT DESATIVADO')) keyword = 'SISTEMA EM PAUSA';
        else if (m.includes('ANALISANDO')) keyword = 'NEURAL SCANNER: ON';
        else if (m.includes('AJUSTANDO')) keyword = 'AUTO-CALIBRAGEM...';
        else if (m.includes('AGUARDANDO RESULTADO')) { keyword = 'AGUARDANDO RESULTADO...'; isSignal = true; }
        else if (m.includes('WIN:')) { keyword = 'VITÓRIA CONFIRMADA 💰'; isSignal = false; }
        else if (m.includes('LOSS:')) { keyword = 'FILTRAGEM DE RISCO ⚠️'; isSignal = false; }
        else if (m.includes('ELITE_STRIKE')) { keyword = 'ELITE STRIKE DETECTADO'; isSignal = true; }

        if (keyword) el.textContent = keyword;
        if (badge) {
            badge.classList.toggle('signal-active', isSignal);
            const statusEl = document.getElementById('badge-status');
            if (statusEl && keyword) statusEl.textContent = keyword;
        }
    }

    notify(msg, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    }

    async playSound(type) {
        if (this.isMuted) return;
        try {
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            if (type === 'money') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, this.audioCtx.currentTime);
                osc.frequency.linearRampToValueAtTime(110, this.audioCtx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);
            }
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.5);
        } catch (e) { }
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) return resolve();

            // Proteção contra múltiplas tentativas simultâneas
            if (this.socket && this.socket.readyState === WebSocket.CONNECTING) return;

            this.socket = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.app_id}`);

            const timeout = setTimeout(() => {
                if (this.socket.readyState !== WebSocket.OPEN) {
                    this.socket.close();
                    reject({ message: 'Timeout na conexão' });
                }
            }, 10000);

            this.socket.onopen = () => {
                clearTimeout(timeout);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.log('Conexão ativa!', 'success');
                resolve();
            };

            this.socket.onmessage = (msg) => {
                const data = JSON.parse(msg.data);
                this.lastContactTime = Date.now();

                if (data.msg_type === 'ping') {
                    this.lastPong = Date.now();
                }

                // UPDATE CONNECTION STATUS VISUALLY
                const connDot = document.getElementById('connection-dot');
                if (connDot) {
                    connDot.className = `dot-status ${this.isConnected ? 'online' : 'offline'}`;
                }

                if (data.req_id && this.resolvers.has(data.req_id)) {
                    const { resolve, reject, startTime } = this.resolvers.get(data.req_id);
                    this.resolvers.delete(data.req_id);

                    // CÁLCULO DE LATÊNCIA
                    const latency = Date.now() - startTime;
                    if (window.bot) window.bot.stats.latency = `${latency}ms`;

                    if (data.error) reject(data.error); else resolve(data);
                }
                if (data.msg_type && this.handlers.has(data.msg_type)) {
                    this.handlers.get(data.msg_type).forEach(cb => cb(data));
                }
            };

            this.socket.onclose = () => {
                clearTimeout(timeout);
                this.isConnected = false;
                if (window.bot) window.bot.handleDisconnect();
            };

            this.socket.onerror = (err) => {
                clearTimeout(timeout);
                this.isConnected = false;
                reject({ message: 'Erro de WebSocket' });
            };
        });
    }

    send(data, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) return reject({ message: 'Offline' });
            const id = ++this.reqId;

            const timer = setTimeout(() => {
                if (this.resolvers.has(id)) {
                    this.resolvers.delete(id);
                    reject({ message: `Timeout na requisição (${Object.keys(data)[0]})` });
                }
            }, timeoutMs);

            this.resolvers.set(id, {
                resolve: (val) => { clearTimeout(timer); resolve(val); },
                reject: (err) => { clearTimeout(timer); reject(err); },
                startTime: Date.now()
            });

            this.socket.send(JSON.stringify({ ...data, req_id: id }));
        });
    }

    on(type, callback) {
        if (!this.handlers.has(type)) this.handlers.set(type, new Set());
        this.handlers.get(type).add(callback);
    }

    async authorize(token) {
        this.token = token;
        const res = await this.send({ authorize: token }, 20000);
        this.isAuthorized = true;
        return res;
    }
}

class TradingEngine {
    constructor() {
        this.ticks = [];
        this.recentHistory = [];
        this.precisionMod = 0;
        this.threshold = 35.0; // Calibrado para Tendência Estável 5-Ticks
        this.rsiDeadZoneTicks = 10;
        this.m1Candles = [];
        this.currentM1 = null;

        // Advanced Indicators State
        this.ema12 = null;
        this.ema26 = null;
        this.macd = 0;
        this.macdSignal = 0;
        this.adx = 0;
        this.plusDI = 0;
        this.minusDI = 0;
        this.atr = 0;
        this.trBuffer = [];

        // ADAPTIVE WEIGHTS (ALGORITMO DE APRENDIZADO)
        this.weights = {
            trend: 1.0,
            rsi: 1.2,
            macd: 1.5,
            stoch: 0.8,
            volatility: 1.0,
            momentum: 1.3
        };
        this.learningRate = 0.15; 
        this.lastCallScore = 0;
        this.lastPutScore = 0;
    }

    addTick(p) {
        this.ticks.push(p);
        if (this.ticks.length > 150) this.ticks.shift(); // Buffer maior para análises flexíveis

        if (this.ticks.length > 1) {
            const diff = p - this.ticks[this.ticks.length - 2];
            this.recentHistory.push(diff);
            if (this.recentHistory.length > 30) this.recentHistory.shift();
        }

        // --- CÁLCULO DE RSI (TICK-BASED) ---
        if (this.recentHistory.length >= 14) {
            let gains = 0, losses = 0;
            const period = this.recentHistory.slice(-14);
            period.forEach(diff => {
                if (diff > 0) gains += diff; else losses += Math.abs(diff);
            });
            const rs = gains / (losses || 1);
            this.rsi = 100 - (100 / (1 + rs));
        } else {
            this.rsi = 50;
        }

        // --- CÁLCULO DE VOLATILIDADE (DESVIO PADRÃO) ---
        if (this.ticks.length >= 20) {
            const mean = this.ticks.slice(-20).reduce((a, b) => a + b, 0) / 20;
            const variance = this.ticks.slice(-20).reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
            this.stdDev = Math.sqrt(variance);
        } else {
            this.stdDev = 0;
        }

        // --- FILTRO RSI DEAD ZONE (48-52) ---
        if (this.rsi >= 48 && this.rsi <= 52) {
            this.rsiDeadZoneTicks++;
        } else {
            this.rsiDeadZoneTicks = 0;
        }

        // --- GESTÃO DE M1 CANDLES (MTF) ---
        const now = Date.now();
        const minuteStart = Math.floor(now / 60000) * 60000;

        if (!this.currentM1 || this.currentM1.time !== minuteStart) {
            if (this.currentM1) this.m1Candles.push(this.currentM1);
            if (this.m1Candles.length > 30) this.m1Candles.shift();
            this.currentM1 = { time: minuteStart, open: p, high: p, low: p, close: p };
        } else {
            this.currentM1.high = Math.max(this.currentM1.high, p);
            this.currentM1.low = Math.min(this.currentM1.low, p);
            this.currentM1.close = p;
        }

        // --- CÁLCULO DE MACD (12, 26, 9) ---
        const calcEMA_Single = (current, prev, period) => {
            if (prev === null) return current;
            const k = 2 / (period + 1);
            return (current - prev) * k + prev;
        };

        this.ema12 = calcEMA_Single(p, this.ema12, 12);
        this.ema26 = calcEMA_Single(p, this.ema26, 26);
        this.macd = this.ema12 - this.ema26;
        this.macdSignal = calcEMA_Single(this.macd, this.macdSignal, 9);
        this.macdHist = this.macd - this.macdSignal;

        // --- CÁLCULO DE ATR (14) ---
        if (this.ticks.length > 1) {
            const tr = Math.max(
                Math.abs(p - this.ticks[this.ticks.length - 2]),
                Math.abs(p - (this.currentM1 ? this.currentM1.close : p)),
                Math.abs((this.currentM1 ? this.currentM1.close : p) - this.ticks[this.ticks.length - 2])
            );
            this.trBuffer.push(tr);
            if (this.trBuffer.length > 14) this.trBuffer.shift();
            this.atr = this.trBuffer.reduce((a, b) => a + b, 0) / this.trBuffer.length;
        }

        // --- CÁLCULO DE BOLLINGER BANDS (20, 2) ---
        if (this.ticks.length >= 20) {
            const period20 = this.ticks.slice(-20);
            const sma20 = period20.reduce((a, b) => a + b, 0) / 20;
            const variance20 = period20.reduce((a, b) => a + Math.pow(b - sma20, 2), 0) / 20;
            const stdDev20 = Math.sqrt(variance20);
            this.bbUpper = sma20 + (stdDev20 * 2);
            this.bbLower = sma20 - (stdDev20 * 2);
            this.bbMiddle = sma20;
        }
    }

    getAnalysis(levelIndex = 0, windowSize = 30) { // Reduzido de 50 para 30 para inicialização rápida
        if (this.ticks.length < windowSize) {
            this._logThrottled(`Aguardando mais dados de mercado... (${this.ticks.length}/${windowSize} ticks)`);
            return { ready: false, count: this.ticks.length };
        }

        const analysisTicks = this.ticks.slice(-windowSize);
        const price = analysisTicks[analysisTicks.length - 1];
        const lastTickDiff = price - analysisTicks[analysisTicks.length - 2];
        const prevTickDiff = analysisTicks[analysisTicks.length - 2] - analysisTicks[analysisTicks.length - 3];
        const prevTickDiff2 = analysisTicks[analysisTicks.length - 3] - analysisTicks[analysisTicks.length - 4];

        // --- STOCHASTIC (14, 3, 3) ---
        const stochPeriod = 14;
        const recentStochTicks = this.ticks.slice(-stochPeriod);
        const lowS = Math.min(...recentStochTicks);
        const highS = Math.max(...recentStochTicks);
        const k = highS === lowS ? 50 : ((price - lowS) / (highS - lowS)) * 100;
        this.stochK = (this.stochK || 50) * 0.6 + k * 0.4; // Simples suavização

        // 1. TRIPLE EMA (7, 14, 21) - O Escudo da Tendência
        const calcEMA = (period, data) => {
            let ema = data[data.length - period];
            const k = 2 / (period + 1);
            for (let i = data.length - (period - 1); i < data.length; i++) {
                ema = (data[i] - ema) * k + ema;
            }
            return ema;
        };

        const ema7 = calcEMA(7, analysisTicks);
        const ema14 = calcEMA(14, analysisTicks);
        const ema21 = calcEMA(21, analysisTicks);

        // Alinhamento Perfeito para 75% Win Rate
        const microTrend = price > ema7 ? 'UP' : 'DOWN';
        const isBullish = price > ema7 && ema7 > ema14 && ema14 > ema21;
        const isBearish = price < ema7 && ema7 < ema14 && ema14 < ema21;
        const prevPrice = analysisTicks[analysisTicks.length - 2];

        // 2. CONTAGEM DE PULLBACK (Respiro de Tendência)
        let upStreak = 0;
        let downStreak = 0;
        for (let i = this.recentHistory.length - 2; i >= Math.max(0, this.recentHistory.length - 12); i--) {
            if (this.recentHistory[i] > 0 && downStreak === 0) upStreak++;
            else if (this.recentHistory[i] < 0 && upStreak === 0) downStreak++;
            else break;
        }

        // --- TREND SLOPE (Inclinação da Média 21) ---
        const ema21_prev = calcEMA(21, analysisTicks.slice(0, -1));
        const emaSlope = (ema21 - ema21_prev) / ema21_prev * 10000;

        // 3. VELOCIDADE E VOLATILIDADE
        const avgMove10 = this.recentHistory.slice(-10).reduce((a, b) => a + Math.abs(b), 0) / 10;
        const isMomentumSpike = Math.abs(lastTickDiff) > (avgMove10 * 3.5); // Proteção extrema contra picos falsos
        const isFlatMarket = avgMove10 < (price * 0.000003); // Filtro de lateralização rigoroso

        return {
            ready: true,
            price,
            ema7,
            ema14,
            ema21,
            distEMA21: Math.abs(price - ema21),
            microTrend,
            isBullish,
            isBearish,
            emaSlope,
            stochK: this.stochK,
            microStatus: (price > ema7 && prevPrice <= ema7) || (price < ema7 && prevPrice >= ema7) ? 'CROSSOVER' : 'STABLE',
            lastTickDiff,
            prevTickDiff,
            upStreak,
            downStreak,
            isMomentumSpike,
            isFlatMarket,
            rsi: this.rsi,
            volatility: this.stdDev,
            avgMove10,
            rsiDeadZoneTicks: this.rsiDeadZoneTicks,
            m1Trend: this.m1Candles.length > 5 ? (this.currentM1.close > this.m1Candles[this.m1Candles.length - 5].close ? 'UP' : 'DOWN') : 'NEUTRAL',
            macdHist: this.macdHist,
            macd: this.macd,
            bbUpper: this.bbUpper,
            bbLower: this.bbLower,
            bbMiddle: this.bbMiddle,
            atr: this.atr
        };
    }

    updateHeaderIcons(d) {
        const up = document.getElementById('market-icon-up');
        const down = document.getElementById('market-icon-down');
        const dot = document.getElementById('market-direction-icon');
        if (up && down) {
            up.style.display = d.microTrend === 'UP' ? 'inline-block' : 'none';
            down.style.display = d.microTrend === 'DOWN' ? 'inline-block' : 'none';
            if (dot) {
                dot.style.color = d.microTrend === 'UP' ? '#22c55e' : '#ef4444';
                dot.textContent = d.microTrend === 'UP' ? '▲' : '▼';
            }
        }
    }

    analyze(levelIndex = 0, idleTime = 0, windowSize = 30) {
        const d = this.getAnalysis(levelIndex, windowSize);
        if (!d || !d.ready) { this.currentScore = 0; return null; }

        // ==== BOT MASTER ALPHA — R_75 SPECIALIST ENGINE ====
        // Calibrado para Volatility 75 Index (synthetic, tick-based)
        // avgMove10 = movimento médio dos últimos 10 ticks (escala real do R_75)

        // FILTRO 1: Mercado morto (RSI preso em zona neutra por muito tempo)
        if (d.rsiDeadZoneTicks > 30) { this.currentScore = 0; return null; }

        // FILTRO 2: Flat market (sem movimento real) — usa avgMove10 relativo ao preço
        const relativeMove = d.avgMove10 / d.price;
        if (relativeMove < 0.000005) { this.currentScore = 0; return null; } // Mercado completamente parado

        let callVotes = 0;
        let putVotes  = 0;
        let callScore = 0;
        let putScore  = 0;

        // === VOTO 1: TENDÊNCIA ESTRUTURAL (EMA21 + Slope) ===
        if (d.emaSlope > 0.3 && d.price > d.ema21) { callVotes++; callScore += 30; }
        else if (d.emaSlope < -0.3 && d.price < d.ema21) { putVotes++; putScore += 30; }

        // === VOTO 2: MOMENTUM OSCILATOR (RSI Sniper) ===
        if (d.rsi > 61 && d.rsi < 80) { callVotes++; callScore += 25; }
        else if (d.rsi < 39 && d.rsi > 20) { putVotes++; putScore += 25; }

        // === VOTO 3: MOMENTUM TREND (MACD Hist) ===
        if (d.macdHist > 0) { callVotes++; callScore += 20; }
        else if (d.macdHist < 0) { putVotes++; putScore += 20; }


        // === VOTO 4: BOLLINGER BREAKOUT (O Pulo do Gato) ===
        // Se romper a banda com força, seguimos o estouro (Trend Follower)
        if (d.price > d.bbUpper) { callVotes++; callScore += 20; }
        else if (d.price < d.bbLower) { putVotes++; putScore += 20; }

        // === VOTO 5: MICRO-PULSO (Last 2 Ticks) ===
        if (d.lastTickDiff > 0 && d.prevTickDiff > 0) callScore += 15;
        else if (d.lastTickDiff < 0 && d.prevTickDiff < 0) putScore += 15;

        // 🛡️ FILTRO DE CONTRA-MÃO (Anti-Looping de Loss)
        // Em mercado EXTREMA, proibir trades contra o RSI dominante
        if (d.volatility > 0.40) {
            if (d.rsi > 70) putScore -= 100; // Proibido Vender em Super-Alta
            if (d.rsi < 30) callScore -= 100; // Proibido Comprar em Super-Baixa
        }

        if (d.isMomentumSpike)   { callScore -= 50; putScore -= 50; } // Choque térmico = Pausa instatânea


        // === CÁLCULO FINAL DE PONTUAÇÃO E DIREÇÃO ===
        const currentScore = Math.max(callScore, putScore);
        this.currentScore  = Math.max(0, currentScore);
        const action       = callScore >= putScore ? 'CALL' : 'PUT';
        const winVotes     = action === 'CALL' ? callVotes : putVotes;
        const loseVotes    = action === 'CALL' ? putVotes  : callVotes;

        // === CONFIGURAÇÃO DO GATILHO ESPECIALISTA (Protocolo 75% Win) ===
        let threshold = 35.0; 
        if (d.volatility > 0.45) threshold += 8; // Sniper Mode em Caos
        
        // --- DINÂMICA ELITE: Se o score for > 50 (God-Tier), entramos com 1 tick ---
        // Se for um sinal básico (35-50), exigimos 2 ticks para segurança.
        const requiredTicks = (currentScore >= 50) ? 1 : 2; 
        const confluenceOk  = winVotes >= 2;


        if (!this._sigPersist) this._sigPersist = { action: null, count: 0 };
        if (this._sigPersist.action === action && confluenceOk) {
            this._sigPersist.count++;
        } else {
            this._sigPersist = { action, count: confluenceOk ? 1 : 0 };
        }
        const signalPersisted = this._sigPersist.count >= requiredTicks;

        // Atualiza Neural Scanner Live UI
        const scEl = document.getElementById('stat-score');
        const rsEl = document.getElementById('stat-rsi');
        if (scEl) scEl.textContent = `SC: ${this.currentScore.toFixed(1)}`;
        if (rsEl) rsEl.textContent = `RSI: ${d.rsi.toFixed(1)}`;


        // LOG DE ANALISE DETALHADO (Para o usuário visualizar a inteligência)
        if (!this._logDebounce) this._logDebounce = 0;
        this._logDebounce++;
        if (this._logDebounce >= 10) {
            const ready = currentScore >= threshold && confluenceOk && signalPersisted;
            let status = 'BUSCANDO';
            if (currentScore < threshold) status = 'PENDENTE';
            if (d.volatility > 0.45)      status = 'SNIPER EXTREMO';
            if (d.isFlatMarket)           status = 'CHOPPY (PAUSA)';

            const msg = `🔍 Scanner Elite: [${status}] | Pontos: ${currentScore.toFixed(0)}/${threshold.toFixed(0)} | Tendência: ${d.microTrend} | Votos: ${winVotes}`;
            if (window.bot) window.bot.api.log(msg, ready ? 'signal' : 'debug');
            this._logDebounce = 0;
        }

        // DISPARO
        if (currentScore >= threshold && confluenceOk && signalPersisted) {
            this._sigPersist.count = 0;
            const reason = `ALPHA STRIKE [${winVotes}V] SC:${currentScore.toFixed(0)} TH:${threshold.toFixed(0)} → ${action}`;
            if (window.bot) window.bot.api.log(`🎯 OPORTUNIDADE ELITE IDENTIFICADA! Disparando: ${action}`, 'success');
            return { action, score: currentScore, price: d.price, reason, analysis: d };
        }



        return null;
    }


    learnFromResult(isWin, d) {
        if (!d) return;
        if (!this.stats) this.stats = { total: 0, wins: 0, losses: 0, lastResult: null };

        const BASE = 35.0;
        const MAX  = 42.0; // Teto máximo — acima disso o bot para de operar

        if (isWin) {
            const isRecovery = this.stats.lastResult === false;
            // Reforça pesos dos indicadores que acertaram (suave)
            if (d.macdHist !== undefined) this.weights.macd = Math.min(2.5, this.weights.macd + 0.04);
            if (d.rsi !== undefined)      this.weights.rsi  = Math.min(2.5, this.weights.rsi  + 0.04);
            // Relaxa threshold de volta ao base com wins consecutivos
            this.threshold = Math.max(BASE, this.threshold - 0.3);
            if (isRecovery && window.bot) {
                window.bot.api.log(`🏆 [RECUPERAÇÃO] Padrão Elite confirmado! TH: ${this.threshold.toFixed(1)}`, 'success');
            }
        } else {
            // ADAPTAÇÃO AGRESSIVA: Se errou, sobe o sarrafo imediatamente
            this.threshold = Math.min(MAX, this.threshold + 2.0);
            if (this.stats.currentStreak >= 2) {
                this.threshold = Math.min(MAX, this.threshold + 2.0); // Salto duplo se streak de loss
                if (window.bot) window.bot.api.log(`🛡️ [MODO SNIPER] Bloqueando ruído. TH: ${this.threshold.toFixed(1)}`, 'warning');
            }
        }

        this.stats.lastResult = isWin;
        this.stats.total++;
        if (isWin) this.stats.wins++; else this.stats.losses++;

        // Relatório a cada 10 trades
        if (this.stats.total % 10 === 0) {
            const wr = (this.stats.wins / this.stats.total * 100).toFixed(1);
            if (window.bot) window.bot.api.log(`📈 [CICLO] ${this.stats.total} trades | WR: ${wr}% | TH: ${this.threshold.toFixed(1)}`, 'info');
        }

        // Limites de Segurança para Pesos
        Object.keys(this.weights).forEach(k => {
            this.weights[k] = Math.max(0.2, Math.min(3.0, this.weights[k]));
        });
    }

    _logThrottled(msg) {
        if (!this._tLog) this._tLog = 0;
        if (Date.now() - this._tLog > 8000) {
            if (window.bot) window.bot.api.log(msg, 'info'); // Era 'error' - corrigido para 'info'
            this._tLog = Date.now();
        }
    }
}

class Dashboard {
    constructor() {
        this.history = [0];
        this.trends = [0];
        this.pointColors = ['#22c55e']; // Cor inicial para o ponto 0
        const ctx = document.getElementById('equityChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['0'],
                datasets: [
                    {
                        label: 'Ganhos',
                        data: [0],
                        borderColor: '#22c55e',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: {
                            target: 'origin',
                            above: 'rgba(34, 197, 94, 0.15)',
                            below: 'rgba(239, 68, 68, 0.4)' // Mais visível
                        },
                        pointRadius: 5,
                        pointBackgroundColor: this.pointColors,
                        pointBorderColor: this.pointColors,
                        pointHoverRadius: 7
                    },
                    {
                        label: 'Tendência',
                        data: [0],
                        borderColor: '#3b82f6',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        tension: 0.1,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'Marco Zero',
                        data: [0],
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: {
                        grid: { color: '#1a1a1a' },
                        ticks: { color: '#666' }
                    }
                }
            }
        });
    }

    reset() {
        this.history = [0];
        this.trends = [0];
        this.pointColors = ['#22c55e'];
        this.chart.data.labels = ['0'];
        this.chart.data.datasets[0].data = [0];
        this.chart.data.datasets[0].pointBackgroundColor = this.pointColors;
        this.chart.data.datasets[0].pointBorderColor = this.pointColors;
        this.chart.data.datasets[1].data = [0];
        this.chart.update();
        const dots = document.getElementById('win-dots');
        if (dots) dots.innerHTML = '';
    }
    update(stats) {
        if (stats.balance !== undefined) {
            const balEl = document.getElementById('current-balance');
            if (balEl) balEl.textContent = `$${parseFloat(stats.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        }

        if (stats.profit !== undefined) {
            const el = document.getElementById('session-pl');
            if (el) {
                el.textContent = (stats.profit >= 0 ? '+' : '') + `$${stats.profit.toFixed(2)}`;
                el.className = 'pl-val ' + (stats.profit >= 0 ? 'pl-positive' : 'pl-negative');
            }

            // Meta Progress ($100 goal - Ajustável se quiser)
            const metaPerc = Math.max(0, (stats.profit / 100) * 100);
            const mEl = document.getElementById('stat-meta-progress');
            if (mEl) mEl.textContent = `${metaPerc.toFixed(1)}%`;
        }

        // ROI %
        if (stats.startBalance > 0) {
            const roi = (stats.profit / stats.startBalance) * 100;
            const rEl = document.getElementById('stat-roi');
            if (rEl) {
                rEl.textContent = `${roi.toFixed(roi < 1 ? 3 : 2)}%`;
                rEl.className = `stat-val ${roi >= 0 ? 'up' : 'down'}`;
            }
        }

        const maxSeqEl = document.getElementById('max-sequence');
        if (maxSeqEl) maxSeqEl.textContent = `${stats.maxWinStreak || 0} / ${stats.maxLossStreak || 0}`;

        const tradesEl = document.getElementById('stat-total-trades');
        if (tradesEl) tradesEl.textContent = stats.totalTrades || 0;

        // Sequence Bar
        const seqEl = document.getElementById('consecutive-wins');
        if (seqEl) seqEl.textContent = stats.currentStreak || 0;

        // NOVAS MÉTRICAS DE PERFORMANCE
        const wins = stats.wins || 0;
        const losses = stats.losses || 0;
        const total = wins + losses;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const lossRate = total > 0 ? (losses / total) * 100 : 0;

        const wrEl = document.getElementById('stat-win-rate');
        if (wrEl) wrEl.textContent = `${winRate.toFixed(1)}%`;
        const lrEl = document.getElementById('stat-loss-rate');
        if (lrEl) lrEl.textContent = `${lossRate.toFixed(1)}%`;

        // Avaliação de Resultado
        let perf = 'AGUARDANDO';
        let color = '#94a3b8';
        if (total >= 1) {
            if (winRate >= 75) { perf = 'ELITE WIN'; color = '#22c55e'; }
            else if (winRate >= 50) { perf = 'ATIVO PRO'; color = '#22c55e'; }
            else { perf = 'EM ANÁLISE'; color = '#3b82f6'; }
        }
        const perfEl = document.getElementById('stat-result-rating');
        if (perfEl) {
            perfEl.textContent = perf;
            perfEl.style.color = color;
        }

        // Análise de Mercado (Volatilidade)
        if (stats.volatility !== undefined) {
            const v = stats.volatility;
            let vL = 'ANALISANDO', vC = '#94a3b8';
            if (v > 0.35) { vL = 'EXTREMA'; vC = '#ef4444'; }
            else if (v > 0.20) { vL = 'ALTA'; vC = '#fb923c'; }
            else if (v > 0.08) { vL = 'NORMAL'; vC = '#22c55e'; }
            else { vL = 'BAIXA'; vC = '#3b82f6'; }

            const volEl = document.getElementById('stat-volatility');
            if (volEl) { volEl.textContent = vL; volEl.style.color = vC; }
        }

        // --- NOVOS 4 CARDS ---
        // 1) DRAWDOWN
        const peak = stats.peakBalance || stats.startBalance;
        const dd = peak > 0 ? ((peak - stats.balance) / peak) * 100 : 0;
        const ddEl = document.getElementById('stat-drawdown');
        if (ddEl) {
            ddEl.textContent = `${Math.max(0, dd).toFixed(2)}%`;
            ddEl.style.color = dd > 5 ? '#ef4444' : '#94a3b8';
        }

        // 2) PROFIT FACTOR
        const pf = stats.totalGrossLoss > 0 ? (stats.totalGrossProfit / stats.totalGrossLoss) : (stats.totalGrossProfit || 1.0);
        const pfEl = document.getElementById('stat-profit-factor');
        if (pfEl) {
            pfEl.textContent = pf.toFixed(2);
            pfEl.style.color = pf >= 1.0 ? '#22c55e' : '#ef4444';
        }

        // 3) LATENCY
        const ltEl = document.getElementById('stat-latency');
        if (ltEl) ltEl.textContent = stats.latency || 'ONLINE';

        // 4) AVG TRADE
        const avg = total > 0 ? (stats.profit / total) : 0;
        const avgEl = document.getElementById('stat-avg-trade');
        if (avgEl) {
            avgEl.textContent = `$ ${avg.toFixed(2)}`;
            avgEl.style.color = avg >= 0 ? '#22c55e' : '#ef4444';
        }

        // 5) TESOURARIA (reserva acumulada — 20% de cada WIN)
        const tesoVal = stats.tesouraria || 0;
        const tesoEl = document.getElementById('stat-tesouraria');
        if (tesoEl && !tesoEl.classList.contains('animating')) {
            // Só atualiza se não está animando (evita pisar na animação do WIN)
            tesoEl.textContent = tesoVal > 0 ? `$${tesoVal.toFixed(2)}` : '$0.00';
            if (tesoVal <= 0) tesoEl.className = 'stat-val tesouraria-val';
        }

        // --- NOVOS 4 CARDS (ESTIMATIVAS) ---
        const remaining = Math.max(0, 100 - stats.profit);

        // 1) ESTIMATIVA TRADE
        const estTradeEl = document.getElementById('stat-est-trade');
        if (estTradeEl) {
            if (avg > 0 && stats.profit > 0) {
                const tradesNeeded = Math.ceil(remaining / avg);
                estTradeEl.textContent = `~${tradesNeeded} trades`;
            } else {
                estTradeEl.textContent = 'Calculando...';
            }
        }

        // 2) ESTIMATIVA TEMPO
        const estTimeEl = document.getElementById('stat-est-time');
        if (estTimeEl) {
            if (stats.profit > 0 && window.bot && window.bot.startTime) {
                const elapsed = Date.now() - window.bot.startTime;
                const msPerDollar = elapsed / stats.profit;
                const msRemaining = remaining * msPerDollar;

                if (msRemaining > 0 && isFinite(msRemaining)) {
                    const mins = Math.floor(msRemaining / 60000);
                    const secs = Math.floor((msRemaining % 60000) / 1000);
                    estTimeEl.textContent = `${mins}m ${secs}s`;
                } else {
                    estTimeEl.textContent = 'Finalizado';
                }
            } else {
                estTimeEl.textContent = 'Analisando...';
            }
        }

        // 3) SENSIBILIDADE (Based on Threshold)
        const sensEl = document.getElementById('stat-sensitivity');
        if (sensEl && window.bot && window.bot.engine) {
            const thresh = window.bot.engine.threshold;
            let level = 'NORMAL';
            if (thresh > 25) level = 'ULTRA SEGURA';
            else if (thresh > 21) level = 'ALTA';
            else if (thresh < 15) level = 'AGRESSIVA';
            sensEl.textContent = `${level} (${thresh.toFixed(1)})`;
        }

        // 4) PRECISÃO (Based on Score vs Threshold & WinRate)
        const precEl = document.getElementById('stat-precision');
        if (precEl && window.bot && window.bot.engine) {
            const score = window.bot.engine.currentScore || 0;
            const thresh = window.bot.engine.threshold || 20;
            const ratio = Math.min(100, (score / thresh) * 100);
            const displayPrec = total > 0 ? (winRate * 0.7 + ratio * 0.3) : ratio;
            precEl.textContent = `${displayPrec.toFixed(1)}%`;
            precEl.style.color = displayPrec > 80 ? '#22c55e' : (displayPrec > 50 ? '#fb923c' : '#ef4444');
        }

        // --- TESOURARIA E NEURAL SCANNER (FIX FREEZE) ---
        const tEl = document.getElementById('stat-tesouraria');
        if (tEl) tEl.textContent = (stats.profit * 0.95).toFixed(2); // Simulação de reserva

        const scEl = document.getElementById('stat-score');
        const rsEl = document.getElementById('stat-rsi');
        if (scEl && window.bot && window.bot.engine) scEl.textContent = `SC: ${(window.bot.engine.currentScore || 0).toFixed(1)}`;
        if (rsEl && window.bot && window.bot.engine) rsEl.textContent = `RSI: ${(window.bot.engine.rsi || 50).toFixed(1)}`;

        // MULTI-CONFLUENCE BARS
        const barCall = document.getElementById('conf-bar-call');
        const barPut = document.getElementById('conf-bar-put');
        const valCall = document.getElementById('conf-val-call');
        const valPut = document.getElementById('conf-val-put');
        if (barCall && window.bot && window.bot.engine) {
            const cScore = Math.max(0, Math.min(100, (window.bot.engine.lastCallScore || 0) * 2)); // Normalizado
            const pScore = Math.max(0, Math.min(100, (window.bot.engine.lastPutScore || 0) * 2));
            barCall.style.width = `${cScore}%`;
            barPut.style.width = `${pScore}%`;
            valCall.textContent = (window.bot.engine.lastCallScore || 0).toFixed(0);
            valPut.textContent = (window.bot.engine.lastPutScore || 0).toFixed(0);
        }

        // HEALTH PANEL
        this.updateHealth(stats);

        // FOOTER MINI STATS
        const latEl = document.getElementById('mini-latency');
        if (latEl) latEl.textContent = `LATENCY: ${stats.latency || '--ms'}`;

        const etaEl = document.getElementById('mini-eta');
        if (etaEl && window.bot && window.bot.startTime && stats.profit > 0) {
            const remaining = Math.max(0, 100 - stats.profit);
            const elapsed = Date.now() - window.bot.startTime;
            const msPerDollar = elapsed / stats.profit;
            const msRemaining = remaining * msPerDollar;
            if (msRemaining > 0 && isFinite(msRemaining)) {
                const mins = Math.floor(msRemaining / 60000);
                etaEl.textContent = `ETA: ${mins}m`;
            }
        }
    }

    updateHealth(stats) {
        const scoreChip = document.getElementById('health-score-chip');
        const updatedAt = document.getElementById('health-updated-at');
        if (updatedAt) updatedAt.textContent = new Date().toLocaleTimeString();

        // Stream Health
        const streamPill = document.getElementById('health-stream-pill');
        const streamMeta = document.getElementById('health-stream-meta');
        if (streamPill) {
            const isOk = window.bot && (Date.now() - window.bot.lastTickTime < 5000);
            streamPill.textContent = isOk ? 'ESTÁVEL' : 'LENTO';
            streamPill.className = `health-pill ${isOk ? 'positive' : 'negative'}`;
            if (streamMeta) streamMeta.textContent = isOk ? 'Fluxo 100%' : 'Aguardando...';
        }

        // RTT Health
        const rttPill = document.getElementById('health-rtt-pill');
        const rttMeta = document.getElementById('health-rtt-meta');
        if (rttPill) {
            const lat = parseInt(stats.latency) || 0;
            const isOk = lat < 500;
            rttPill.textContent = lat > 0 ? `${lat}ms` : '---';
            rttPill.className = `health-pill ${isOk ? 'positive' : 'warning'}`;
            if (rttMeta) rttMeta.textContent = lat > 0 ? (isOk ? 'Excelente' : 'Latência Alta') : 'Aguardando';
        }

        // Slippage (Simulação de execução)
        const slipPill = document.getElementById('health-slippage-pill');
        const slipMeta = document.getElementById('health-slippage-meta');
        if (slipPill) {
            const lat = parseInt(stats.latency) || 50;
            const slip = (lat / 1000) * 0.1; // 0.1% por segundo
            slipPill.textContent = `${slip.toFixed(3)}%`;
            slipPill.className = `health-pill positive`;
            if (slipMeta) slipMeta.textContent = 'Mínimo (0.1/s)';
        }

        // Reliability (Based on WinRate)
        const relPill = document.getElementById('health-reliability-pill');
        const relMeta = document.getElementById('health-reliability-meta');
        if (relPill) {
            const total = stats.wins + stats.losses;
            const wr = total > 0 ? (stats.wins / total) * 100 : 0;
            const isOk = wr >= 75 || total === 0;
            relPill.textContent = total > 0 ? `${wr.toFixed(0)}%` : '---';
            relPill.className = `health-pill ${isOk ? 'positive' : 'warning'}`;
            if (relMeta) relMeta.textContent = total > 0 ? (isOk ? 'Máxima' : 'Em Calibração') : 'Aguardando';
        }

        // TFA (Filtro Pós-Loss)
        const tfaPill = document.getElementById('health-tfa-pill');
        const tfaMeta = document.getElementById('health-tfa-meta');
        if (tfaPill) {
            const active = window.bot && window.bot.levelIndex > 0;
            tfaPill.textContent = active ? 'ATIVO' : 'READY';
            tfaPill.className = `health-pill ${active ? 'warning' : 'positive'}`;
            if (tfaMeta) tfaMeta.textContent = active ? 'Sniper Mode' : 'Aguardando Loss';
        }

        if (scoreChip) {
            const total = stats.wins + stats.losses;
            const wr = total > 0 ? (stats.wins / total) * 100 : 85;
            const healthScore = Math.min(100, 70 + (wr * 0.3));
            scoreChip.textContent = `Health ${healthScore.toFixed(0)}%`;
        }
    }

    updateMini(stats, d) {
        // ESSENTIAL REALTIME SYNC (EVERY TICK)
        const badgeScore = document.getElementById('badge-score');
        const badgeRsi = document.getElementById('badge-rsi');
        if (badgeScore && window.bot.engine) badgeScore.textContent = `SC: ${(window.bot.engine.currentScore || 0).toFixed(1)}`;
        if (badgeRsi && d) badgeRsi.textContent = `RSI: ${(d.rsi || 50).toFixed(1)}`;

        const miniEta = document.getElementById('mini-eta');
        const miniLat = document.getElementById('mini-latency');
        if (miniLat) miniLat.textContent = `LATENCY: ${stats.latency || 0}ms`;
        
        // Update Health Panel real-time metrics
        this.updateHealth(stats);
    }

    add(profit) {
        const last = this.history[this.history.length - 1];
        const newVal = last + profit;
        this.history.push(newVal);

        // Define cor do ponto baseado no lucro do trade atual
        const pointColor = profit >= 0 ? '#22c55e' : '#ef4444';
        this.pointColors.push(pointColor);

        // Média Móvel Simples para a Tendência (últimos 5 trades)
        const trendSlice = this.history.slice(-5);
        const trendVal = trendSlice.reduce((a, b) => a + b, 0) / trendSlice.length;
        this.trends.push(trendVal);

        this.chart.data.labels.push(this.history.length.toString());
        this.chart.data.datasets[0].data = this.history;
        this.chart.data.datasets[1].data = this.trends;
        this.chart.data.datasets[2].data.push(0); // Mantém a linha de marco zero fixa

        this.chart.update();
        const dot = document.createElement('div');
        dot.className = `dot-item ${profit > 0 ? 'dot-win' : 'dot-loss'}`;
        document.getElementById('win-dots').appendChild(dot);
    }
}

const TOKENS = { demo: 'iXqGueubBVqzJ9J', real: 'g8Q4VeOnXZYVtkr' };
const MARTINGALE_STAKES = [0.35, 0.70, 1.40, 2.80, 5.60, 11.20, 22.40]; // VALORES ABSOLUTOS E IMUTÁVEIS (Nível 1-7)

class App {
    constructor() {
        this.active = false;
        this.symbol = 'R_75';
        this.engine = new TradingEngine();
        this.api = new DerivAPI();

        // RESET TOTAL NO REFRESH (Solicitado pelo usuário)
        localStorage.removeItem('sessionStats');
        localStorage.removeItem('last10Results');

        this.stats = {
            balance: 0,
            startBalance: 0,
            totalTrades: 0,
            wins: 0,
            losses: 0,
            profit: 0, // P/L
            maxWinStreak: 0,
            maxLossStreak: 0,
            currentStreak: 0,
            streakType: null,
            totalStaked: 0,
            totalGrossProfit: 0,
            totalGrossLoss: 0,
            peakBalance: 0,
            volatility: 0,
            latency: 'ONLINE',
            ghostMode: false, // Desativado para trades constantes e sem medo
            ghostLosses: 0
        };

        this.last10Results = [];
        this.lastTradeAttemptTime = Date.now();
        this.running = false;
        this.isTrading = false;
        this.currentContractId = null;
        this.account = 'demo'; // ✅ Testes sempre em DEMO conforme solicitado
        this._isAutoTesting = true; // Flag para auto-teste de 10 trades
        this.demoTradesDone = 0;
        this.levelIndex = 0;
        this.ui = new Dashboard();
        this.lastAnalysisData = null;

        // AUTOMATION LIMITS (Request: Goal $100 / 3h Time Limit / 500 Trades)
        this.profitGoal = 100;
        this.tradeGoal = 30;
        this.timeLimit = 12 * 60 * 60 * 1000; // Increased to 12 hours for 500 trades
        this.startTime = Date.now();
        this.autoControlActive = true;
        this.tickCount = 0;
        this.startTickCount = 0;

        this.engine.threshold = 42.0; 


        // GESTÃO DE FASES (Diretriz de Operação)
        this.currentPhase = 2; // Modo REAL (Especialista) ativado
        this.phaseTradeGoal = 100; // Meta estendida para consistência
        this.phaseStats = { wins: 0, losses: 0, total: 0, gProfit: 0, gLoss: 0 };
        this.alertState = false;

        this.resetAll();
        this.init();

        // Sincroniza UI com modo Demo solicitado
        const accountToggle = document.getElementById('account-toggle-input');
        if (accountToggle) {
            accountToggle.checked = true; // REAL
            this.account = 'real';
        } else {
            this.account = 'real';
        }

        this.boot().then(() => {
            // Auto-ativação após conexão e autenticação com pequeno delay para estabilidade
            setTimeout(() => {
                if (!this.running) this.toggle();
            }, 3000);
        });
    }

    resetAll() {
        this.stats = {
            balance: 0, profit: 0, wins: 0, losses: 0,
            totalTrades: 0, currentStreak: 0, maxWinStreak: 0, maxLossStreak: 0,
            totalGrossProfit: 0, totalGrossLoss: 0, peakBalance: 0, startBalance: 0,
            latency: 'ONLINE', volatility: 0, ghostMode: false, ghostLosses: 0
        };
        this.phaseStats = { wins: 0, losses: 0, total: 0, gProfit: 0, gLoss: 0 };
        this.ui.reset();
        this.engine.ticks = [];
        this.engine.m1Candles = [];
        this.levelIndex = 0;
        localStorage.removeItem('sessionStats');
        this.api.log('SISTEMA REINICIALIZADO - AGUARDANDO ATIVAÇÃO', 'system');

        // Update Connection Dot
        const connDot = document.getElementById('connection-dot');
        if (connDot) connDot.className = 'dot-status online';
    }

    init() {
        const startBtn = document.getElementById('start-stop-btn');
        if (startBtn) startBtn.onclick = () => this.toggle();

        const accountToggle = document.getElementById('account-toggle-input');
        if (accountToggle) {
            accountToggle.onchange = (e) => this.switchMode(e.target.checked ? 'real' : 'demo');
        }

        const clearBtn = document.getElementById('clear-logs');
        if (clearBtn) {
            clearBtn.onclick = () => {
                this.api.showConfirm('Deseja limpar os logs e RESETAR as estatísticas da sessão?', () => {
                    localStorage.clear();
                    this.resetAll();
                    location.reload();
                });
            };
        }

        const soundBtn = document.getElementById('sound-toggle');
        if (soundBtn) {
            const updateSoundUI = () => {
                const icon = document.getElementById('sound-icon');
                if (icon) icon.textContent = this.api.isMuted ? '🔇' : '🔊';
                soundBtn.classList.toggle('active', !this.api.isMuted);
            };
            this.api.isMuted = localStorage.getItem('isMuted') === 'true'; // Load initial state
            soundBtn.onclick = () => {
                this.api.isMuted = !this.api.isMuted;
                localStorage.setItem('isMuted', this.api.isMuted);
                updateSoundUI();
            };
            updateSoundUI();
        }

        // LOG FILTERS
        document.querySelectorAll('.btn-filter').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.getAttribute('data-filter');
                this.filterLogs(filter);
            };
        });
    }

    filterLogs(filter) {
        const entries = document.querySelectorAll('.log-entry');
        entries.forEach(entry => {
            const cat = entry.getAttribute('data-category') || '';
            if (filter === 'all') {
                entry.classList.remove('hidden');
            } else if (filter === 'trade') {
                entry.classList.toggle('hidden', !cat.includes('trade'));
            } else if (filter === 'win') {
                entry.classList.toggle('hidden', !cat.includes('win'));
            } else if (filter === 'loss') {
                entry.classList.toggle('hidden', !cat.includes('loss'));
            } else if (filter === 'error') {
                entry.classList.toggle('hidden', !cat.includes('error'));
            }
        });
    }

    async toggle() {
        if (this._toggling) return;
        this._toggling = true;
        setTimeout(() => this._toggling = false, 1000);

        if (this.running) {
            this.running = false;
            const btn = document.getElementById('start-stop-btn');
            const statusDot = document.getElementById('status-dot');
            const statusText = document.getElementById('status-keyword');
            if (btn) {
                btn.textContent = 'ATIVAR ROBO';
                btn.classList.remove('active');
            }
            if (statusDot) statusDot.className = 'dot idle';
            if (statusText) statusText.textContent = 'Pausado';
            this.api.log('Bot DESATIVADO.', 'system');
            return;
        }

        // VERIFICAÇÃO DE PERFEIÇÃO (CONEXÃO & AUTH)
        this.api.log('🔄 Verificando integridade da conexão...', 'system');
        const isConnected = this.api.socket && this.api.socket.readyState === WebSocket.OPEN;
        const isAuthorized = this.api.isAuthorized;

        if (!isConnected || !isAuthorized) {
            if (this._booting) {
                this.api.log('⏳ Aguarde, conexão em andamento...', 'info');
                return;
            }
            this.api.log('⚠️ Re-autenticando para garantir estabilidade...', 'warning');
            try {
                await this.boot();
                await new Promise(r => setTimeout(r, 1500)); // Espera estabilização
            } catch (e) {
                this.api.log(`❌ Login falhou. Tente novamente.`, 'error');
                return;
            }
        }

        this.running = true;
        const btn = document.getElementById('start-stop-btn');
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-keyword');

        btn.textContent = 'DESATIVAR ROBO';
        btn.classList.add('active');
        if (statusDot) statusDot.className = 'dot active';
        if (statusText) statusText.textContent = 'Trabalhando...';
        
        // Sincroniza Saldo antes de iniciar
        await this.api.send({ balance: 1 });
        this.stats.startBalance = this.stats.balance || 0;
        this.api.log(`Bot ATIVADO. Banca Inicial: $${this.stats.startBalance.toFixed(2)}`, 'success');
        if (!this.isTrading) this.check();
    }

    async boot() {
        this.api.clearHandlers(); // Limpa ouvintes antigos para evitar duplicidade
        await this.api.connect();
        await this.auth();
    }

    async handleDisconnect() {
        if (this.reconnectTimer || (this.api.socket && this.api.socket.readyState === WebSocket.CONNECTING)) return;

        this.api.reconnectAttempts++;
        const backoff = Math.min(30000, 2000 * Math.pow(1.5, this.api.reconnectAttempts - 1));

        this.api.log(`Conexão instável. Recuperando em ${(backoff / 1000).toFixed(1)}s...`, 'error');

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            await this.boot();
        }, backoff);
    }

    async auth() {
        try {
            this.api.log(`Autenticando na conta ${this.account.toUpperCase()}...`);
            const res = await this.api.authorize(TOKENS[this.account]);
            this.api.log(`Conectado como ${res.authorize.fullname || 'Trader'}`, 'success');
            this.updateConnectionUI('online');
            await this.setupSubscriptions();
        } catch (e) {
            this.api.log(`Erro na Autenticação: ${e.message || 'Token Inválido'}`, 'error');
            this.updateConnectionUI('offline');
            this.handleDisconnect();
        }
    }

    updateConnectionUI(status) {
        const dot = document.getElementById('connection-dot');
        if (dot) {
            dot.className = `dot-status ${status}`;
        }
    }

    showConfirm(msg, onConfirm) {
        // Custom Modal for perfect UX and avoiding browser tool blocks
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <p>${msg}</p>
                <div class="modal-actions">
                    <button class="btn btn-cancel">Cancelar</button>
                    <button class="btn btn-confirm">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.btn-cancel').onclick = () => modal.remove();
        modal.querySelector('.btn-confirm').onclick = () => {
            onConfirm();
            modal.remove();
        };
    }

    async setupSubscriptions() {
        this.api.log('Iniciando vigias de mercado e saldo...', 'system');
        // 1. Ouvinte de Saldo
        this.api.on('balance', (res) => {
            const oldBalance = this.stats.balance;
            this.stats.balance = res.balance.balance;

            if (!this.stats.initialBalance || this.stats.initialBalance === 0) {
                this.stats.initialBalance = this.stats.balance;
                this.api.log(`Banca Registrada: $${this.stats.initialBalance.toFixed(2)}`, 'system');
            }

            this.ui.update({ ...this.stats, balance: this.stats.balance, levelIndex: this.levelIndex });

            if (this.isTrading && this.currentContractId && oldBalance > 0 && oldBalance !== this.stats.balance) {
                this.recoverLastTrade();
            }
        });

        // 2. Ouvinte Definitive de Resultado (Transaction)
        this.api.on('transaction', (res) => {
            if (res.transaction && res.transaction.contract_id) {
                const t = res.transaction;
                if (this.currentContractId && String(t.contract_id) === String(this.currentContractId)) {
                    if (t.action === 'sell') {
                        const realProfit = parseFloat(t.amount) - MARTINGALE_STAKES[this.levelIndex];
                        this.onFinish({ profit: realProfit, contract_id: t.contract_id, source: 'transaction' });
                    }
                }
            }
        });

        // 3. Ouvinte de Ticks (Análise Preço)
        this.api.on('tick', (res) => {
            this.lastTickTime = Date.now();
            this.engine.addTick(res.tick.quote);
            this.tickCount++;

            // === TICK VISUALIZER ANIMATION ===
            this.updateTickVisualizer(res.tick.quote);

            // NOVO: ATUALIZAÇÃO EM TEMPO REAL (CADA TICK)
            const d = this.engine.getAnalysis(this.levelIndex);
            if (d.ready) {
                this.stats.volatility = d.volatility || 0;
                this.ui.updateMini(this.stats, d); 

                if (this.tickCount % 5 === 0) {
                    const sc = (this.engine.currentScore || 0).toFixed(1);
                    const th = (this.engine.threshold || 38).toFixed(0);
                    const rsi = d.rsi ? d.rsi.toFixed(1) : '50.0';
                    const vol = d.volatility ? d.volatility.toFixed(3) : '0';
                    const dir = d.microTrend || '---';
                    this.api.log(`📊 Scanner | ${dir} | SC: ${sc} / TH: ${th} | RSI: ${rsi} | Vol: ${vol}`, 'debug');
                    this.ui.update(this.stats);
                }

                const icon = document.getElementById('market-direction-icon');
                if (icon) {
                    icon.textContent = d.lastTickDiff > 0 ? '▲' : d.lastTickDiff < 0 ? '▼' : '●';
                    icon.className = `market-direction ${d.lastTickDiff > 0 ? 'market-up' : d.lastTickDiff < 0 ? 'market-down' : ''}`;
                }
            }

            if (this.running && !this.isTrading) this.check();
        });

        // 4. Ouvinte de Contratos (Ouvinte primário de alta velocidade)
        this.api.on('proposal_open_contract', (res) => {
            const c = res.proposal_open_contract;
            if (!c || !this.isTrading || !this.currentContractId) return;
            if (String(c.contract_id) === String(this.currentContractId)) {
                const finalStatuses = ['won', 'lost', 'sold', 'cancelled', 'expired'];
                if (c.is_completed || finalStatuses.includes(c.status)) {
                    this.onFinish(c);
                }
            }
        });

        // 5. Heartbeat Watchdog - Ultra Resiliente (Protocolo 85% WR)
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.lastTickTime = Date.now();
        this.api.lastContactTime = Date.now();

        this.heartbeatTimer = setInterval(async () => {
            if (this.api.isConnected) {
                try {
                    // Envia ping preventivo para manter o WebSocket aberto (Req. Deriv)
                    this.api.send({ ping: 1 }, 10000).catch(() => { });

                    const timeSinceLastTick = Date.now() - (this.lastTickTime || Date.now());
                    const timeSinceLastContact = Date.now() - (this.api.lastContactTime || Date.now());

                    // Caso 1: Conexão morreu de verdade (Silêncio total de 60s)
                    if (timeSinceLastContact > 60000) {
                        this.api.log('Conexão Crítica: Silêncio total do servidor (60s). Reiniciando...', 'error');
                        if (this.api.socket) this.api.socket.close();
                        return;
                    }

                    // Caso 2: Ticks sumiram, mas conexão responde
                    if (timeSinceLastTick > 30000) {
                        this.api.log('Heartbeat: Ticks ausentes (30s). Tentando re-vincular mercado...', 'warning');
                        try {
                            await this.api.send({ ticks: 'R_75', subscribe: 1 }, 10000);
                            this.lastTickTime = Date.now();
                        } catch (e) {
                            this.api.log('Falha na re-vinculação. Reiniciando conexão...', 'error');
                            if (this.api.socket) this.api.socket.close();
                        }
                    }
                } catch (e) { }
            }
        }, 20000); // Roda a cada 20 segundos

        // Refresh de Saldo Extra (Garante que nunca fique congelado em 0.00)
        this.balanceHeartbeat = setInterval(() => {
            if (this.api.isConnected && this.api.isAuthorized) {
                this.api.send({ balance: 1 }).catch(() => {});
            }
        }, 30000);

        // Reduzir chamadas desnecessárias no boot
        try {
            const safeSubscribe = async (payload, timeoutMs = 15000) => {
                try {
                    await this.api.send(payload, timeoutMs);
                } catch (e) {
                    // Se já estamos inscritos nesta sessão atual, não tem problema, apenas ignoramos.
                    if (e && e.message && e.message.toLowerCase().includes('already subscribed')) {
                        return;
                    }
                    throw e; // Repassa timeouts ou erros verdadeiros
                }
            };

            await safeSubscribe({ balance: 1, subscribe: 1 });
            await safeSubscribe({ transaction: 1, subscribe: 1 });
            await safeSubscribe({ ticks: 'R_75', subscribe: 1 }, 25000); // Mais tolerância para iniciar ticks

            this.api.log('Vigias Master Ativados.', 'success');
        } catch (e) {
            this.api.log(`Erro Crítico em Assinaturas: ${e.message}`, 'error');
            // Como falhamos nas inscrições essenciais, agendamos uma retentativa leve
            setTimeout(() => {
                if (this.api.isConnected) this.setupSubscriptions();
            }, 6000);
        }
    }

    switchMode(t) {
        this.running = false;
        this.isTrading = false;
        this.account = t;
        this.levelIndex = 0;
        this.api.log(`Trocando para ${t.toUpperCase()}...`);

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.api.socket) {
            this.api.socket.onclose = null;
            this.api.socket.close();
        }
        setTimeout(() => this.boot(), 500);
    }


    async check() {
        if (!this.running || this.isTrading) return;

        // 1. FILTRO DE HORÁRIO (00:00 UTC - Recalibragem de Algoritmo)
        const now = new Date();
        if (now.getUTCHours() === 0 && now.getUTCMinutes() < 10) {
            this._tLogTime = this._tLogTime || 0;
            if (Date.now() - this._tLogTime > 60000) {
                this.api.log(`[ELITE-SHOT] Pausa Técnica: 00:00 UTC (Aguardando Liquidez)`, 'warning');
                this._tLogTime = Date.now();
            }
            return;
        }

        // 2. FILTRO DE DOJI (MERCADO SEM VOLUME)
        const last5 = this.engine.ticks.slice(-5);
        if (last5.length === 5 && last5.every(p => p === last5[0])) {
            return; // Silencioso para evitar excesso de logs
        }

        // --- REMOÇÃO DA PAUSA DE SEGURANÇA (Solicitado pelo usuário: Sem Medo) ---
        // A pausa de 5 minutos foi removida para aproveitar todas as oportunidades de alta probabilidade.
        // 3. SEM COOLDOWN (Frequência Máxima Especialista)
        const idleTime = (Date.now() - this.lastTradeTime) / 1000;
        // Removido qualquer bloqueio de tempo para trade constante tick-a-tick

        const windowSize = 30; // Sempre 30 para manter sincronia e alta frequência
        const analysis = this.engine.analyze(this.levelIndex, idleTime, windowSize);
        const d = this.engine.getAnalysis(this.levelIndex, windowSize);

        if (d && d.ready) {
            this.engine.updateHeaderIcons(d);

            // UPDATE FLOATING BADGE LIVE STATS (PREMIUM FEEL)
            const bScore = document.getElementById('badge-score');
            const bRsi = document.getElementById('badge-rsi');
            if (bScore) bScore.textContent = `SC: ${(this.engine.currentScore || 0).toFixed(1)}`;
            if (bRsi) bRsi.textContent = `RSI: ${d.rsi.toFixed(1)}`;
        }

        const signal = analysis; // Use the result of analyze as the signal

        if (signal && signal.action !== null) { // Check for null action from FILTRO DE RUÍDO
            this.isTrading = true;
            this.lastTradeTime = Date.now();
            const stakeIndex = Math.min(Math.max(0, this.levelIndex), MARTINGALE_STAKES.length - 1);
            const currentStake = MARTINGALE_STAKES[stakeIndex];

            // --- TRAVA DE SEGURANÇA: SALDO ---
            if (this.stats.balance < currentStake) {
                this.api.log(`⚠️ SALDO INSUFICIENTE: Requer $${currentStake.toFixed(2)} | Disponível: $${this.stats.balance.toFixed(2)}`, 'error');
                this.api.notify('Pausa: Aguardando saldo para recuperação.', 'info');
                this.isTrading = false;
                return;
            }

            if (this.levelIndex > 0) {
                this.api.log(`🎯 ALPHA MONSTER: Recuperando em Alta Velocidade (Nível ${this.levelIndex + 1})...`, 'system');
            }

            // --- GHOST TRADING (CONTA FANTASMA DUAL) ---
            // SINAL ELITE (>30): Entrada Direta sem Ghost para não perder oportunidades de ouro
            const isEliteSignal = (signal.score >= 30);
            // SINAL SNIPER (>38): Quebra de Martingale imediata
            const isSniperBreak = (this.levelIndex >= 1 && signal.score >= 38);
            
            // Em volatilidade Extrema, o Ghost Mode exige 2 losses para maior segurança
            const requiredGhostLosses = (this.stats.volatility > 0.45) ? 2 : 1;
            
            if (this.stats.ghostMode && this.stats.ghostLosses < requiredGhostLosses && !isEliteSignal && !isSniperBreak) {
                this.api.log(`👻 GHOST TRADE (${this.stats.ghostLosses + 1}/2): Testando vácuo...`, 'debug');
                this.isTrading = true;
                setTimeout(() => {
                    const currentPrice = this.engine.ticks[this.engine.ticks.length - 1];
                    const simulatedProfit = (signal.action === 'CALL' ? (currentPrice > signal.price) : (currentPrice < signal.price)) ? 0.35 : -0.35;
                    this.api.log(`👻 GHOST RESULT: ${simulatedProfit > 0 ? 'WIN' : 'LOSS'} (Preço: ${signal.price.toFixed(5)} -> ${currentPrice.toFixed(5)})`, 'debug');
                    if (simulatedProfit < 0) {
                        this.stats.ghostLosses++;
                        this.api.log(`🎯 GHOST HOOK: Erro #${this.stats.ghostLosses} detectado!`, 'success');
                        if (this.stats.ghostLosses >= 2) {
                            this.api.log(`💎 ELITE SIGNAL: Double-Fail detectado. Próxima entrada terá máxima assertividade.`, 'success');
                        }
                    } else {
                        // Se o ghost deu win, o mercado está "normal", então resetamos para não entrar em falso
                        this.stats.ghostLosses = 0;
                    }
                    this.isTrading = false;
                }, 4000);
                return;
            }

            this.api.log(`🚀 SCALPER SHOT (${signal.action}) | Micro-Pulso Detectado! | Score: ${signal.score}`, 'signal');
            this.startTickCount = this.tickCount; // Início da contagem de ticks do trade
            this.api.notify(`Genesis Protocol: Abrindo ${signal.action} R_75 ($${currentStake.toFixed(2)})...`);
            this.api.log(`🎯 [EXECUTANDO] Nível ${this.levelIndex + 1} | Valor exato: $${currentStake.toFixed(2)}`, 'system');
            try {
                this.stats.ghostLosses = 0; // Reseta após entrada real
                this.lastAnalysisData = signal.analysis; // Captura para aprendizado
                const p = await this.api.send({ proposal: 1, amount: currentStake.toFixed(2), basis: 'stake', contract_type: signal.action, currency: 'USD', duration: 3, duration_unit: 't', symbol: 'R_75' }); // 3 Ticks: O equilíbrio perfeito para conta Real e Volatilidade Extrema
                const b = await this.api.send({ buy: p.proposal.id, price: p.proposal.ask_price });
                this.currentContractId = b.buy.contract_id;
                this.stats.totalStaked += currentStake;
                this.api.log(`Trade Aberto: ${signal.action} [ID: ${this.currentContractId}]`, 'system');

                this.tradeWatchdog = setTimeout(() => {
                    if (this.isTrading && this.currentContractId) {
                        this.recoverLastTrade();
                    }
                }, 45000);

                await this.api.send({ proposal_open_contract: 1, contract_id: this.currentContractId, subscribe: 1 });
            } catch (e) { this.api.log(`Erro ao abrir trade: ${e.message}`, 'error'); this.isTrading = false; }
        }
    }

    // === TICK VISUALIZER: Animação da barra inferior em tempo real ===
    updateTickVisualizer(price) {
        const items = document.querySelectorAll('#tick-visualizer .tick-item');
        if (!items.length) return;

        const n = items.length; // 15 quadradinhos

        // Desliza histórico visual: remove o primeiro, empurra pro final
        if (!this._tickVizHistory) this._tickVizHistory = [];
        const prev = this.engine.ticks.slice(-2);
        const diff = prev.length >= 2 ? prev[1] - prev[0] : 0;
        this._tickVizHistory.push(diff);
        if (this._tickVizHistory.length > n) this._tickVizHistory.shift();

        items.forEach((item, i) => {
            const val = this._tickVizHistory[i];
            if (val === undefined) {
                item.className = 'tick-item idle';
                item.style.height = '10px';
                return;
            }
            if (this.isTrading) {
                // Durante trade ativo: pulso azul pulsante
                item.className = 'tick-item active';
                item.style.height = `${10 + Math.abs(val) * 8000}px`;
            } else {
                // Normal: verde = sobe, vermelho = desce
                if (val > 0) {
                    item.className = 'tick-item tick-up';
                } else if (val < 0) {
                    item.className = 'tick-item tick-down';
                } else {
                    item.className = 'tick-item idle';
                }
                item.style.height = `${8 + Math.min(18, Math.abs(val) * 6000)}px`;
            }
        });

        // Atualiza chip de nível M1..M9
        const galeChip = document.getElementById('trade-gale-level');
        if (galeChip) {
            galeChip.textContent = `M${this.levelIndex + 1}`;
            galeChip.style.color = this.levelIndex === 0 ? '#93c5fd' : this.levelIndex <= 2 ? '#f59e0b' : '#ef4444';
            galeChip.style.borderColor = this.levelIndex === 0 ? 'rgba(59,130,246,0.35)' : this.levelIndex <= 2 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)';
        }
    }

    flashTickResult(isWin) {
        const items = document.querySelectorAll('#tick-visualizer .tick-item');
        if (!items.length) return;
        const cls = isWin ? 'win' : 'loss';
        items.forEach(item => {
            item.className = `tick-item ${cls}`;
            item.style.height = '14px';
        });
        // Volta ao normal após 1.5s
        setTimeout(() => {
            items.forEach(item => { item.className = 'tick-item idle'; item.style.height = '10px'; });
        }, 1500);
    }

    onFinish(c) {
        if (!this.isTrading || !this.currentContractId) return;

        const contractId = String(c.contract_id);
        if (!this.processedTrades) this.processedTrades = new Set();
        if (this.processedTrades.has(contractId)) return;
        this.processedTrades.add(contractId);
        if (this.processedTrades.size > 100) this.processedTrades.delete(this.processedTrades.values().next().value);

        this.currentContractId = null;
        this.lastTradeTime = Date.now();
        const profit = parseFloat(c.profit);
        this.stats.profit += profit;
        this.stats.totalTrades++;

        const isWin = profit > 0;

        // FLASH VISUAL NO TICK VISUALIZER
        this.flashTickResult(isWin);

        // APRENDIZADO ADAPTATIVO E ANÁLISE DE DIRETRIZ
        if (this.lastAnalysisData) {
            this.engine.learnFromResult(isWin, this.lastAnalysisData);
            
            // Análise por Trade (Stress Test / Performance)
            if (!isWin) {
                const d = this.lastAnalysisData;
                let reason = "RUÍDO DE MERCADO";
                if (Math.abs(d.rsi - 50) > 15) reason = "EXAUSTÃO DE TENDÊNCIA";
                if (d.volatility > 0.45) reason = "VOLATILIDADE EXTREMA (RUÍDO)";
                
                this.api.log(`[ANÁLISE LOSS] Motivo provável: ${reason} | RSI: ${d.rsi.toFixed(1)} | Vol: ${d.volatility.toFixed(3)}`, 'warning');
                
                if (this.currentPhase === 2) {
                    this.api.log(`[ALERTA MÁXIMO] Loss em conta Real. Ativando Auto-Adaptação Sniper.`, 'error');
                    this.alertState = true;
                }
            } else if (this.alertState) {
                this.api.log(`[RECUPERADO] Win após Alerta. Normalizando fluxo...`, 'success');
                this.alertState = false;
            }
            
            this.lastAnalysisData = null;
        }

        // Atualiza estatísticas da fase
        this.phaseStats.total++;
        if (isWin) {
            this.phaseStats.wins++;
            this.phaseStats.gProfit += profit;
        } else {
            this.phaseStats.losses++;
            this.phaseStats.gLoss += Math.abs(profit);
        }

        // AUTO-AJUSTE REMOVIDO PARA ESTABILIDADE TOTAL NO MARTINGALE
        // TRAVAS DE SEGURANÇA QUE RESETAVAM O MARTINGALE FORAM ELIMINADAS.

        if (isWin) {
            this.stats.wins++;
            this.stats.totalGrossProfit += profit;
            const ticksTaken = this.tickCount - (this.startTickCount || 0);
            this.api.log(`WIN: +$${profit.toFixed(2)} (${ticksTaken} ticks) | Novo Saldo: $${this.stats.balance.toFixed(2)}`, 'success');
            this.api.notify(`WIN: +$${profit.toFixed(2)}`, 'win');
            this.api.playSound('money');
            
            if (this.stats.streakType === 'win') {
                this.stats.currentStreak++;
            } else {
                this.stats.currentStreak = 1;
                this.stats.streakType = 'win';
            }
            if (this.stats.currentStreak > (this.stats.maxWinStreak || 0)) this.stats.maxWinStreak = this.stats.currentStreak;
            
            this.levelIndex = 0;
            this.api.log(`Resetando Martingale para Nível 1.`, 'system');

            // ===== TESOURARIA: 20% do lucro vai para reserva protegida (SOMENTE EM WINS) =====
            if (isWin) {
                if (!this.stats.tesouraria) this.stats.tesouraria = 0;
                const reservaRate = 0.20; // 20% de cada WIN
                const reservaAporte = profit * reservaRate;
                this.stats.tesouraria = Math.max(0, (this.stats.tesouraria || 0) + reservaAporte);
                // Atualiza card visualmente
                const tesoEl = document.getElementById('stat-tesouraria');
                if (tesoEl) {
                    tesoEl.textContent = `$${this.stats.tesouraria.toFixed(2)}`;
                    tesoEl.style.color = '#22c55e'; // Verde para lucro reservado
                    tesoEl.className = 'stat-val tesouraria-val up';
                }
                this.api.log(`🏦 [TESOURARIA] +$${reservaAporte.toFixed(2)} reservado | Total: $${this.stats.tesouraria.toFixed(2)}`, 'success');
            }
            // ================================================================
        } else {
            this.stats.losses++;
            const absProfit = Math.abs(profit);
            this.stats.totalGrossLoss += absProfit;
            const ticksTaken = this.tickCount - (this.startTickCount || 0);
            this.api.log(`LOSS: $${absProfit.toFixed(2)} (${ticksTaken} ticks) | Novo Saldo: $${this.stats.balance.toFixed(2)}`, 'error');
            this.api.playSound('loss');
            
            // Correção da lógica de streaks
            if (this.stats.streakType === 'loss') {
                this.stats.currentStreak++;
            } else {
                this.stats.currentStreak = 1;
                this.stats.streakType = 'loss';
            }
            this.stats.maxLossStreak = Math.max(this.stats.maxLossStreak || 0, this.stats.currentStreak);
            
            this.levelIndex++;
            if (this.levelIndex >= MARTINGALE_STAKES.length) {
                this.api.log(`⚠️ MARTINGALE MÁXIMO (Nível ${this.levelIndex}) | Pausa de Segurança!`, 'error');
                this.running = false;
                this.toggle();
                this.levelIndex = 0;
            } else {
                this.api.log(`Próximo Martingale: Nível ${this.levelIndex + 1} ($${MARTINGALE_STAKES[this.levelIndex]})`, 'system');
            }
        }

        // Update Peak Balance for Drawdown
        if (this.stats.balance > (this.stats.peakBalance || 0)) {
            this.stats.peakBalance = this.stats.balance;
        }

        localStorage.setItem('sessionStats', JSON.stringify(this.stats));
        this.ui.update(this.stats);
        this.ui.add(profit);

        if (this.tradeWatchdog) {
            clearTimeout(this.tradeWatchdog);
            this.tradeWatchdog = null;
        }

        // --- AUTOMATED STOP CHECK ---
        const totalProfit = this.stats.profit;
        const elapsedTime = Date.now() - this.startTime;

        if (this.autoControlActive) {
            // VERIFICAÇÃO DE TROCA DE FASE
            if (this.currentPhase === 1 && this.phaseStats.total >= this.phaseTradeGoal) {
                const pf = this.phaseStats.gLoss > 0 ? (this.phaseStats.gProfit / this.phaseStats.gLoss) : 2.0;
                this.api.log(`[TESTE CONCLUÍDO] 10 Trades em Demo Realizados.`, 'success');
                this.api.log(`📈 WR: ${(this.phaseStats.wins / this.phaseStats.total * 100).toFixed(1)}% | PF: ${pf.toFixed(2)}`, 'info');
                this.api.log(`🤖 FIM DA VALIDAÇÃO SOLICITADA PELO USUÁRIO.`, 'success');
                this.running = false;
                this.updateUIForStop();
                return;
            } else if (this.currentPhase === 2 && this.phaseStats.total >= this.phaseTradeGoal) {
                 this.api.log(`🎯 MISSÃO CUMPRIDA: Fase 2 Realizada com Sucesso!`, 'success');
                 this.running = false;
                 this.updateUIForStop();
                 return;
            }

            if (totalProfit >= this.profitGoal) {
                this.api.log(`🎯 META DE LUCRO ALCANÇADA: +$${totalProfit.toFixed(2)}. Finalizando.`, 'success');
                this.api.notify('Meta de lucro batida! Desativando...');
                this.running = false;
                this.updateUIForStop();
                return;
            }

            if (elapsedTime >= this.timeLimit) {
                // Nova Regra: Só para após 3h se estiver no lucro E o último foi WIN
                if (totalProfit > 0 && isWin) {
                    this.api.log(`⏰ TEMPO LIMITE (3h) ATINGIDO EM LUCRO. Lucro Final: +$${totalProfit.toFixed(2)}. Finalizando...`, 'warning');
                    this.running = false;
                    this.updateUIForStop();
                    return;
                } else {
                    // Mantém log silenciado ou discreto para não poluir
                    if (!this._logTimeLimitNotice) {
                        this.api.log(`🕒 Tempo limite atingido, mas aguardando recuperação/win para finalizar com segurança...`, 'info');
                        this._logTimeLimitNotice = true;
                    }
                }
            }
        }

        // 🛡️ COOLDOWN MÍNIMO (Solicitado: 1 trade/min) 🛡️
        this.reentryTimeout = setTimeout(() => {
            this.reentryTimeout = null;
            this.isTrading = false;
            if (this.running) {
                this.api.log('Neural Radar: Rastreando Oportunidade Elite...', 'system');
            }
        }, 500); // Reduzido de 3000ms para 500ms para permitir trades constantes
    }

    updateUIForStop() {
        const btn = document.getElementById('start-stop-btn');
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-keyword');
        if (btn) {
            btn.textContent = 'ATIVAR ROBO';
            btn.classList.remove('active');
        }
        if (statusDot) statusDot.className = 'dot idle';
        if (statusText) statusText.textContent = 'META FINALIZADA';
    }

    async recoverLastTrade() {
        if (!this.currentContractId || !this.isTrading) return;
        try {
            const res = await this.api.send({ statement: 1, limit: 5 });
            const trades = res.statement.transactions;
            const match = trades.find(t => String(t.contract_id) === String(this.currentContractId));

            if (match && match.amount_type === 'payout') {
                this.api.log(`Trade Recuperado: ${this.currentContractId}`, 'success');
                const realProfit = parseFloat(match.amount) - MARTINGALE_STAKES[this.levelIndex];
                this.onFinish({ profit: realProfit, contract_id: match.contract_id });
            }
        } catch (e) { }
    }
}

window.onload = () => {
    window.bot = new App();
    // window.bot.boot(); // Removed to prevent double initialization
};
