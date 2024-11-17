import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const Frac = buildModule("FractionalRealtyModule", (m) => {
  // Deploy MockAttester first
  const mockAttester = m.contract("MockAttester");

  // Deploy FractionalRealty with MockAttester address as constructor argument
  const frac = m.contract("FractionalRealty", [mockAttester]);
  
  return { 
    mockAttester,
    frac 
  };
});

export default Frac;