// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
// import hre from "hardhat";

// describe("Treasury", function () {
//   async function deployFixture() {
//     const [owner, user1, user2] = await ethers.getSigners();

//     const MockSafe = await ethers.getContractFactory("MockSafe");
//     const mockSafe = await MockSafe.deploy(owner.address);

//     const MockToken = await ethers.getContractFactory("MockERC20");
//     const token1 = await MockToken.deploy("Token1", "TK1");
//     const token2 = await MockToken.deploy("Token2", "TK2");

//     const minimumAmount = ethers.parseEther("100");
//     const deadline = BigInt((await time.latest())) + BigInt(7 * 24 * 60 * 60); // 1 week

//     const TreasuryFactory = await ethers.getContractFactory("TreasuryFactory");
//     const factory = await TreasuryFactory.deploy();

//     // Mint tokens to users
//     await token1.connect(owner).transfer(user1.address, minimumAmount * BigInt(2));
//     await token1.connect(owner).transfer(user2.address, minimumAmount * BigInt(2));
    
//     // Pre-approve tokens
//     await token1.connect(owner).approve(factory.target, minimumAmount * BigInt(2));
//     await token1.connect(user1).approve(factory.target, minimumAmount * BigInt(2));

//     return {
//       factory,
//       mockSafe,
//       token1,
//       token2,
//       minimumAmount,
//       deadline,
//       owner,
//       user1,
//       user2
//     };
//   }

//   async function deployTreasuryFixture() {
//     const base = await loadFixture(deployFixture);
    
//     const tx = await base.factory.connect(base.owner).createTreasury(
//       base.mockSafe.target,
//       base.minimumAmount,
//       base.deadline,
//       [base.token1.target],
//       base.token1.target,
//       base.minimumAmount
//     );

//     const receipt = await tx.wait();
//     const event = receipt?.logs.find(x => x.fragment?.name === 'TreasuryCreated');
//     const treasuryAddress = event?.args?.[0];
//     const treasury = await ethers.getContractAt("Treasury", treasuryAddress);

//     // Impersonate safe account
//     await hre.network.provider.request({
//       method: "hardhat_impersonateAccount",
//       params: [base.mockSafe.target],
//     });

//     // Fund safe account with ETH for gas
//     await base.owner.sendTransaction({
//       to: base.mockSafe.target,
//       value: ethers.parseEther("1"),
//     });

//     const safeSigner = await ethers.getSigner(base.mockSafe.target);

//     return {
//       ...base,
//       treasury,
//       safeSigner
//     };
//   }

//   describe("Factory", function () {
//     it("Should deploy treasury with correct parameters", async function () {
//       const { factory, mockSafe, token1, minimumAmount, deadline, owner } = await loadFixture(deployFixture);

//       await expect(factory.connect(owner).createTreasury(
//         mockSafe.target,
//         minimumAmount,
//         deadline,
//         [token1.target],
//         token1.target,
//         minimumAmount
//       )).to.emit(factory, "TreasuryCreated").withArgs(anyValue);
//     });

//     it("Should revert if deposit amount is less than minimum", async function () {
//       const { factory, mockSafe, token1, minimumAmount, deadline, owner } = await loadFixture(deployFixture);

//       await expect(factory.connect(owner).createTreasury(
//         mockSafe.target,
//         minimumAmount,
//         deadline,
//         [token1.target],
//         token1.target,
//         minimumAmount - BigInt(1)
//       )).to.be.revertedWith("Initial deposit too low");
//     });

//     it("Should verify safe has only one owner with threshold 1", async function () {
//       const { factory, mockSafe, token1, minimumAmount, deadline, owner } = await loadFixture(deployFixture);

//       await mockSafe.addOwnerWithThreshold(owner.address, 2);

//       await expect(factory.connect(owner).createTreasury(
//         mockSafe.target,
//         minimumAmount,
//         deadline,
//         [token1.target],
//         token1.target,
//         minimumAmount
//       )).to.be.revertedWith("Invalid safe threshold");
//     });
//   });

//   describe("Treasury", function () {
//     describe("Deposits", function () {
//       it("Should accept deposits from whitelisted tokens", async function () {
//         const { treasury, token1, user1, minimumAmount } = await loadFixture(deployTreasuryFixture);

//         await token1.connect(user1).approve(treasury.target, minimumAmount);
        
//         await expect(treasury.connect(user1).deposit(token1.target, minimumAmount))
//           .to.emit(treasury, "NewSigner")
//           .withArgs(user1.address, anyValue);

//         expect(await treasury.deposits(user1.address, token1.target)).to.equal(minimumAmount);
//       });

