// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockSafe {
    address[] public owners;
    uint256 public threshold;

    receive() external payable {}

    constructor(address initialOwner) {
        owners.push(initialOwner);
        threshold = 1;
    }

    function addOwnerWithThreshold(address owner, uint256 _threshold) external {
        owners.push(owner);
        threshold = _threshold;
    }

    function getThreshold() external view returns (uint256) {
        return threshold;
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }
}