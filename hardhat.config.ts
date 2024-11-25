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
    base: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    mantle: {
      url: "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    scroll: {
      url: "https://sepolia-rpc.scroll.io",
      chainId: 534351,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  etherscan: {
    apiKey: {
      'kinto': 'empty',
      'base': 'empty',
      'mantle': 'empty',
      'scroll': 'empty'
    },
    customChains: [
      {
        network: "kinto",
        chainId: 7887,
        urls: {
          apiURL: "https://explorer.kinto.xyz/api",
          browserURL: "https://explorer.kinto.xyz"
        }
      },
      {
        network: "base",
        chainId: 84532,
        urls: {
          apiURL: "https://base-sepolia.blockscout.com/api",
          browserURL: "https://base-sepolia.blockscout.com/"
        }
      },
      {
        network: "mantle",
        chainId: 5003,
        urls: {
          apiURL: "https://explorer.mantle.xyz/api",
          browserURL: "https://explorer.mantle.xyz/"
        }
      },
      {
        network: "scroll",
        chainId: 534351,
        urls: {
          apiURL: "https://sepolia.scrollscan.com/api",
          browserURL: "https://sepolia.scrollscan.com/"
        }
      },
    ]
  }
};

export default config;
