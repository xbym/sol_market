const {
    getPumpFunQuote,
    getTokenInfo,
    getTokenBalance
} = require('./pumpFunAPI');

async function analyzeMemeToken(tokenAddress, walletAddress) {
    try {
        console.log(`正在分析代币: ${tokenAddress}\n`);

        // 获取代币信息
        const tokenInfo = await getTokenInfo(tokenAddress);
        if (tokenInfo) {
            console.log('代币信息:');
            console.log(`名称: ${tokenInfo.Data.Name}`);
            console.log(`符号: ${tokenInfo.Data.Symbol}`);
            console.log(`铸造地址: ${tokenInfo.Mint}`);
            console.log('\n');
        }

        // 获取代币报价
        const quoteData = await getPumpFunQuote(tokenAddress, 1, 'buy');
        if (quoteData) {
            console.log('价格信息:');
            const tokenPrice = 1 / quoteData.amountOut;
            console.log(`1 代币 = ${tokenPrice.toFixed(10)} SOL`);
            console.log(`1 SOL = ${quoteData.amountOut.toFixed(2)} 代币`);
            console.log('\n');
        }

        // 获取钱包余额
        if (walletAddress) {
            const balanceData = await getTokenBalance(tokenAddress, walletAddress);
            if (balanceData) {
                console.log('钱包信息:');
                console.log(`地址: ${walletAddress}`);
                console.log(`代币余额: ${balanceData.balance} 代币`);
                if (quoteData) {
                    const valueInSOL = balanceData.balance * (1 / quoteData.amountOut);
                    console.log(`SOL 价值: ${valueInSOL.toFixed(6)} SOL`);
                }
                console.log('\n');
            }
        }

    } catch (error) {
        console.error('分析代币时出错:', error.message);
    }
}

// 使用示例
const memeTokenAddress = "89jtQzY4uqYUGby5AftFg6SnFNB9gfeptnpxUcY5pump";
const walletAddress = "YOUR_WALLET_ADDRESS_HERE"; // 替换为您想查询余额的钱包地址

analyzeMemeToken(memeTokenAddress, walletAddress)
    .then(() => console.log('分析完成'))
    .catch(error => console.error('分析失败:', error));