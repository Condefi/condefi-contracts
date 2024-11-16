import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import hre from "hardhat";
import {
  FractionalRealty,
  MockKintoID,
  FractionalizedERC20,
  MockAttester,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FractionalRealty", function () {
  const KINTO_ID_ADDRESS = "0xf369f78E3A0492CC4e96a90dae0728A38498e9c7";

  before(async function () {
    const [owner] = await ethers.getSigners();

    // Fund the hardcoded KintoID address
    await owner.sendTransaction({
      to: KINTO_ID_ADDRESS,
      value: ethers.parseEther("1"),
    });

    // Clear any existing code
    await hre.network.provider.request({
      method: "hardhat_setCode",
      params: [KINTO_ID_ADDRESS, "0x"],
    });
  });

  async function deployFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy MockKintoID first
    const MockKintoID = await ethers.getContractFactory("MockKintoID");
    const mockKintoIDImpl = await MockKintoID.deploy();

    // Set the code at hardcoded address
    await hre.network.provider.request({
      method: "hardhat_setCode",
      params: [
        KINTO_ID_ADDRESS,
        await ethers.provider.getCode(mockKintoIDImpl.target),
      ],
    });

    const mockKintoID = await ethers.getContractAt(
      "MockKintoID",
      KINTO_ID_ADDRESS
    );

    // Deploy MockAttester
    const MockAttester = await ethers.getContractFactory("MockAttester");
    const mockAttester = await MockAttester.deploy();

    // Deploy FractionalRealty
    const FractionalRealty = await ethers.getContractFactory(
      "FractionalRealty"
    );
    const fractionalRealty = await FractionalRealty.deploy(mockAttester.target);

    // Get the DEFAULT_ADMIN_ROLE
    const DEFAULT_ADMIN_ROLE = await fractionalRealty.DEFAULT_ADMIN_ROLE();

    // Set up test data
    const countryCode = 840; // USA
    const countryCode2 = 124; // Canada
    const titleDeedHash = ethers.keccak256(ethers.toUtf8Bytes("testDeed"));
    const businessIdHash = ethers.keccak256(ethers.toUtf8Bytes("testBusiness"));

    // Set up attester
    await mockAttester.addAttester(owner.address);

    // Set up KYC statuses
    await mockKintoID.setKYC(user1.address, true);
    await mockKintoID.setSanctionsStatus(user1.address, countryCode, true);
    await mockKintoID.setCompanyStatus(user1.address, true);

    // Set up title deed ownership
    await mockAttester.attestTitleDeedOwnership(
      businessIdHash,
      titleDeedHash,
      user1.address
    );

    // Set up user2 (KYC'd but not sanctions safe)
    await mockKintoID.setKYC(user2.address, true);
    await mockKintoID.setSanctionsStatus(user2.address, countryCode, false);

    // Set up user3 (KYC'd and sanctions safe for different country)
    await mockKintoID.setKYC(user3.address, true);
    await mockKintoID.setSanctionsStatus(user3.address, countryCode2, true);

    // Grant necessary roles to owner
    await fractionalRealty.grantRole(DEFAULT_ADMIN_ROLE, owner.address);

    return {
      fractionalRealty,
      mockKintoID,
      mockAttester,
      countryCode,
      countryCode2,
      titleDeedHash,
      businessIdHash,
      owner,
      user1,
      user2,
      user3,
      DEFAULT_ADMIN_ROLE,
    };
  }

  // Updated mintedTokenFixture
  async function mintedTokenFixture() {
    const base = await loadFixture(deployFixture);

    // Mint a token
    await base.fractionalRealty
      .connect(base.user1)
      .mint(base.countryCode, base.titleDeedHash, base.businessIdHash);

    // Get token data and ERC20 contract
    const tokenData = await base.fractionalRealty.tokenData(1);
    const erc20Token = await ethers.getContractAt(
      "FractionalizedERC20",
      tokenData.erc20Token
    );

    return {
      ...base,
      tokenId: 1,
      erc20Token,
      tokenData,
    };
  }

  describe("Deployment & Initial State", function () {
    it("Should deploy with correct initial state", async function () {
      const { fractionalRealty, mockAttester } = await loadFixture(
        deployFixture
      );

      expect(await fractionalRealty.currentTokenId()).to.equal(0);
      expect(await fractionalRealty.globalTimelock()).to.equal(
        7 * 24 * 60 * 60
      ); // 7 days
      expect(await fractionalRealty.attester()).to.equal(mockAttester.target);
    });

    it("Should have correct role configuration", async function () {
      const { fractionalRealty, owner } = await loadFixture(deployFixture);

      const DEFAULT_ADMIN_ROLE = await fractionalRealty.DEFAULT_ADMIN_ROLE();
      expect(await fractionalRealty.hasRole(DEFAULT_ADMIN_ROLE, owner.address))
        .to.be.true;
    });
  });

  describe("Minting Succeed", function() {
    it("Should mint token with correct data", async function () {
      const {
        fractionalRealty,
        countryCode,
        titleDeedHash,
        businessIdHash,
        user1,
      } = await loadFixture(deployFixture);

      await expect(
        fractionalRealty
          .connect(user1)
          .mint(countryCode, titleDeedHash, businessIdHash)
      )
        .to.emit(fractionalRealty, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, 1);

      const tokenData = await fractionalRealty.tokenData(1);
      expect(tokenData.countryCode).to.equal(countryCode);
      expect(tokenData.titleDeedHash).to.equal(titleDeedHash);
      expect(tokenData.businessIdHash).to.equal(businessIdHash);
      expect(tokenData.erc20Token).to.not.equal(ethers.ZeroAddress);
      expect(tokenData.timelockUntil).to.equal(0);
      expect(tokenData.customTimelock).to.equal(0);
    });

    it("Should create properly configured ERC20 token", async function () {
      const {
        fractionalRealty,
        countryCode,
        titleDeedHash,
        businessIdHash,
        user1,
      } = await loadFixture(deployFixture);

      await fractionalRealty
        .connect(user1)
        .mint(countryCode, titleDeedHash, businessIdHash);

      const tokenData = await fractionalRealty.tokenData(1);
      const erc20Token = await ethers.getContractAt(
        "FractionalizedERC20",
        tokenData.erc20Token
      );

      expect(await erc20Token.name()).to.equal("FractionalRealty Token #1");
      expect(await erc20Token.symbol()).to.equal("FRT1");
      expect(await erc20Token.totalSupply()).to.equal(0);

      const minterRole = await erc20Token.MINTER_ROLE();
      expect(await erc20Token.hasRole(minterRole, fractionalRealty.target)).to
        .be.true;
    });
  });

  describe("Minting Failure", function() {
    describe("KYC and Sanctions checks", function() {
      it("Should revert if user is not KYC'd", async function() {
        const {
          fractionalRealty,
          countryCode,
          titleDeedHash,
          businessIdHash,
          user2,
          mockKintoID
        } = await loadFixture(deployFixture);
        
        // Ensure user2 has sanctions but no KYC
        await mockKintoID.setKYC(user2.address, false);
        await mockKintoID.setSanctionsStatus(user2.address, countryCode, true);
        
        await expect(
          fractionalRealty
            .connect(user2)
            .mint(countryCode, titleDeedHash, businessIdHash)
        ).to.be.revertedWith("Must be KYC'd");
      });

      it("Should revert if user is not sanctions-safe", async function () {
        const {
          fractionalRealty,
          countryCode,
          titleDeedHash,
          businessIdHash,
          user2,
          mockKintoID
        } = await loadFixture(deployFixture);
        
        // Ensure user2 has KYC but no sanctions clearance
        await mockKintoID.setKYC(user2.address, true);
        await mockKintoID.setSanctionsStatus(user2.address, countryCode, false);

        await expect(
          fractionalRealty
            .connect(user2)
            .mint(countryCode, titleDeedHash, businessIdHash)
        ).to.be.revertedWith("Not sanctions-safe");
      });
    });

    describe("Title deed checks", function() {
      it("Should revert if wrong title deed hash", async function () {
        const { fractionalRealty, countryCode, user1 } = await loadFixture(
          deployFixture
        );

        const wrongTitleDeedHash = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
        const wrongBusinessIdHash = ethers.keccak256(ethers.toUtf8Bytes("wrong"));

        await expect(
          fractionalRealty
            .connect(user1)
            .mint(countryCode, wrongTitleDeedHash, wrongBusinessIdHash)
        ).to.be.revertedWith("Invalid title deed ownership");
      });

      it("Should revert if not title deed owner", async function() {
        const { 
          fractionalRealty, 
          countryCode, 
          titleDeedHash, 
          businessIdHash,
          user2, 
          mockKintoID
        } = await loadFixture(deployFixture);
        
        // Set up user2 with KYC and sanctions but no deed ownership
        await mockKintoID.setKYC(user2.address, true);
        await mockKintoID.setSanctionsStatus(user2.address, countryCode, true);

        await expect(
          fractionalRealty
            .connect(user2)
            .mint(countryCode, titleDeedHash, businessIdHash)
        ).to.be.revertedWith("Invalid title deed ownership");
      });
    });
  });

  describe("ERC20 Operations", function () {
    describe("Minting ERC20", function () {
      it("Should request and execute ERC20 mint", async function () {
        const { fractionalRealty, user1, tokenId, erc20Token } =
          await loadFixture(mintedTokenFixture);
        const amount = ethers.parseEther("1000");

        await expect(
          fractionalRealty
            .connect(user1)
            .requestMintERC20(tokenId, user1.address, amount)
        )
          .to.emit(fractionalRealty, "ERC20MintRequested")
          .withArgs(tokenId, user1.address, amount);

        await time.increase(7 * 24 * 60 * 60 + 1);

        await expect(
          fractionalRealty
            .connect(user1)
            .executeMintERC20(tokenId, user1.address)
        )
          .to.emit(fractionalRealty, "ERC20Minted")
          .withArgs(tokenId, user1.address, amount);

        expect(await erc20Token.balanceOf(user1.address)).to.equal(amount);
      });

      it("Should only allow token owner to request mint", async function () {
        const { fractionalRealty, user2, tokenId } = await loadFixture(
          mintedTokenFixture
        );
        const amount = ethers.parseEther("1000");

        await expect(
          fractionalRealty
            .connect(user2)
            .requestMintERC20(tokenId, user2.address, amount)
        ).to.be.revertedWith("Not token owner");
      });

      it("Should validate recipient KYC status for mint", async function () {
        const { fractionalRealty, user1, user2, tokenId } = await loadFixture(
          mintedTokenFixture
        );
        const amount = ethers.parseEther("1000");

        await expect(
          fractionalRealty
            .connect(user1)
            .requestMintERC20(tokenId, user2.address, amount)
        ).to.be.revertedWith("Invalid recipient");
      });

      it("Should respect custom timelock for mint", async function () {
        const { fractionalRealty, user1, tokenId } = await loadFixture(
          mintedTokenFixture
        );
        const amount = ethers.parseEther("1000");
        const customTimelock = 14 * 24 * 60 * 60; // 14 days

        await fractionalRealty
          .connect(user1)
          .setCustomTimelock(tokenId, customTimelock);
        await fractionalRealty
          .connect(user1)
          .requestMintERC20(tokenId, user1.address, amount);

        // Try executing just after global timelock
        await time.increase(7 * 24 * 60 * 60 + 1);
        await expect(
          fractionalRealty
            .connect(user1)
            .executeMintERC20(tokenId, user1.address)
        ).to.be.revertedWith("Timelock active");

        // Should succeed after custom timelock
        await time.increase(7 * 24 * 60 * 60);
        await expect(
          fractionalRealty
            .connect(user1)
            .executeMintERC20(tokenId, user1.address)
        ).to.emit(fractionalRealty, "ERC20Minted");
      });
    });

    describe("Burning ERC20", function () {
      async function mintedERC20Fixture() {
        const base = await loadFixture(mintedTokenFixture);
        const amount = ethers.parseEther("1000");

        await base.fractionalRealty
          .connect(base.user1)
          .requestMintERC20(base.tokenId, base.user1.address, amount);
        await time.increase(7 * 24 * 60 * 60 + 1);
        await base.fractionalRealty
          .connect(base.user1)
          .executeMintERC20(base.tokenId, base.user1.address);

        return {
          ...base,
          amount,
        };
      }

      it("Should request and execute ERC20 burn", async function () {
        const { fractionalRealty, user1, tokenId, erc20Token, amount } =
          await loadFixture(mintedERC20Fixture);

        await expect(
          fractionalRealty
            .connect(user1)
            .requestBurnERC20(tokenId, user1.address, amount)
        )
          .to.emit(fractionalRealty, "ERC20BurnRequested")
          .withArgs(tokenId, user1.address, amount);

        await time.increase(7 * 24 * 60 * 60 + 1);

        await expect(
          fractionalRealty
            .connect(user1)
            .executeBurnERC20(tokenId, user1.address)
        )
          .to.emit(fractionalRealty, "ERC20Burned")
          .withArgs(tokenId, user1.address, amount);

        expect(await erc20Token.balanceOf(user1.address)).to.equal(0);
      });

      it("Should only allow token owner to request burn", async function () {
        const { fractionalRealty, user1, user2, tokenId, amount } = await loadFixture(
          mintedERC20Fixture
        );

        await expect(
          fractionalRealty
            .connect(user2)
            .requestBurnERC20(tokenId, user1.address, amount)
        ).to.be.revertedWith("Not token owner");
      });

      it("Should respect custom timelock for burn", async function () {
        const { fractionalRealty, user1, tokenId, amount } = await loadFixture(
          mintedERC20Fixture
        );
        const customTimelock = 14 * 24 * 60 * 60; // 14 days

        await fractionalRealty
          .connect(user1)
          .setCustomTimelock(tokenId, customTimelock);
        await fractionalRealty
          .connect(user1)
          .setCustomTimelock(tokenId, customTimelock);
        await fractionalRealty
          .connect(user1)
          .requestBurnERC20(tokenId, user1.address, amount);

        // Try executing just after global timelock
        await time.increase(7 * 24 * 60 * 60 + 1);
        await expect(
          fractionalRealty
            .connect(user1)
            .executeBurnERC20(tokenId, user1.address)
        ).to.be.revertedWith("Timelock active");

        // Should succeed after custom timelock
        await time.increase(7 * 24 * 60 * 60);
        await expect(
          fractionalRealty
            .connect(user1)
            .executeBurnERC20(tokenId, user1.address)
        ).to.emit(fractionalRealty, "ERC20Burned");
      });

      it("Should not execute burn if amount has changed", async function () {
        const { fractionalRealty, user1, tokenId, amount } = await loadFixture(
          mintedERC20Fixture
        );

        await fractionalRealty
          .connect(user1)
          .requestBurnERC20(tokenId, user1.address, amount);

        // Request another burn with different amount
        await fractionalRealty
          .connect(user1)
          .requestBurnERC20(tokenId, user1.address, amount / BigInt(2));

        await time.increase(7 * 24 * 60 * 60 + 1);
        await expect(
          fractionalRealty
            .connect(user1)
            .executeBurnERC20(tokenId, user1.address)
        )
          .to.emit(fractionalRealty, "ERC20Burned")
          .withArgs(tokenId, user1.address, amount / BigInt(2));
      });
    });
  });

  describe("Token Management", function () {
    describe("Custom Timelock", function () {
      it("Should set custom timelock", async function () {
        const { fractionalRealty, user1, tokenId } = await loadFixture(
          mintedTokenFixture
        );
        const newTimelock = 14 * 24 * 60 * 60; // 14 days

        await expect(
          fractionalRealty
            .connect(user1)
            .setCustomTimelock(tokenId, newTimelock)
        )
          .to.emit(fractionalRealty, "TimelockSet")
          .withArgs(tokenId, newTimelock);

        const tokenData = await fractionalRealty.tokenData(tokenId);
        expect(tokenData.customTimelock).to.equal(newTimelock);
      });

      it("Should not allow custom timelock less than global", async function () {
        const { fractionalRealty, user1, tokenId } = await loadFixture(
          mintedTokenFixture
        );
        const invalidTimelock = 3 * 24 * 60 * 60; // 3 days

        await expect(
          fractionalRealty
            .connect(user1)
            .setCustomTimelock(tokenId, invalidTimelock)
        ).to.be.revertedWith("Cannot be less than global timelock");
      });

      it("Should only allow token owner to set custom timelock", async function () {
        const { fractionalRealty, user2, tokenId } = await loadFixture(
          mintedTokenFixture
        );
        const newTimelock = 14 * 24 * 60 * 60;

        await expect(
          fractionalRealty
            .connect(user2)
            .setCustomTimelock(tokenId, newTimelock)
        ).to.be.revertedWith("Not token owner");
      });
    });

    describe("Token Transfer Restrictions", function () {
      it("Should enforce soulbound property", async function () {
        const { fractionalRealty, user1, user2, tokenId } = await loadFixture(
          mintedTokenFixture
        );

        await expect(
          fractionalRealty
            .connect(user1)
            .transferFrom(user1.address, user2.address, tokenId)
        ).to.be.revertedWith("Token is soulbound");
      });

      it("Should enforce soulbound property with safeTransfer", async function () {
        const { fractionalRealty, user1, user2, tokenId } = await loadFixture(
          mintedTokenFixture
        );

        await expect(
          fractionalRealty
            .connect(user1)
            ["safeTransferFrom(address,address,uint256)"](
              user1.address,
              user2.address,
              tokenId
            )
        ).to.be.revertedWith("Token is soulbound");
      });

      it("Should enforce soulbound property with safeTransfer and data", async function () {
        const { fractionalRealty, user1, user2, tokenId } = await loadFixture(
          mintedTokenFixture
        );

        await expect(
          fractionalRealty
            .connect(user1)
            ["safeTransferFrom(address,address,uint256,bytes)"](
              user1.address,
              user2.address,
              tokenId,
              "0x"
            )
        ).to.be.revertedWith("Token is soulbound");
      });
    });

    describe("Token Burning", function () {
      it("Should allow burning when ERC20 supply is zero", async function () {
        const { fractionalRealty, user1, tokenId } = await loadFixture(
          mintedTokenFixture
        );

        await expect(fractionalRealty.connect(user1).burn(tokenId))
          .to.emit(fractionalRealty, "Transfer")
          .withArgs(user1.address, ethers.ZeroAddress, tokenId);

          await expect(fractionalRealty.ownerOf(tokenId)).to.be.revertedWithCustomError(
            fractionalRealty,
            "ERC721NonexistentToken(uint256)"
          ).withArgs(tokenId);
      });

      it("Should not allow burning with ERC20 supply", async function () {
        const { fractionalRealty, user1, tokenId } = await loadFixture(
          mintedTokenFixture
        );
        const amount = ethers.parseEther("1000");

        await fractionalRealty
          .connect(user1)
          .requestMintERC20(tokenId, user1.address, amount);
        await time.increase(7 * 24 * 60 * 60 + 1);
        await fractionalRealty
          .connect(user1)
          .executeMintERC20(tokenId, user1.address);

        await expect(
          fractionalRealty.connect(user1).burn(tokenId)
        ).to.be.revertedWith("ERC20 supply must be 0");
      });

      it("Should not allow non-owner to burn", async function () {
        const { fractionalRealty, user2, tokenId } = await loadFixture(
          mintedTokenFixture
        );

        await expect(
          fractionalRealty.connect(user2).burn(tokenId)
        ).to.be.revertedWith("Not token owner");
      });
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to set global timelock", async function () {
      const { fractionalRealty, owner } = await loadFixture(deployFixture);
      const newTimelock = 14 * 24 * 60 * 60; // 14 days

      await fractionalRealty.connect(owner).setGlobalTimelock(newTimelock);
      expect(await fractionalRealty.globalTimelock()).to.equal(newTimelock);
    });

    it("Should not allow non-admin to set global timelock", async function () {
      const { fractionalRealty, user1 } = await loadFixture(deployFixture);
      const newTimelock = 14 * 24 * 60 * 60;

      await expect(
        fractionalRealty.connect(user1).setGlobalTimelock(newTimelock)
      ).to.be.revertedWithCustomError(
        fractionalRealty,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("Should allow admin to grant roles", async function () {
      const { fractionalRealty, owner, user1 } = await loadFixture(
        deployFixture
      );
      const DEFAULT_ADMIN_ROLE = await fractionalRealty.DEFAULT_ADMIN_ROLE();

      await fractionalRealty
        .connect(owner)
        .grantRole(DEFAULT_ADMIN_ROLE, user1.address);
      expect(await fractionalRealty.hasRole(DEFAULT_ADMIN_ROLE, user1.address))
        .to.be.true;
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete lifecycle", async function () {
      const {
        fractionalRealty,
        mockKintoID,
        countryCode,
        titleDeedHash,
        businessIdHash,
        user1,
        user2,
      } = await loadFixture(deployFixture);

      // Mint token
      await fractionalRealty
        .connect(user1)
        .mint(countryCode, titleDeedHash, businessIdHash);
      const tokenId = 1;

      // Set custom timelock
      const customTimelock = 14 * 24 * 60 * 60;
      await fractionalRealty
        .connect(user1)
        .setCustomTimelock(tokenId, customTimelock);

      // Mint ERC20 tokens
      const amount = ethers.parseEther("1000");
      await fractionalRealty
        .connect(user1)
        .requestMintERC20(tokenId, user1.address, amount);
      await time.increase(customTimelock + 1);
      await fractionalRealty
        .connect(user1)
        .executeMintERC20(tokenId, user1.address);

      // Verify ERC20 balance
      const tokenData = await fractionalRealty.tokenData(tokenId);
      const erc20Token = await ethers.getContractAt(
        "FractionalizedERC20",
        tokenData.erc20Token
      );
      expect(await erc20Token.balanceOf(user1.address)).to.equal(amount);

      // Burn ERC20 tokens
      await fractionalRealty
        .connect(user1)
        .requestBurnERC20(tokenId, user1.address, amount);
      await time.increase(customTimelock + 1);
      await fractionalRealty
        .connect(user1)
        .executeBurnERC20(tokenId, user1.address);

      // Verify burned
      expect(await erc20Token.balanceOf(user1.address)).to.equal(0);

      // Burn NFT
      await fractionalRealty.connect(user1).burn(tokenId);
      await expect(fractionalRealty.ownerOf(tokenId)).to.be.revertedWithCustomError(
        fractionalRealty,
        "ERC721NonexistentToken(uint256)"
      ).withArgs(tokenId);
    });
  });
});
