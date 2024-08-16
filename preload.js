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
  bulkImportWallets: (wallets) => ipcRenderer.invoke('bulk-import-wallets', wallets),
  bulkExportWallets: () => ipcRenderer.invoke('bulk-export-wallets'),
  saveCsvFile: (csvData) => ipcRenderer.invoke('save-csv', csvData),
});