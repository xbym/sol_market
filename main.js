const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { getPumpFunQuote, getTokenInfo, getTokenBalance } = require('./pumpFunAPI');
const { dialog } = require('electron');
const csv = require('csv-stringify/sync');

let mainWindow;
let wallets = [];
const tokenAddress = "89jtQzY4uqYUGby5AftFg6SnFNB9gfeptnpxUcY5pump"; // 替换为您的代币地址
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// 批量导入钱包
ipcMain.handle('bulk-import-wallets', async (event, importedWallets) => {
    try {
      importedWallets.forEach(wallet => {
        if (!wallets.some(w => w.publicKey === wallet.publicKey)) {
          wallets.push({ ...wallet, type: 'regular' });
        }
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // 批量导出钱包
  ipcMain.handle('bulk-export-wallets', async () => {
    try {
      const regularWallets = wallets.filter(w => w.type === 'regular');
      const csvData = csv.stringify(regularWallets.map(w => [w.publicKey, w.privateKey]));
      return { success: true,  csvData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
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
      publicKey: keypair.publicKey.toString(),
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
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
    const tokenBalance = await getTokenBalance(tokenAddress, publicKey);
    return { solBalance, tokenBalance };
  } catch (error) {
    return { error: error.message };
  }
});

// 清空批量生成的钱包
ipcMain.handle('clear-regular-wallets', () => {
  wallets = wallets.filter(wallet => wallet.type === 'api');
  return { success: true };
});

// 价格更新逻辑
async function updateAndBroadcastPrice() {
  try {
    const quoteData = await getPumpFunQuote(tokenAddress, 1, 'buy');
    if (quoteData && quoteData.amountOut) {
      const price = 1 / quoteData.amountOut;
      mainWindow.webContents.send('price-update', { price, timestamp: new Date() });
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