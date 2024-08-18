const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { getPumpFunQuote, getTokenInfo, getTokenBalance } = require('./pumpFunAPI');
const bs58 = require('bs58').default;

let mainWindow;
let wallets = [];
let monitoredTokenAddress = "89jtQzY4uqYUGby5AftFg6SnFNB9gfeptnpxUcY5pump";
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 处理 API 调用
ipcMain.handle('get-token-info', async (event, tokenAddress) => {
  return await getTokenInfo(tokenAddress);
});

ipcMain.handle('get-token-price', async (event, tokenAddress) => {
  const quoteData = await getPumpFunQuote(tokenAddress, 1, 'buy');
  return quoteData ? 1 / quoteData.amountOut : null;
});

// 更新监测的代币地址
ipcMain.handle('updateMonitoredToken', async (event, newAddress) => {
  monitoredTokenAddress = newAddress;
  await updateAndBroadcastPrice();
});

// 生成 API 密钥和钱包
ipcMain.handle('generate-api-key', async () => {
  try {
    const response = await axios.post('https://rpc.api-pump.fun/createWallet', {}, {
      headers: { 'Content-Type': 'application/json' }
    });

    const { privateKey, publicKey, apiKey } = response.data;
    const wallet = { publicKey, privateKey, apiKey, type: 'api' };
    wallets.push(wallet);

    await fs.writeFile('config.json', JSON.stringify({ apiKey, publicKey, privateKey }, null, 2));

    return { success: true, wallet: { publicKey, type: 'api' } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 批量生成钱包
ipcMain.handle('generate-wallets', async (event, count) => {
  const newWallets = [];
  for (let i = 0; i < count; i++) {
    const keypair = Keypair.generate();
    const wallet = {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
      type: 'regular'
    };
    newWallets.push(wallet);
    wallets.push(wallet);
  }
  return newWallets.map(w => ({ publicKey: w.publicKey, type: w.type }));
});

// 获取所有钱包
ipcMain.handle('get-wallets', () => {
  return wallets.map(w => ({ publicKey: w.publicKey, type: w.type }));
});

// 查询钱包余额
ipcMain.handle('get-wallet-balance', async (event, publicKey) => {
  try {
    const solBalance = await connection.getBalance(new PublicKey(publicKey)) / 1e9;
    const tokenBalance = await getTokenBalance(monitoredTokenAddress, publicKey);
    return { 
      solBalance, 
      tokenBalance: tokenBalance.balance,
      tokenAddress: monitoredTokenAddress
    };
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return { error: error.message };
  }
});

// 清空批量生成的钱包
ipcMain.handle('clear-regular-wallets', () => {
  wallets = wallets.filter(wallet => wallet.type === 'api');
  return { success: true };
});

// 导出钱包
ipcMain.handle('export-wallets', async () => {
  const { filePath } = await dialog.showSaveDialog({
    buttonLabel: '导出',
    defaultPath: path.join(app.getPath('documents'), 'wallets.json')
  });

  if (filePath) {
    const walletsToExport = wallets.filter(w => w.type === 'regular').map(w => ({
      publicKey: w.publicKey,
      privateKey: w.privateKey
    }));
    await fs.writeFile(filePath, JSON.stringify(walletsToExport, null, 2));
    return { success: true, message: '钱包已成功导出' };
  }
  return { success: false, message: '导出已取消' };
});

// 导入钱包
ipcMain.handle('import-wallets', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    buttonLabel: '导入',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (filePaths && filePaths.length > 0) {
    const fileContent = await fs.readFile(filePaths[0], 'utf8');
    const importedWallets = JSON.parse(fileContent);
    const newWallets = importedWallets.filter(w => !wallets.some(existing => existing.publicKey === w.publicKey))
      .map(w => ({ ...w, type: 'regular' }));
    wallets.push(...newWallets);
    return { success: true, message: `已导入 ${newWallets.length} 个新钱包`, newWallets };
  }
  return { success: false, message: '导入已取消' };
});

// 执行单个交易
async function executeTrade(wallet, tradeParams) {
  const config = await getConfig();
  const apiKey = config.apiKey;

  if (!apiKey) {
      throw new Error('API key not found in configuration');
  }

  console.log('Executing trade with params:', JSON.stringify(tradeParams));
  console.log('Using wallet:', wallet.publicKey);

  let privateKey = wallet.privateKey;
  if (privateKey.length === 128) {
      privateKey = bs58.encode(Buffer.from(privateKey, 'hex'));
  }

  try {
      let amount = tradeParams.amount;

      // 如果是卖出操作且金额是百分比
      if (tradeParams.mode === 'sell' && tradeParams.amount <= 1) {
          // 将小数转换为百分比字符串
          amount = `${(tradeParams.amount * 100).toFixed(0)}%`;
          console.log(`Selling ${amount} of balance`);
      } else if (tradeParams.mode === 'buy') {
          // 买入操作时，将金额转换为lamports
          amount = Math.round(amount * 1e9);
      }

      const slippageInBasisPoints = Math.round(tradeParams.slippage * 10000);
      const response = await axios.post('https://rpc.api-pump.fun/trade', {
          mode: tradeParams.mode,
          token: tradeParams.token,
          amount: amount,
          amountInSol: tradeParams.amountInSol,
          slippage: slippageInBasisPoints,
          priorityFee: Math.round(tradeParams.priorityFee * 1e9),
          private: privateKey
      }, {
          headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey
          }
      });

      console.log('API Response:', response.data);
      return { success: true, signature: response.data.signature, wallet: wallet.publicKey };
  } catch (error) {
      console.error('Trade execution error:', error.message);
      if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
          console.error('Response headers:', error.response.headers);
      }
      return { success: false, error: error.message, wallet: wallet.publicKey };
  }
}


async function getConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error reading config file:', error.message);
    throw error;
  }
}

// 批量交易处理
ipcMain.handle('execute-batch-trade', async (event, selectedWallets, tradeParams, delay) => {
  const results = [];
  const shuffledWallets = selectedWallets.sort(() => Math.random() - 0.5);

  for (const walletPublicKey of shuffledWallets) {
    const wallet = wallets.find(w => w.publicKey === walletPublicKey);
    if (wallet) {
      await new Promise(resolve => setTimeout(resolve, delay * 1000)); // 延迟执行
      try {
        const result = await executeTrade(wallet, tradeParams);
        results.push(result);
        event.sender.send('trade-result', result);
      } catch (error) {
        const errorResult = { success: false, error: error.message, wallet: wallet.publicKey };
        results.push(errorResult);
        event.sender.send('trade-result', errorResult);
      }
    }
  }

  return results;
});

// 价格更新逻辑
async function updateAndBroadcastPrice() {
  try {
    const quoteData = await getPumpFunQuote(monitoredTokenAddress, 1, 'buy');
    if (quoteData && quoteData.amountOut) {
      const price = 1 / quoteData.amountOut;
      mainWindow.webContents.send('price-update', { 
        price, 
        timestamp: new Date(),
        tokenAddress: monitoredTokenAddress 
      });
    }
  } catch (error) {
    console.error('Error fetching price:', error);
  }
}

// 应用程序启动后开始价格更新
app.on('ready', () => {
  // 立即执行一次，然后每30秒执行一次
  updateAndBroadcastPrice();
  setInterval(updateAndBroadcastPrice, 30000);
});