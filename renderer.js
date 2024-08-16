const tokenAddress = "89jtQzY4uqYUGby5AftFg6SnFNB9gfeptnpxUcY5pump"; // 替换为您的代币地址
const ctx = document.getElementById('price-chart').getContext('2d');
let priceChart;

async function initialize() {
    await updateTokenInfo();
    initChart();
    await initializeWallets();
    const initialPrice = await window.electronAPI.getTokenPrice(tokenAddress);
    if (initialPrice) {
        updateChart(initialPrice, new Date());
        document.getElementById('current-price').textContent = initialPrice.toFixed(10);
    }
}

async function updateTokenInfo() {
    try {
        const tokenInfo = await window.electronAPI.getTokenInfo(tokenAddress);
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

function updateChart(price, timestamp) {
    const time = moment(timestamp);
    priceChart.data.datasets[0].data.push({x: time, y: price});

    if (priceChart.data.datasets[0].data.length > 20) {
        priceChart.data.datasets[0].data.shift();
    }

    priceChart.update();
}

window.electronAPI.onPriceUpdate((event, data) => {
    const price = parseFloat(data.price.toFixed(10));
    document.getElementById('current-price').textContent = price;
    updateChart(price, data.timestamp);
});

document.getElementById('generate-api-key').addEventListener('click', async () => {
    const result = await window.electronAPI.generateApiKey();
    if (result.success) {
        displayWallet(result.wallet, document.querySelectorAll('.wallet-item').length + 1);
    } else {
        alert('生成API密钥和钱包失败: ' + result.error);
    }
});

document.getElementById('generate-wallets').addEventListener('click', async () => {
    const count = parseInt(document.getElementById('wallet-count').value);
    if (count < 1 || count > 50) {
        alert('请输入1-50之间的数字');
        return;
    }
    const wallets = await window.electronAPI.generateWallets(count);
    const startIndex = document.querySelectorAll('.wallet-item').length + 1;
    wallets.forEach((wallet, index) => displayWallet(wallet, startIndex + index));
});

document.getElementById('refresh-balances').addEventListener('click', refreshAllWalletBalances);

document.getElementById('clear-wallets').addEventListener('click', async () => {
    const result = await window.electronAPI.clearRegularWallets();
    if (result.success) {
        document.getElementById('wallet-list').innerHTML = '';
        const apiWallets = await window.electronAPI.getWallets();
        apiWallets.forEach((wallet, index) => displayWallet(wallet, index + 1));
    }
});

document.getElementById('export-wallets').addEventListener('click', async () => {
    const result = await window.electronAPI.exportWallets();
    alert(result.message);
});

document.getElementById('import-wallets').addEventListener('click', async () => {
    const result = await window.electronAPI.importWallets();
    if (result.success) {
        alert(result.message);
        const startIndex = document.querySelectorAll('.wallet-item').length + 1;
        result.newWallets.forEach((wallet, index) => displayWallet(wallet, startIndex + index));
    } else {
        alert('导入失败: ' + result.message);
    }
});

async function displayWallet(wallet, index) {
    const walletList = document.getElementById('wallet-list');
    const walletItem = document.createElement('div');
    walletItem.className = 'wallet-item';
    walletItem.innerHTML = `
        <div>
            <p>序号: ${index}</p>
            <p>地址: ${wallet.publicKey}</p>
            <p>类型: ${wallet.type === 'api' ? 'API钱包' : '普通钱包'}</p>
            <p>SOL余额: <span class="sol-balance">加载中...</span></p>
            <p class="token-balance"></p>
        </div>
        <input type="checkbox" class="wallet-select" data-public-key="${wallet.publicKey}">
    `;
    walletList.appendChild(walletItem);
    await updateWalletBalance(wallet.publicKey);
}

async function updateWalletBalance(publicKey) {
    const balance = await window.electronAPI.getWalletBalance(publicKey);
    const walletItem = Array.from(document.getElementsByClassName('wallet-item')).find(item => item.innerHTML.includes(publicKey));
    if (walletItem) {
        walletItem.querySelector('.sol-balance').textContent = balance.solBalance.toFixed(9) + ' SOL';
        const tokenBalanceElement = walletItem.querySelector('.token-balance');
        if (balance.tokenBalance > 0) {
            tokenBalanceElement.textContent = `代币余额: ${balance.tokenBalance}`;
        } else {
            tokenBalanceElement.textContent = '';
        }
    }
}

async function refreshAllWalletBalances() {
    const wallets = await window.electronAPI.getWallets();
    for (const wallet of wallets) {
        await updateWalletBalance(wallet.publicKey);
    }
}

async function initializeWallets() {
    const wallets = await window.electronAPI.getWallets();
    wallets.forEach((wallet, index) => displayWallet(wallet, index + 1));
}

document.getElementById('open-batch-trade-modal').addEventListener('click', () => {
    document.getElementById('batch-trade-modal').style.display = 'block';
});

document.getElementById('close-batch-trade-modal').addEventListener('click', () => {
    document.getElementById('batch-trade-modal').style.display = 'none';
});

document.getElementById('execute-batch-trade').addEventListener('click', async () => {
    const selectedWallets = Array.from(document.querySelectorAll('.wallet-select:checked'))
        .map(checkbox => checkbox.dataset.publicKey);

    if (selectedWallets.length === 0) {
        alert('请选择至少一个钱包进行交易');
        return;
    }

    const tradeParams = {
        mode: document.getElementById('trade-mode').value,
        token: document.getElementById('trade-token').value,
        amount: parseFloat(document.getElementById('trade-amount').value),
        amountInSol: document.getElementById('trade-amount-in-sol').checked,
        slippage: parseInt(document.getElementById('trade-slippage').value),
        priorityFee: parseInt(document.getElementById('trade-priority-fee').value),
    };

    const results = await Promise.all(selectedWallets.map(publicKey => 
        window.electronAPI.executeTrade({ ...tradeParams, publicKey })
    ));

    displayBatchTradeResults(results, selectedWallets);
});

function displayBatchTradeResults(results, wallets) {
    let message = '批量交易结果:\n\n';
    results.forEach((result, index) => {
        if (result.success) {
            message += `钱包 ${index + 1} (${wallets[index]}): 成功\n`;
            message += `  签名: ${result.signature}\n\n`;
        } else {
            message += `钱包 ${index + 1} (${wallets[index]}): 失败\n`;
            message += `  原因: ${result.error}\n\n`;
        }
    });
    alert(message);
}

initialize();