//       it("Should reject deposits from non-whitelisted tokens", async function () {
//         const { treasury, token2, user1, minimumAmount } = await loadFixture(deployTreasuryFixture);
        
//         await token2.connect(user1).approve(treasury.target, minimumAmount);
        
//         await expect(treasury.connect(user1).deposit(token2.target, minimumAmount))
//           .to.be.revertedWith("Token not whitelisted");
//       });

//       it("Should reject deposits after deadline", async function () {
//         const { treasury, token1, user1, minimumAmount, deadline } = await loadFixture(deployTreasuryFixture);

//         await time.increaseTo(deadline + BigInt(1));
        
//         await expect(treasury.connect(user1).deposit(token1.target, minimumAmount))
//           .to.be.revertedWith("Crowdfunding ended");
//       });
//     });

//     describe("Change Requests", function () {
//       it("Should create spender change request", async function () {
//         const { treasury, user1, safeSigner } = await loadFixture(deployTreasuryFixture);
        
//         const data = ethers.AbiCoder.defaultAbiCoder().encode(
//           ['address', 'bool'],
//           [user1.address, true]
//         );

//         await expect(treasury.connect(safeSigner).requestChange(1, data))
//           .to.emit(treasury, "ChangeRequested")
//           .withArgs(anyValue, 1);
//       });

//       it("Should execute change request after timelock", async function () {
//         const { treasury, user1, safeSigner } = await loadFixture(deployTreasuryFixture);
        
//         const data = ethers.AbiCoder.defaultAbiCoder().encode(
//           ['address', 'bool'],
//           [user1.address, true]
//         );

//         const tx = await treasury.connect(safeSigner).requestChange(1, data);
//         const receipt = await tx.wait();
//         const event = receipt?.logs.find(x => x.fragment?.name === 'ChangeRequested');
//         const lockId = event?.args?.[0];

//         await time.increase(7 * 24 * 60 * 60 + 1);

//         await expect(treasury.connect(safeSigner).executeChange(lockId))
//           .to.emit(treasury, "ChangeExecuted")
//           .withArgs(lockId);

//         expect(await treasury.spenders(user1.address)).to.be.true;
//       });

//       it("Should not execute change request before timelock", async function () {
//         const { treasury, user1, safeSigner } = await loadFixture(deployTreasuryFixture);
        
//         const data = ethers.AbiCoder.defaultAbiCoder().encode(
//           ['address', 'bool'],
//           [user1.address, true]
//         );

//         const tx = await treasury.connect(safeSigner).requestChange(1, data);
//         const receipt = await tx.wait();
//         const event = receipt?.logs.find(x => x.fragment?.name === 'ChangeRequested');
//         const lockId = event?.args?.[0];

//         await expect(treasury.connect(safeSigner).executeChange(lockId))
//           .to.be.revertedWith("Timelock not expired");
//       });
//     });

//     describe("Token Whitelist", function () {
//       it("Should allow owner to add whitelisted token", async function () {
//         const { treasury, token2, safeSigner } = await loadFixture(deployTreasuryFixture);
        
//         await expect(treasury.connect(safeSigner).setTokenWhitelist([token2.target], true))
//           .to.emit(treasury, "TokenWhitelistUpdated")
//           .withArgs(token2.target, true);

//         expect(await treasury.whitelistedTokens(token2.target)).to.be.true;
//       });

//       it("Should allow owner to remove whitelisted token", async function () {
//         const { treasury, token1, safeSigner } = await loadFixture(deployTreasuryFixture);
        
//         await expect(treasury.connect(safeSigner).setTokenWhitelist([token1.target], false))
//           .to.emit(treasury, "TokenWhitelistUpdated")
//           .withArgs(token1.target, false);

//         expect(await treasury.whitelistedTokens(token1.target)).to.be.false;
//       });
//     });

//     describe("Pause/Unpause", function () {
//       it("Should allow owner to pause and unpause", async function () {
//         const { treasury, safeSigner } = await loadFixture(deployTreasuryFixture);
        
//         await expect(treasury.connect(safeSigner).pause())
//           .to.not.be.reverted;
//         expect(await treasury.paused()).to.be.true;

//         await expect(treasury.connect(safeSigner).unpause())
//           .to.not.be.reverted;
//         expect(await treasury.paused()).to.be.false;
//       });

//       it("Should not allow deposits when paused", async function () {
//         const { treasury, token1, user1, minimumAmount, safeSigner } = await loadFixture(deployTreasuryFixture);
        
//         await treasury.connect(safeSigner).pause();
        
//         await expect(treasury.connect(user1).deposit(token1.target, minimumAmount))
//           .to.be.revertedWithCustomError(treasury, "EnforcedPause");
//       });
//     });
//   });
// });