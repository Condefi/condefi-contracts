// MockERC20Module.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ERC20 = buildModule("MockERC20Module", (m) => {
    const name = "USD Coin";
    const symbol = "USDC";
    
    const erc20 = m.contract("MockERC20", [name, symbol]);
    
    return { erc20 };
});

export default ERC20;