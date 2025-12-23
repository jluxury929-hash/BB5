/**
 * 🔱 APEX v38.10.3 - THE DYNAMIC TITAN STRIKE (SCALING)
 * Target Contract: 0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0
 */

const { ethers, Wallet, WebSocketProvider } = require('ethers');

const CONFIG = {
    CHAIN_ID: 8453,
    MY_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    GAS_LIMIT: 950000n, // Increased slightly for higher loan scaling
    MAX_FEE: ethers.parseUnits("0.25", "gwei"),
    MAX_PRIORITY: ethers.parseUnits("0.15", "gwei"),
    WSS_URL: "wss://base-mainnet.g.alchemy.com/v2/G-WBAMA8JxJMjkc-BCeoK"
};

const ABI = ["function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)"];

let provider, signer, titanContract, nextNonce;

async function startBot() {
    provider = new WebSocketProvider(CONFIG.WSS_URL);
    signer = new Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
    titanContract = new ethers.Contract(CONFIG.MY_CONTRACT, ABI, signer);

    console.log(`\n🔱 TITAN DYNAMIC SYSTEM ARMED`);
    console.log(`Treasury: ${signer.address}`);

    nextNonce = await provider.getTransactionCount(signer.address, 'latest');

    provider.on("block", async (num) => {
        const startTime = Date.now();
        try {
            const block = await provider.getBlock(num, true);
            process.stdout.write(`\r📦 BLOCK: ${num} | HUNTING... `);

            if (block.transactions.some(t => BigInt(t.value || 0) > 0n)) {
                executeTitanStrike(startTime);
            }
        } catch (err) {}
    });
}

/**
 * DYNAMIC SCALING LOGIC
 * Scales loan size based on available gas (ETH balance)
 */
async function getDynamicLoanAmount() {
    const balanceWei = await provider.getBalance(signer.address);
    const balanceEth = parseFloat(ethers.formatEther(balanceWei));
    
    // Assuming ETH price is roughly $3,300 for calculation
    const ethPrice = 3300; 
    const usdValue = balanceEth * ethPrice;

    if (usdValue >= 200) return ethers.parseEther("100"); // Pro Tier
    if (usdValue >= 100) return ethers.parseEther("75");  // High Tier
    if (usdValue >= 75)  return ethers.parseEther("50");  // Mid Tier
    if (usdValue >= 30)  return ethers.parseEther("25");  // Base Tier
    
    return ethers.parseEther("10"); // Safety Minimum
}

async function executeTitanStrike(startTime) {
    try {
        const loanAmount = await getDynamicLoanAmount();
        const path = [CONFIG.WETH, CONFIG.USDC];

        // 1. SIMULATE (Checks if profit > 0.05% fee)
        await titanContract.requestTitanLoan.staticCall(
            CONFIG.WETH,
            loanAmount,
            path,
            { from: signer.address }
        );

        // 2. STRIKE
        const tx = await titanContract.requestTitanLoan(
            CONFIG.WETH,
            loanAmount,
            path,
            {
                gasLimit: CONFIG.GAS_LIMIT,
                maxPriorityFeePerGas: CONFIG.MAX_PRIORITY,
                maxFeePerGas: CONFIG.MAX_FEE,
                nonce: nextNonce++
            }
        );

        console.log(`\n🚀 STRIKE FIRED: ${ethers.formatEther(loanAmount)} ETH | Hash: ${tx.hash.slice(0,15)}`);
        await tx.wait();
        
    } catch (e) {
        // Reverts quietly to save gas if not profitable
        if (e.message.includes("nonce")) {
            nextNonce = await provider.getTransactionCount(signer.address, 'latest');
        }
    }
}

startBot();
