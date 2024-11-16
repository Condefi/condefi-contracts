import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TreasuryModule = buildModule("TreasuryFactoryModule", (m) => {
  const treasury = m.contract("MockTreasuryFactory");
  
  return { treasury };
});

export default TreasuryModule;