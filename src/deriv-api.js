export class DerivAPI {
    constructor() {
        this.app_id = 1089; // Default app_id for testing
        this.socket = null;
        this.token = '';
        this.callbacks = {};
        this.isConnected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            this.socket = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.app_id}`);

            this.socket.onopen = () => {
                this.isConnected = true;
                console.log('WebSocket Conectado');
                resolve();
            };

            this.socket.onmessage = (msg) => {
                const data = JSON.parse(msg.data);
                if (this.callbacks[data.msg_type]) {
                    this.callbacks[data.msg_type](data);
                }
                // Handle generic subscription updates
                if (data.msg_type === 'tick' && this.callbacks['tick']) {
                    this.callbacks['tick'](data);
                }
                if (data.msg_type === 'proposal_open_contract' && this.callbacks['proposal_open_contract']) {
                    this.callbacks['proposal_open_contract'](data);
                }
                if (data.error) {
                    console.error('API Error:', data.error.message);
                    if (this.callbacks['error']) this.callbacks['error'](data.error);
                }
            };

            this.socket.onclose = () => {
                this.isConnected = false;
                console.log('WebSocket Desconectado');
            };

            this.socket.onerror = (error) => {
                reject(error);
            };
        });
    }

    authorize(token) {
        this.token = token;
        return this.send({ authorize: token });
    }

    subscribeBalance() {
        return this.send({ balance: 1, subscribe: 1 });
    }

    subscribeTicks(symbol) {
        return this.send({ ticks: symbol, subscribe: 1 });
    }

    getPriceProposal(amount, symbol, duration, type) {
        return this.send({
            proposal: 1,
            amount: amount.toString(),
            basis: 'stake',
            contract_type: type, // 'CALL' or 'PUT'
            currency: 'USD',
            duration: duration,
            duration_unit: 't',
            symbol: symbol
        });
    }

    buyContract(proposalId, price) {
        return this.send({
            buy: proposalId,
            price: price
        });
    }

    subscribeContract(contractId) {
        return this.send({
            proposal_open_contract: 1,
            contract_id: contractId,
            subscribe: 1
        });
    }

    send(data) {
        if (!this.isConnected) return Promise.reject('Socket not connected');
        this.socket.send(JSON.stringify(data));
        return new Promise((resolve) => {
            const type = Object.keys(data)[0];
            const handler = (res) => {
                if (res.msg_type === type || (type === 'proposal' && res.msg_type === 'proposal')) {
                    // Removing temporary handler to avoid leak, but need a better way for one-offs
                    // For now, persistent callbacks handle the flow
                    resolve(res);
                }
            };
            // This is a simplified request-response mapper
            this.on(type, handler);
        });
    }

    on(type, callback) {
        this.callbacks[type] = callback;
    }
}
