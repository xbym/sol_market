const tokenAddress = "89jtQzY4uqYUGby5AftFg6SnFNB9gfeptnpxUcY5pump"; // 替换为您的代币地址
const ctx = document.getElementById('price-chart').getContext('2d');
let priceChart;

// 初始化函数
async function initialize() {
    await updateTokenInfo();
    initChart();
    await initializeWallets();
    // 获取初始价格
    const initialPrice = await window.electronAPI.getTokenPrice(tokenAddress);
    if (initialPrice) {
        updateChart(initialPrice, new Date());
        document.getElementById('current-price').textContent = initialPrice.toFixed(10);
    }
}

// 更新代币信息
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
    const price = parseFloat(data.price.toFixed(10));
    document.getElementById('current-price').textContent = price;
    updateChart(price, data.timestamp);
});

// 生成API密钥和钱包
document.getElementById('generate-api-key').addEventListener('click', async () => {
    const result = await window.electronAPI.generateApiKey();
    if (result.success) {
        displayWallet(result.wallet);
    } else {
        alert('生成API密钥和钱包失败: ' + result.error);
    }
});

// 批量生成钱包
document.getElementById('generate-wallets').addEventListener('click', async () => {
    const count = parseInt(document.getElementById('wallet-count').value);
    if (count < 1 || count > 50) {
        alert('请输入1-50之间的数字');
        return;
    }
    const wallets = await window.electronAPI.generateWallets(count);
    wallets.forEach(displayWallet);
});

// 批量导入钱包
document.getElementById('bulk-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            const wallets = content.split('\n').map(line => {
                const [publicKey, privateKey] = line.split(',');
                return { publicKey: publicKey.trim(), privateKey: privateKey.trim() };
            });
            const result = await window.electronAPI.bulkImportWallets(wallets);
            if (result.success) {
                alert('钱包批量导入成功');
                await initializeWallets();
            } else {
                alert('钱包批量导入失败: ' + result.error);
            }
        };
        reader.readAsText(file);
    }
});

// 批量导出钱包
document.getElementById('bulk-export').addEventListener('click', async () => {
    const result = await window.electronAPI.bulkExportWallets();
    console.log('Export result:', result); // 添加这行
    if (result.success) {
        console.log("Received CSV data:", result.data);
        
        // 使用新的 API 方法保存文件
        const saveResult = await window.electronAPI.saveCsvFile(result.data);
        
        if (saveResult.success) {
            console.log("File saved successfully");
            alert('钱包批量导出成功');
        } else {
            console.error("Failed to save file:", saveResult.message);
            alert('保存文件失败: ' + saveResult.message);
        }
    } else {
        alert('钱包批量导出失败: ' + result.error);
    }
});

// 刷新余额
document.getElementById('refresh-balances').addEventListener('click', refreshAllWalletBalances);

// 清空批量钱包
document.getElementById('clear-wallets').addEventListener('click', async () => {
    const result = await window.electronAPI.clearRegularWallets();
    if (result.success) {
        document.getElementById('wallet-list').innerHTML = '';
        const apiWallets = await window.electronAPI.getWallets();
        apiWallets.forEach(displayWallet);
    }
});

// 显示钱包信息
async function displayWallet(wallet) {
    const walletList = document.getElementById('wallet-list');
    const walletItem = document.createElement('div');
    walletItem.className = 'wallet-item';
    walletItem.innerHTML = `
        <p>地址: ${wallet.publicKey}</p>
        <p>类型: ${wallet.type === 'api' ? 'API钱包' : '普通钱包'}</p>
        <p>SOL余额: <span class="sol-balance">加载中...</span></p>
        <p class="token-balance"></p>
    `;
    walletList.appendChild(walletItem);
    await updateWalletBalance(wallet.publicKey);
}

// 更新钱包余额
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

// 启动应用
initialize();