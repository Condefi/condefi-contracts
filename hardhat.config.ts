import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true,
      // For large contracts
      metadata: {
        bytecodeHash: "none",
      },
    },
  },
  networks: {
    kinto: {
      url: "https://rpc.kinto-rpc.com",
      chainId: 7887,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // base: {

    // },
    // mantle: {

    // },
    // scroll: {
      
    // }
  },
};

export default config;
