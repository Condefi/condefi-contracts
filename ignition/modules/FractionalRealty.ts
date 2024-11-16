import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Frac = buildModule("FractionalRealtyModule", (m) => {
  const frac = m.contract("FractionalRealty");
  
  return { frac };
});

export default Frac;