// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract MockKintoID {
    mapping(address => bool) private kycStatus;
    mapping(address => mapping(uint16 => bool)) private sanctionsStatus;
    mapping(address => bool) private companyStatus;

    function setKYC(address user, bool status) external {
        kycStatus[user] = status;
    }

    function setSanctionsStatus(address user, uint16 countryCode, bool status) external {
        sanctionsStatus[user][countryCode] = status;
    }

    function setCompanyStatus(address user, bool status) external {
        companyStatus[user] = status;
    }

    function isKYC(address user) external view returns (bool) {
        return kycStatus[user];
    }

    function isSanctionsSafeIn(address user, uint16 countryCode) external view returns (bool) {
        return sanctionsStatus[user][countryCode];
    }

    function isCompany(address user) external view returns (bool) {
        return companyStatus[user];
    }

    receive() external payable {}
}