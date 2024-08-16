const axios = require('axios');
const fs = require('fs').promises;

async function generateApiKeyAndWallet() {
    try {
        const response = await axios.post('https://rpc.api-pump.fun/createWallet', {}, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const { privateKey, publicKey, apiKey } = response.data;

        // 将信息保存到配置文件中
        const config = {
            privateKey,
            publicKey,
            apiKey
        };

        await fs.writeFile('config.json', JSON.stringify(config, null, 2));

        console.log('New wallet and API key generated and saved to config.json');
        console.log(`Public Key: ${publicKey}`);
        console.log('Please ensure to fund this wallet with SOL for transaction signing.');

        return config;
    } catch (error) {
        console.error('Error generating API key and wallet:', error.message);
        throw error;
    }
}

// 执行生成函数
generateApiKeyAndWallet()
    .then(() => console.log('API key generation complete'))
    .catch(error => console.error('API key generation failed:', error));