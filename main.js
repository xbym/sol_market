const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const { getPumpFunQuote, getTokenInfo, getTokenBalance } = require('./pumpFunAPI');

let mainWindow;
let wallets = [];
const tokenAddress = "89jtQzY4uqYUGby5AftFg6SnFNB9gfeptnpxUcY5pump"; // 替换为您的代币地址
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

// 批量转账 SOL
ipcMain.handle('batch-transfer-sol', async (event, transactions) => {
  try {
    const results = [];
    for (const tx of transactions) {
      const fromWallet = wallets.find(w => w.publicKey === tx.from);
      if (!fromWallet) {
        results.push({ status: 'failed', message: `钱包 ${tx.from} 未找到` });
        continue;
      }

      const fromPubkey = new PublicKey(tx.from);
      const toPubkey = new PublicKey(tx.to);
      const lamports = tx.amount * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports
        })
      );

      const signers = [Keypair.fromSecretKey(Buffer.from(fromWallet.privateKey, 'hex'))];

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        signers
      );

      results.push({ status: 'success', signature, from: tx.from, to: tx.to, amount: tx.amount });
    }
    return results;
  } catch (error) {
    console.error('Batch transfer error:', error);
    return { error: error.message };
  }
});

// 执行交易
ipcMain.handle('execute-trade', async (event, tradeParams) => {
  try {
    const config = JSON.parse(await fs.readFile('config.json', 'utf8'));
    const response = await axios.post('https://rpc.api-pump.fun/trade', {
      mode: tradeParams.mode,
      token: tradeParams.token,
      amount: tradeParams.amount,
      amountInSol: tradeParams.amountInSol,
      slippage: tradeParams.slippage,
      priorityFee: tradeParams.priorityFee,
      private: tradeParams.privateKey // 注意：仅在用户提供私钥时才包含这个字段
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey
      }
    });

    return { success: true, signature: response.data.signature };
  } catch (error) {
    console.error('Trade execution error:', error);
    return { success: false, error: error.response ? error.response.data : error.message };
  }
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