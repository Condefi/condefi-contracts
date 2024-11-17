import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "ethers";

const ERC20 = buildModule("LDTModule", (m) => {
    // Array of recipient addresses
    const recipients = ["0x3fCb32c92a8279c961fFbf04d0333e180da3abc5", "0x14328479977b23231d1f27d95bAd12e6C836951a"];
    const name = "Seaside Resort Complex";
    const symbol = "SRC";
    
    // Deploy the ERC20 contract
    const erc20 = m.contract("MockERC20", [name, symbol]);
    
    // Calculate amount per recipient (total supply divided by number of recipients)
    const totalSupply = parseEther("100000");
    const amountPerRecipient = totalSupply / BigInt(recipients.length);
    
    // Transfer tokens to each recipient
    recipients.forEach((recipient, index) => {
        m.call(erc20, "transfer", [recipient, amountPerRecipient], {
            id: `transfer_to_${index}`,
            // Wait for the contract deployment to complete before transfers
            after: [erc20]
        });
    });
    
    return { erc20 };
});

export default ERC20;