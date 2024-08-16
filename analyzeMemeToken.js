const {
    getPumpFunQuote,
    getTokenInfo,
    getTokenBalance,
    getBondingCurveInfo,
    calculateMarketCap
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
            console.log('报价信息:');
            const tokenPrice = 1 / quoteData.amountOut;
            console.log(`当前价格: 1 代币 = ${tokenPrice.toFixed(10)} SOL`);
            console.log(`           1 SOL = ${quoteData.amountOut.toFixed(2)} 代币\n`);
        }

        // 获取钱包余额
        if (walletAddress) {
            const balanceData = await getTokenBalance(tokenAddress, walletAddress);
            if (balanceData) {
                console.log('钱包余额:');
                console.log(`代币余额: ${balanceData.balance} 代币`);
                if (quoteData) {
                    const valueInSOL = balanceData.balance * (1 / quoteData.amountOut);
                    console.log(`SOL 价值: ${valueInSOL.toFixed(6)} SOL`);
                }
                console.log('\n');
            }
        }

        // 获取绑定曲线信息
        const bondingCurveInfo = await getBondingCurveInfo(tokenAddress);
        if (bondingCurveInfo) {
            console.log('绑定曲线信息:');
            
            // 计算正确的价格和指标
            const virtualPrice = bondingCurveInfo.virtualTokenReserves / bondingCurveInfo.virtualSolReserves;
            const realPrice = bondingCurveInfo.realTokenReserves / bondingCurveInfo.realSolReserves;
            const liquidityRatio = bondingCurveInfo.realSolReserves / bondingCurveInfo.virtualSolReserves;
            
            console.log(`虚拟价格: 1 SOL = ${virtualPrice.toFixed(2)} 代币 (${(1/virtualPrice).toFixed(10)} SOL/代币)`);
            console.log(`实际价格: 1 SOL = ${realPrice.toFixed(2)} 代币 (${(1/realPrice).toFixed(10)} SOL/代币)`);
            console.log(`代币总供应量: ${bondingCurveInfo.tokenTotalSupply.toLocaleString()} 代币`);
            console.log(`流动性比率: ${(liquidityRatio * 100).toFixed(2)}%`);
            console.log('\n');
        }

        // 计算市值
        if (bondingCurveInfo && quoteData) {
            const tokenPrice = 1 / quoteData.amountOut;
            const marketCap = bondingCurveInfo.tokenTotalSupply * tokenPrice;
            console.log(`估计市值: ${marketCap.toFixed(2)} SOL`);
            
            // 计算完全稀释估值 (FDV)
            console.log(`完全稀释估值 (FDV): ${marketCap.toFixed(2)} SOL`);
            console.log('\n');
        }

        // 添加一些解释性文字
        console.log('术语解释:');
        console.log('虚拟价格: 基于绑定曲线的理论价格');
        console.log('实际价格: 基于实际交易的当前市场价格');
        console.log('流动性比率: 实际储备与虚拟储备的比率，反映代币的流动性水平');
        console.log('完全稀释估值 (FDV): 假设所有代币都在流通的情况下的总市值');

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