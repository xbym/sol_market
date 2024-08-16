const {
    getPumpFunQuote,
    getTokenInfo,
    getTokenBalance,
    getBondingCurveInfo,
    calculateMarketCap
} = require('./pumpFunAPI');

async function analyzeMemeToken(tokenAddress, walletAddress) {
    try {
        console.log(`Analyzing token: ${tokenAddress}\n`);

        // 获取代币信息
        const tokenInfo = await getTokenInfo(tokenAddress);
        if (tokenInfo) {
            console.log('Token Information:');
            console.log(JSON.stringify(tokenInfo, null, 2));
            console.log('\n');
        }

        // 获取代币报价
        const quoteData = await getPumpFunQuote(tokenAddress, 1, 'buy');
        if (quoteData) {
            console.log('Quote Information:');
            console.log(JSON.stringify(quoteData, null, 2));
            const tokenPrice = 1 / quoteData.amountOut;
            console.log(`\nCurrent Price: 1 token = ${tokenPrice.toFixed(10)} SOL`);
            console.log(`               1 SOL = ${quoteData.amountOut.toFixed(2)} tokens\n`);
        }

        // 获取钱包余额
        if (walletAddress) {
            const balanceData = await getTokenBalance(tokenAddress, walletAddress);
            if (balanceData) {
                console.log('Wallet Balance:');
                console.log(`Token Balance: ${balanceData.balance} tokens`);
                if (quoteData) {
                    const valueInSOL = balanceData.balance * (1 / quoteData.amountOut);
                    console.log(`Value in SOL: ${valueInSOL.toFixed(6)} SOL`);
                }
                console.log('\n');
            }
        }

        // 获取绑定曲线信息
        const bondingCurveInfo = await getBondingCurveInfo(tokenAddress);
        if (bondingCurveInfo) {
            console.log('Bonding Curve Information:');
            console.log(JSON.stringify(bondingCurveInfo, null, 2));
            
            // 计算正确的价格和指标
            const virtualPrice = bondingCurveInfo.virtualTokenReserves / bondingCurveInfo.virtualSolReserves;
            const realPrice = bondingCurveInfo.realTokenReserves / bondingCurveInfo.realSolReserves;
            const liquidityRatio = bondingCurveInfo.realSolReserves / bondingCurveInfo.virtualSolReserves;
            
            console.log(`\nVirtual Price: 1 SOL = ${virtualPrice.toFixed(2)} tokens (${(1/virtualPrice).toFixed(10)} SOL/token)`);
            console.log(`Real Price: 1 SOL = ${realPrice.toFixed(2)} tokens (${(1/realPrice).toFixed(10)} SOL/token)`);
            console.log(`Total Supply: ${bondingCurveInfo.tokenTotalSupply} tokens`);
            console.log(`Liquidity Ratio: ${(liquidityRatio * 100).toFixed(2)}%`);
        }

        // 计算市值
        if (bondingCurveInfo && quoteData) {
            const tokenPrice = 1 / quoteData.amountOut;
            const marketCap = bondingCurveInfo.tokenTotalSupply * tokenPrice;
            console.log(`\nEstimated Market Cap: ${marketCap.toFixed(2)} SOL`);
            
            // 计算完全稀释估值 (FDV)
            console.log(`Fully Diluted Valuation (FDV): ${marketCap.toFixed(2)} SOL`);
        }

    } catch (error) {
        console.error('Error analyzing token:', error.message);
    }
}

// 使用示例
const memeTokenAddress = "89jtQzY4uqYUGby5AftFg6SnFNB9gfeptnpxUcY5pump";
const walletAddress = "YOUR_WALLET_ADDRESS_HERE"; // 替换为您想查询余额的钱包地址

analyzeMemeToken(memeTokenAddress, walletAddress)
    .then(() => console.log('Analysis complete'))
    .catch(error => console.error('Analysis failed:', error));