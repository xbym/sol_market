const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getTokenInfo: (tokenAddress) => ipcRenderer.invoke('get-token-info', tokenAddress),
  getTokenPrice: (tokenAddress) => ipcRenderer.invoke('get-token-price', tokenAddress),
  getTokenBalance: (tokenAddress, walletAddress) => ipcRenderer.invoke('get-token-balance', tokenAddress, walletAddress),
  onPriceUpdate: (callback) => ipcRenderer.on('price-update', callback),
  generateApiKey: () => ipcRenderer.invoke('generate-api-key'),
  generateWallets: (count) => ipcRenderer.invoke('generate-wallets', count),
  getWallets: () => ipcRenderer.invoke('get-wallets'),
  getWalletBalance: (publicKey) => ipcRenderer.invoke('get-wallet-balance', publicKey),
  clearRegularWallets: () => ipcRenderer.invoke('clear-regular-wallets'),
  exportWallets: () => ipcRenderer.invoke('export-wallets'),
  importWallets: () => ipcRenderer.invoke('import-wallets'),
  updateMonitoredToken: (address) => ipcRenderer.invoke('updateMonitoredToken', address),
  getWalletBalance: (publicKey) => ipcRenderer.invoke('get-wallet-balance', publicKey),
  updateMonitoredToken: (address) => ipcRenderer.invoke('updateMonitoredToken', address),
  executeBatchTrade: (selectedWallets, tradeParams, delay) => 
    ipcRenderer.invoke('execute-batch-trade', selectedWallets, tradeParams, delay),
  onTradeResult: (callback) => ipcRenderer.on('trade-result', callback)
});