let currentTokenAddress = "89jtQzY4uqYUGby5AftFg6SnFNB9gfeptnpxUcY5pump";
const ctx = document.getElementById('price-chart').getContext('2d');
let priceChart;

// 初始化函数
async function initialize() {
    await updateTokenInfo();
    initChart();
    await initializeWallets();
    // 获取初始价格
    const initialPrice = await window.electronAPI.getTokenPrice(currentTokenAddress);
    if (initialPrice) {
        updateChart(initialPrice, new Date());
        document.getElementById('current-price').textContent = initialPrice.toFixed(10);
    }

    // 添加更新合约地址的事件监听器
    document.getElementById('update-contract').addEventListener('click', updateContractAddress);

    // 添加其他事件监听器
    document.getElementById('generate-api-key').addEventListener('click', generateApiKey);
    document.getElementById('generate-wallets').addEventListener('click', generateWallets);
    document.getElementById('refresh-balances').addEventListener('click', refreshAllWalletBalances);
    document.getElementById('clear-wallets').addEventListener('click', clearWallets);
    document.getElementById('export-wallets').addEventListener('click', exportWallets);
    document.getElementById('import-wallets').addEventListener('click', importWallets);
    document.getElementById('execute-batch-trade').addEventListener('click', executeBatchTrade);
}

// 更新合约地址
async function updateContractAddress() {
    const newAddress = document.getElementById('contract-address').value.trim();
    if (newAddress && newAddress !== currentTokenAddress) {
        currentTokenAddress = newAddress;
        await updateTokenInfo();
        // 重置图表
        priceChart.data.datasets[0].data = [];
        priceChart.update();
        // 通知主进程更新监测的代币地址
        await window.electronAPI.updateMonitoredToken(currentTokenAddress);
        // 刷新所有钱包余额
        await refreshAllWalletBalances();
    }
}
// 更新代币信息
async function updateTokenInfo() {
    try {
        const tokenInfo = await window.electronAPI.getTokenInfo(currentTokenAddress);
        document.getElementById('token-info').innerHTML = `
            <p>名称: ${tokenInfo.Data.Name}</p>
            <p>符号: ${tokenInfo.Data.Symbol}</p>
            <p>铸造地址: ${tokenInfo.Mint}</p>
        `;
    } catch (error) {
        console.error('Error updating token info:', error);
        document.getElementById('token-info').innerHTML = '<p>获取代币信息失败</p>';
    }
}

// 初始化图表
function initChart() {
    const data = {
        datasets: [{
            label: '代币价格 (SOL)',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    };

    priceChart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: '时间'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: '价格 (SOL)'
                    }
                }
            }
        }
    });
}

// 更新图表
function updateChart(price, timestamp) {
    const time = moment(timestamp);
    priceChart.data.datasets[0].data.push({x: time, y: price});

    if (priceChart.data.datasets[0].data.length > 20) {
        priceChart.data.datasets[0].data.shift();
    }

    priceChart.update();
}

// 处理价格更新
window.electronAPI.onPriceUpdate((event, data) => {
    if (data.tokenAddress === currentTokenAddress) {
        const price = parseFloat(data.price.toFixed(10));
        document.getElementById('current-price').textContent = price;
        updateChart(price, data.timestamp);
    }
});

// 生成API密钥和钱包
async function generateApiKey() {
    const result = await window.electronAPI.generateApiKey();
    if (result.success) {
        displayWallet(result.wallet);
    } else {
        alert('生成API密钥和钱包失败: ' + result.error);
    }
}

// 批量生成钱包
async function generateWallets() {
    const count = parseInt(document.getElementById('wallet-count').value);
    if (count < 1 || count > 50) {
        alert('请输入1-50之间的数字');
        return;
    }
    const wallets = await window.electronAPI.generateWallets(count);
    wallets.forEach(displayWallet);
}

// 清空批量钱包
async function clearWallets() {
    const result = await window.electronAPI.clearRegularWallets();
    if (result.success) {
        document.getElementById('wallet-list').innerHTML = '';
        const apiWallets = await window.electronAPI.getWallets();
        apiWallets.forEach(displayWallet);
    }
}

// 导出钱包
async function exportWallets() {
    const result = await window.electronAPI.exportWallets();
    if (result.success) {
        alert(result.message);
    } else {
        alert('导出失败: ' + result.message);
    }
}

// 导入钱包
async function importWallets() {
    const result = await window.electronAPI.importWallets();
    if (result.success) {
        alert(result.message);
        result.newWallets.forEach(displayWallet);
    } else {
        alert('导入失败: ' + result.message);
    }
}

