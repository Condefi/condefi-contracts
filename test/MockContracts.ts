import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import hre from "hardhat";

describe("Mock Contracts Tests", function () {
  let mockKintoID: Contract;
  let mockAttester: Contract;
  let owner: SignerWithAddress;
  let attester: SignerWithAddress;
  let user: SignerWithAddress;
  let company: SignerWithAddress;
  let otherUser: SignerWithAddress;

  // Constants used throughout tests
  const KINTO_ID_ADDRESS = "0xf369f78E3A0492CC4e96a90dae0728A38498e9c7";
  const countryCode = 840; // USA
  const countryCode2 = 124; // Canada
  const businessIdHash = ethers.keccak256(ethers.toUtf8Bytes("business123"));
  const titleDeedHash = ethers.keccak256(ethers.toUtf8Bytes("titleDeed123"));

  before(async function() {
    // First, get signer and fund address
    const [_owner] = await ethers.getSigners();
    
    // Fund the hardcoded address
    await _owner.sendTransaction({
      to: KINTO_ID_ADDRESS,
      value: ethers.parseEther("1")
    });

    // Clear any existing code at the address
    await hre.network.provider.request({
      method: "hardhat_setCode",
      params: [KINTO_ID_ADDRESS, "0x"],
    });
    
  });

  beforeEach(async function () {
    [owner, attester, user, company, otherUser] = await ethers.getSigners();

    // Deploy a fresh MockKintoID implementation
    const MockKintoID = await ethers.getContractFactory("MockKintoID");
    const mockKintoIDImpl = await MockKintoID.deploy();

    // Set storage slots to zero at the hardcoded address
    await hre.network.provider.request({
      method: "hardhat_setStorageAt",
      params: [
        KINTO_ID_ADDRESS,
        "0x0",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
    });

    // Set the implementation code
    await hre.network.provider.request({
      method: "hardhat_setCode",
      params: [KINTO_ID_ADDRESS, await ethers.provider.getCode(mockKintoIDImpl.target)],
    });

    // Get interface at the hardcoded address
    mockKintoID = await ethers.getContractAt("MockKintoID", KINTO_ID_ADDRESS);

    // Deploy fresh MockAttester
    const MockAttester = await ethers.getContractFactory("MockAttester");
    mockAttester = await MockAttester.deploy();

    // Set up initial states
    await mockKintoID.setKYC(user.address, true);
    await mockKintoID.setSanctionsStatus(user.address, countryCode, true);
    await mockKintoID.setCompanyStatus(company.address, true);
  });

  describe("MockKintoID", function () {
    describe("KYC Status", function () {
      it("should set and get KYC status correctly", async function () {
        await mockKintoID.setKYC(user.address, true);
        expect(await mockKintoID.isKYC(user.address)).to.be.true;

        await mockKintoID.setKYC(user.address, false);
        expect(await mockKintoID.isKYC(user.address)).to.be.false;
      });

      it("should return false for unset KYC status", async function () {
        expect(await mockKintoID.isKYC(otherUser.address)).to.be.false;
      });
    });

    describe("Sanctions Status", function () {
      it("should set and get sanctions status correctly", async function () {
        await mockKintoID.setSanctionsStatus(user.address, countryCode, true);
        expect(await mockKintoID.isSanctionsSafeIn(user.address, countryCode)).to.be.true;

        await mockKintoID.setSanctionsStatus(user.address, countryCode, false);
        expect(await mockKintoID.isSanctionsSafeIn(user.address, countryCode)).to.be.false;
      });

      it("should handle multiple country codes independently", async function () {
        await mockKintoID.setSanctionsStatus(user.address, countryCode, true);
        await mockKintoID.setSanctionsStatus(user.address, countryCode2, false);

        expect(await mockKintoID.isSanctionsSafeIn(user.address, countryCode)).to.be.true;
        expect(await mockKintoID.isSanctionsSafeIn(user.address, countryCode2)).to.be.false;
      });
    });

    describe("Company Status", function () {
      it("should set and get company status correctly", async function () {
        await mockKintoID.setCompanyStatus(company.address, true);
        expect(await mockKintoID.isCompany(company.address)).to.be.true;

        await mockKintoID.setCompanyStatus(company.address, false);
        expect(await mockKintoID.isCompany(company.address)).to.be.false;
      });

      it("should return false for unset company status", async function () {
        expect(await mockKintoID.isCompany(otherUser.address)).to.be.false;
      });
    });
  });

  describe("MockAttester", function () {
    beforeEach(async function () {
      // Reset KYC status before each test
      await mockKintoID.setKYC(user.address, true);
    });

    describe("Attester Management", function () {
      it("should allow owner to add attester", async function () {
        await expect(mockAttester.connect(owner).addAttester(attester.address))
          .to.emit(mockAttester, "AttesterAdded")
          .withArgs(attester.address);

        expect(await mockAttester.attesters(attester.address)).to.be.true;
      });

      it("should allow owner to remove attester", async function () {
        await mockAttester.connect(owner).addAttester(attester.address);
        
        await expect(mockAttester.connect(owner).removeAttester(attester.address))
          .to.emit(mockAttester, "AttesterRemoved")
          .withArgs(attester.address);

        expect(await mockAttester.attesters(attester.address)).to.be.false;
      });

      it("should not allow non-owner to add attester", async function () {
        await expect(
          mockAttester.connect(user).addAttester(attester.address)
        ).to.be.revertedWithCustomError(mockAttester, "OwnableUnauthorizedAccount");
      });

      it("should not allow non-owner to remove attester", async function () {
        await mockAttester.connect(owner).addAttester(attester.address);
        
        await expect(
          mockAttester.connect(user).removeAttester(attester.address)
        ).to.be.revertedWithCustomError(mockAttester, "OwnableUnauthorizedAccount");
      });
    });

    describe("Title Deed Attestation", function () {
      beforeEach(async function () {
        // Add attester role
        await mockAttester.connect(owner).addAttester(attester.address);
      });

      it("should allow attester to attest title deed ownership", async function () {
        await expect(
          mockAttester
            .connect(attester)
            .attestTitleDeedOwnership(businessIdHash, titleDeedHash, user.address)
        )
          .to.emit(mockAttester, "TitleDeedAttested")
          .withArgs(titleDeedHash, businessIdHash, user.address);

        expect(await mockAttester.businessToTitleDeed(businessIdHash)).to.equal(titleDeedHash);
        expect(await mockAttester.titleDeedOwners(titleDeedHash)).to.equal(user.address);
      });

      it("should not allow non-attester to attest title deed ownership", async function () {
        await expect(
          mockAttester
            .connect(user)
            .attestTitleDeedOwnership(businessIdHash, titleDeedHash, user.address)
        ).to.be.revertedWith("Not an attester");
      });

      it("should not allow attestation for non-KYC user", async function () {
        // Remove KYC status
        await mockKintoID.setKYC(user.address, false);
        
        await expect(
          mockAttester
            .connect(attester)
            .attestTitleDeedOwnership(businessIdHash, titleDeedHash, user.address)
        ).to.be.revertedWith("Owner not KYC'd");
      });
    });

    describe("Title Deed Verification", function () {
      beforeEach(async function () {
        // Setup attester and attest a title deed
        await mockAttester.connect(owner).addAttester(attester.address);
        await mockAttester
          .connect(attester)
          .attestTitleDeedOwnership(businessIdHash, titleDeedHash, user.address);
      });

      it("should verify valid title deed ownership", async function () {
        expect(
          await mockAttester.verifyTitleDeedOwnership(
            businessIdHash,
            titleDeedHash,
            user.address
          )
        ).to.be.true;
      });

      it("should not verify invalid title deed ownership", async function () {
        const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
        expect(
          await mockAttester.verifyTitleDeedOwnership(
            wrongHash,
            titleDeedHash,
            user.address
          )
        ).to.be.false;
      });

      it("should get correct owner of title deed", async function () {
        expect(await mockAttester.ownerOf(titleDeedHash)).to.equal(user.address);
      });

      it("should revert when querying owner of non-existent title deed", async function () {
        const nonExistentDeed = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
        await expect(
          mockAttester.ownerOf(nonExistentDeed)
        ).to.be.revertedWith("Title deed not attested");
      });
    });
  });
});