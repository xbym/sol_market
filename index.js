const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

async function getBalance(address) {
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    console.log(`Balance of ${address}: ${balance / LAMPORTS_PER_SOL} SOL`);
}

const addressToCheck = "YOUR_SOLANA_ADDRESS_HERE";
getBalance(addressToCheck);