// 显示钱包
function displayWallet(wallet) {
    const walletList = document.getElementById('wallet-list');
    const walletItem = document.createElement('div');
    walletItem.className = 'wallet-item';
    walletItem.innerHTML = `
        <input type="checkbox" class="wallet-checkbox" data-public-key="${wallet.publicKey}">
        <p>地址: ${wallet.publicKey}</p>
        <p>类型: ${wallet.type === 'api' ? 'API钱包' : '普通钱包'}</p>
        <p>SOL余额: <span class="sol-balance">加载中...</span></p>
        <p class="token-balance">代币余额: 加载中...</p>
    `;
    walletList.appendChild(walletItem);
    updateWalletBalance(wallet.publicKey);
}

// 更新钱包余额
async function updateWalletBalance(publicKey) {
    try {
        const balance = await window.electronAPI.getWalletBalance(publicKey);
        const walletItem = Array.from(document.getElementsByClassName('wallet-item')).find(item => item.innerHTML.includes(publicKey));
        if (walletItem) {
            walletItem.querySelector('.sol-balance').textContent = balance.solBalance.toFixed(9) + ' SOL';
            const tokenBalanceElement = walletItem.querySelector('.token-balance');
            if (balance.tokenBalance > 0) {
                tokenBalanceElement.textContent = `${currentTokenAddress} 余额: ${balance.tokenBalance}`;
            } else {
                tokenBalanceElement.textContent = `${currentTokenAddress} 余额: 0`;
            }
        }
    } catch (error) {
        console.error('Error updating wallet balance:', error);
    }
}

// 刷新所有钱包余额
async function refreshAllWalletBalances() {
    const wallets = await window.electronAPI.getWallets();
    for (const wallet of wallets) {
        await updateWalletBalance(wallet.publicKey);
    }
}

// 初始化钱包列表
async function initializeWallets() {
    const wallets = await window.electronAPI.getWallets();
    wallets.forEach(displayWallet);
}

// 执行批量交易
async function executeBatchTrade() {
    const selectedWallets = Array.from(document.querySelectorAll('.wallet-checkbox:checked'))
        .map(checkbox => checkbox.dataset.publicKey);

    if (selectedWallets.length === 0) {
        alert('请选择至少一个钱包');
        return;
    }

    const slippageInput = parseFloat(document.getElementById('trade-slippage').value);
    if (isNaN(slippageInput) || slippageInput < 0 || slippageInput > 100) {
        alert('请输入0到100之间的滑点百分比');
        return;
    }

    const mode = document.getElementById('trade-mode').value;
    const sellPercentage = mode === 'sell' ? parseFloat(document.getElementById('sell-percentage').value) : null;

    const tradeParams = {
        mode: mode,
        token: document.getElementById('trade-token').value,
        amount: mode === 'buy' ? parseFloat(document.getElementById('trade-amount').value) : sellPercentage,
        amountInSol: document.getElementById('amount-in-sol').checked,
        slippage: slippageInput / 100, // 将百分比转换为小数
        priorityFee: parseFloat(document.getElementById('trade-priority-fee').value)
    };

    const delay = parseInt(document.getElementById('trade-delay').value);

    // 清空之前的交易结果
    document.getElementById('trade-results').innerHTML = '';

    // 执行批量交易
    window.electronAPI.executeBatchTrade(selectedWallets, tradeParams, delay);
}

document.getElementById('trade-mode').addEventListener('change', function() {
    const sellPercentageSelect = document.getElementById('sell-percentage');
    const tradeAmountInput = document.getElementById('trade-amount');
    const amountInSolCheckbox = document.getElementById('amount-in-sol');

    if (this.value === 'sell') {
        sellPercentageSelect.style.display = 'inline-block';
        tradeAmountInput.style.display = 'none';
        amountInSolCheckbox.style.display = 'none';
    } else {
        sellPercentageSelect.style.display = 'none';
        tradeAmountInput.style.display = 'inline-block';
        amountInSolCheckbox.style.display = 'inline-block';
    }
});

// 处理交易结果
window.electronAPI.onTradeResult((event, result) => {
    const resultElement = document.createElement('div');
    resultElement.innerHTML = `
        <p>钱包: ${result.wallet}</p>
        <p>状态: ${result.success ? '成功' : '失败'}</p>
        <p>${result.success ? '交易签名: ' + result.signature : '错误: ' + result.error}</p>
    `;
    document.getElementById('trade-results').appendChild(resultElement);
});

// 启动应用
initialize();