// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IKintoID {
    function isKYC(address user) external view returns (bool);

    function isCompany(address business) external view returns (bool);

    function isSanctionsSafeIn(
        address user,
        uint16 countryCode
    ) external view returns (bool);
}

contract MockAttester is Ownable {
    IKintoID public constant kintoID =
        IKintoID(0xf369f78E3A0492CC4e96a90dae0728A38498e9c7);

    mapping(address => bool) public attesters;
    mapping(bytes32 => bytes32) public businessToTitleDeed; // businessIdHash => titleDeedHash
    mapping(bytes32 => address) public titleDeedOwners; // titleDeedHash => owner

    event AttesterAdded(address indexed attester);
    event AttesterRemoved(address indexed attester);
    event TitleDeedAttested(
        bytes32 indexed titleDeedHash,
        bytes32 indexed businessIdHash,
        address indexed owner
    );

    constructor() Ownable(msg.sender) {}

    modifier onlyAttester() {
        require(attesters[msg.sender], "Not an attester");
        _;
    }

    function addAttester(address attester) external onlyOwner {
        attesters[attester] = true;
        emit AttesterAdded(attester);
    }

    function removeAttester(address attester) external onlyOwner {
        attesters[attester] = false;
        emit AttesterRemoved(attester);
    }

    function attestTitleDeedOwnership(
        bytes32 businessIdHash,
        bytes32 titleDeedHash,
        address owner
    ) external onlyAttester {
        require(kintoID.isKYC(owner), "Owner not KYC'd");
        // In production enable this!
        // require(kintoID.isCompany(owner), "Owner not KYB'd");

        businessToTitleDeed[businessIdHash] = titleDeedHash;
        titleDeedOwners[titleDeedHash] = owner;

        emit TitleDeedAttested(titleDeedHash, businessIdHash, owner);
    }

    function ownerOf(bytes32 titleDeedHash) external view returns (address) {
        address owner = titleDeedOwners[titleDeedHash];
        require(owner != address(0), "Title deed not attested");
        return owner;
    }

    function verifyTitleDeedOwnership(
        bytes32 businessIdHash,
        bytes32 titleDeedHash,
        address owner
    ) external view returns (bool) {
        return
            businessToTitleDeed[businessIdHash] == titleDeedHash &&
            titleDeedOwners[titleDeedHash] == owner;
    }
}
