const { getPumpFunQuote } = require('./pumpFunAPI');

class PriceMonitor {
    constructor(tokenAddress, interval = 60000) {
        this.tokenAddress = tokenAddress;
        this.interval = interval; // 默认每60秒检查一次
        this.lastPrice = null;
        this.isRunning = false;
    }

    async checkPrice() {
        try {
            const quoteData = await getPumpFunQuote(this.tokenAddress, 1, 'buy');
            if (quoteData && quoteData.amountOut) {
                const currentPrice = 1 / quoteData.amountOut;
                console.log(`当前价格: 1 代币 = ${currentPrice.toFixed(10)} SOL`);

                if (this.lastPrice !== null) {
                    const priceChange = (currentPrice - this.lastPrice) / this.lastPrice * 100;
                    console.log(`价格变化: ${priceChange.toFixed(2)}%`);

                    // 这里可以添加价格变化的警报逻辑
                    if (Math.abs(priceChange) > 5) {
                        console.log(`警报: 价格变化超过5%!`);
                        // 这里可以添加发送通知或触发其他操作的代码
                    }
                }

                this.lastPrice = currentPrice;
            }
        } catch (error) {
            console.error('检查价格时出错:', error.message);
        }
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.checkPrice(); // 立即执行一次
            this.timer = setInterval(() => this.checkPrice(), this.interval);
            console.log(`开始监控代币 ${this.tokenAddress} 的价格`);
        }
    }

    stop() {
        if (this.isRunning) {
            clearInterval(this.timer);
            this.isRunning = false;
            console.log(`停止监控代币 ${this.tokenAddress} 的价格`);
        }
    }
}

// 使用示例
const tokenAddress = "42ihfqSVsUhoiYE1VoMEfDYrY7RQuVt9ad8aPyy7pump";
const monitor = new PriceMonitor(tokenAddress, 5000); // 每30秒检查一次

monitor.start();

// 运行1小时后停止
setTimeout(() => {
    monitor.stop();
    process.exit(0);
}, 3600000);