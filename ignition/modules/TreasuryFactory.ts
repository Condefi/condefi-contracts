import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TreasuryModule = buildModule("TreasuryModule", (m) => {
  const treasury = m.contract("TreasuryFactory");
  
  return { treasury };
});

export default TreasuryModule;