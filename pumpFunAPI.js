const https = require('https');
const fs = require('fs').promises;

// 从配置文件读取配置
async function getConfig() {
    try {
        const configData = await fs.readFile('config.json', 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error reading config file:', error.message);
        return null;
    }
}

// 通用的 API 请求函数
async function makeApiRequest(path, params = {}) {
    const config = await getConfig();
    if (!config || !config.apiKey) {
        throw new Error('API key not found. Please generate a new API key first.');
    }

    return new Promise((resolve, reject) => {
        const queryString = Object.entries(params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');

        const options = {
            'method': 'GET',
            'hostname': 'rpc.api-pump.fun',
            'path': `${path}?${queryString}`,
            'headers': {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey
            },
            'maxRedirects': 20
        };

        const req = https.request(options, function (res) {
            let chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                const body = Buffer.concat(chunks);
                try {
                    const data = JSON.parse(body.toString());
                    resolve(data);
                } catch (error) {
                    reject(new Error('Failed to parse response: ' + error.message));
                }
            });
        });

        req.on("error", function (error) {
            reject(error);
        });

        req.end();
    });
}

// 获取代币报价
async function getPumpFunQuote(token, amount, mode) {
    return makeApiRequest('/quote', { token, amount, mode });
}

// 获取代币信息
async function getTokenInfo(token) {
    return makeApiRequest('/info', { token });
}

// 获取代币余额
// 在 pumpFunAPI.js 中添加或修改以下函数

async function getTokenBalance(token, wallet) {
    return makeApiRequest('/balance', { token, wallet });
}


// 获取绑定曲线信息
async function getBondingCurveInfo(token) {
    return makeApiRequest('/bondingCurve', { token });
}

// 计算市值
async function calculateMarketCap(token, totalSupply) {
    const quoteData = await getPumpFunQuote(token, 1, 'buy');
    if (quoteData && quoteData.amountOut) {
        const price = quoteData.amountOut;
        const marketCap = totalSupply * price;
        console.log(`Current price of ${token}: ${price} SOL`);
        console.log(`Estimated Market Cap of ${token}: ${marketCap} SOL`);
        return marketCap;
    } else {
        console.log(`Unable to calculate market cap for ${token}`);
        return null;
    }
}

module.exports = {
    getPumpFunQuote,
    getTokenInfo,
    getTokenBalance,
    getBondingCurveInfo,
    calculateMarketCap
};