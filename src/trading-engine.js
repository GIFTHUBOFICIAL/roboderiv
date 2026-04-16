export class TradingEngine {
    constructor() {
        this.ticks = [];
        this.maxTicks = 50;
        this.isAnalyzing = false;
        this.lastStrategyResult = null;
    }

    addTick(tick) {
        this.ticks.push(tick);
        if (this.ticks.length > this.maxTicks) {
            this.ticks.shift();
        }
    }

    calculateRSI(period = 14) {
        if (this.ticks.length <= period) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = this.ticks.length - period; i < this.ticks.length; i++) {
            const diff = this.ticks[i] - this.ticks[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateBollingerBands(period = 20, stdDev = 2) {
        if (this.ticks.length < period) return null;

        const slice = this.ticks.slice(-period);
        const mean = slice.reduce((a, b) => a + b) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const sd = Math.sqrt(variance);

        return {
            upper: mean + (stdDev * sd),
            middle: mean,
            lower: mean - (stdDev * sd)
        };
    }

    analyze() {
        if (this.ticks.length < 20) return null;

        const currentPrice = this.ticks[this.ticks.length - 1];
        const rsi = this.calculateRSI();
        const bb = this.calculateBollingerBands();

        // Acceleration analysis (Last 5 ticks)
        const recentTicks = this.ticks.slice(-5);
        let acceleration = 0;
        for (let i = 1; i < recentTicks.length; i++) {
            acceleration += (recentTicks[i] - recentTicks[i - 1]);
        }

        // Strategy Logic:
        // 1. RSI indicates exhaustion (< 30 or > 70)
        // 2. Price breaks Bollinger Bands
        // 3. Acceleration aligns with reversal

        if (rsi > 70 && currentPrice > bb.upper && acceleration < 0) {
            return { action: 'PUT', confidence: 'high' }; // Sell signal
        }

        if (rsi < 30 && currentPrice < bb.lower && acceleration > 0) {
            return { action: 'CALL', confidence: 'high' }; // Buy signal
        }

        // Trend Following (SMA 20 Filter)
        if (currentPrice > bb.middle && rsi > 55 && acceleration > 0.1) {
            return { action: 'CALL', confidence: 'medium' };
        }

        if (currentPrice < bb.middle && rsi < 45 && acceleration < -0.1) {
            return { action: 'PUT', confidence: 'medium' };
        }

        return null;
    }

    calculateRecoveryStake(previousLoss, payout = 0.95) {
        // Smart Martingale: Recover loss + small profit
        return (previousLoss * 1.1) / payout;
    }
}
