// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IKintoID {
    function isKYC(address user) external view returns (bool);

    function isCompany(address business) external view returns (bool);

    function isSanctionsSafeIn(
        address user,
        uint16 countryCode
    ) external view returns (bool);
}

interface IAttester {
    function attestTitleDeedOwnership(
        bytes32 businessIdHash,
        bytes32 titleDeedHash,
        address owner
    ) external;

    function ownerOf(bytes32 titleDeedHash) external view returns (address);

    function verifyTitleDeedOwnership(
        bytes32 businessIdHash,
        bytes32 titleDeedHash,
        address owner
    ) external view returns (bool);
}

interface IFractionalRealty {
    function getCountryCode(uint256 tokenId) external view returns (uint16);
}

interface IFractionalizedERC20 is IERC20 {
    function mint(address to, uint256 amount) external;

    function burn(address from, uint256 amount) external;

    function MINTER_ROLE() external view returns (bytes32);

    function grantRole(bytes32 role, address account) external;
}

contract FractionalizedERC20 is ERC20, AccessControl {
    IKintoID public constant kintoID =
        IKintoID(0xf369f78E3A0492CC4e96a90dae0728A38498e9c7);
    IFractionalRealty public immutable fractionalRealty;
    uint256 public immutable tokenId;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory name,
        string memory symbol,
        address _fractionalRealty,
        uint256 _tokenId
    ) ERC20(name, symbol) {
        fractionalRealty = IFractionalRealty(_fractionalRealty);
        tokenId = _tokenId;

        // Grant both DEFAULT_ADMIN_ROLE and MINTER_ROLE to the creator (FractionalRealty contract)
        _grantRole(DEFAULT_ADMIN_ROLE, _fractionalRealty);
        _grantRole(MINTER_ROLE, _fractionalRealty);
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        require(
            to == address(0) || // Allow burning
                (kintoID.isKYC(to) &&
                    kintoID.isSanctionsSafeIn(
                        to,
                        fractionalRealty.getCountryCode(tokenId)
                    )),
            "Recipient must be KYC'd and sanctions-safe"
        );
        super._update(from, to, amount);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

contract FractionalRealty is
    ERC721,
    AccessControl,
    ReentrancyGuard,
    IFractionalRealty
{
    struct TokenData {
        uint16 countryCode;
        bytes32 titleDeedHash;
        bytes32 businessIdHash;
        address erc20Token;
        uint256 timelockUntil;
        uint256 customTimelock;
    }

    IKintoID public constant kintoID =
        IKintoID(0xf369f78E3A0492CC4e96a90dae0728A38498e9c7);
    IAttester public immutable attester;

    uint256 public currentTokenId;
    uint256 public globalTimelock = 7 days;
    mapping(uint256 => TokenData) public tokenData;
    mapping(uint256 => uint256) public pendingMints;
    mapping(uint256 => uint256) public pendingBurns;

    event TimelockSet(uint256 tokenId, uint256 duration);
    event ERC20MintRequested(uint256 tokenId, address to, uint256 amount);
    event ERC20BurnRequested(uint256 tokenId, address from, uint256 amount);
    event ERC20Minted(uint256 tokenId, address to, uint256 amount);
    event ERC20Burned(uint256 tokenId, address from, uint256 amount);

    constructor(address _attester) ERC721("FractionalRealty", "FRT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        attester = IAttester(_attester);
    }

    function getCountryCode(
        uint256 tokenId
    ) external view override returns (uint16) {
        return tokenData[tokenId].countryCode;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function mint(
        uint16 _countryCode,
        bytes32 _titleDeedHash,
        bytes32 _businessIdHash
    ) external {
        require(kintoID.isKYC(msg.sender), "Must be KYC'd");
        require(
            kintoID.isSanctionsSafeIn(msg.sender, _countryCode),
            "Not sanctions-safe"
        );
        require(
            attester.verifyTitleDeedOwnership(
                _businessIdHash,
                _titleDeedHash,
                msg.sender
            ),
            "Invalid title deed ownership"
        );
        require(
            attester.ownerOf(_titleDeedHash) == msg.sender,
            "Not title deed owner"
        );

        currentTokenId++;
        uint256 newTokenId = currentTokenId;

        // Deploy new ERC20 token
        string memory numberStr = toString(newTokenId);
        string memory erc20Name = string(
            abi.encodePacked("FractionalRealty Token #", numberStr)
        );
        string memory erc20Symbol = string(abi.encodePacked("FRT", numberStr));
        FractionalizedERC20 erc20 = new FractionalizedERC20(
            erc20Name,
            erc20Symbol,
            address(this),
            newTokenId
        );

        // Setup token data
        tokenData[newTokenId] = TokenData({
            countryCode: _countryCode,
            titleDeedHash: _titleDeedHash,
            businessIdHash: _businessIdHash,
            erc20Token: address(erc20),
            timelockUntil: 0,
            customTimelock: 0
        });

        // Grant minter role to this contract
        erc20.grantRole(erc20.MINTER_ROLE(), address(this));

        _safeMint(msg.sender, newTokenId);
    }

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(
            IFractionalizedERC20(tokenData[tokenId].erc20Token).totalSupply() ==
                0,
            "ERC20 supply must be 0"
        );
        _burn(tokenId);
    }

    function setCustomTimelock(uint256 tokenId, uint256 duration) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(
            duration >= globalTimelock,
            "Cannot be less than global timelock"
        );
        tokenData[tokenId].customTimelock = duration;
        emit TimelockSet(tokenId, duration);
    }

    function requestMintERC20(
        uint256 tokenId,
        address to,
        uint256 amount
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(
            kintoID.isKYC(to) &&
                kintoID.isSanctionsSafeIn(to, tokenData[tokenId].countryCode),
            "Invalid recipient"
        );

        uint256 timelockDuration = tokenData[tokenId].customTimelock > 0
            ? tokenData[tokenId].customTimelock
            : globalTimelock;

        tokenData[tokenId].timelockUntil = block.timestamp + timelockDuration;
        pendingMints[tokenId] = amount;

        emit ERC20MintRequested(tokenId, to, amount);
    }

    function executeMintERC20(
        uint256 tokenId,
        address to
    ) external nonReentrant {
        require(
            block.timestamp >= tokenData[tokenId].timelockUntil,
            "Timelock active"
        );
        require(pendingMints[tokenId] > 0, "No pending mint");

        uint256 amount = pendingMints[tokenId];
        pendingMints[tokenId] = 0;

        IFractionalizedERC20(tokenData[tokenId].erc20Token).mint(to, amount);
        emit ERC20Minted(tokenId, to, amount);
    }

    function requestBurnERC20(
        uint256 tokenId,
        address from,
        uint256 amount
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");

        uint256 timelockDuration = tokenData[tokenId].customTimelock > 0
            ? tokenData[tokenId].customTimelock
            : globalTimelock;

        tokenData[tokenId].timelockUntil = block.timestamp + timelockDuration;
        pendingBurns[tokenId] = amount;

        emit ERC20BurnRequested(tokenId, from, amount);
    }

    function executeBurnERC20(
        uint256 tokenId,
        address from
    ) external nonReentrant {
        require(
            block.timestamp >= tokenData[tokenId].timelockUntil,
            "Timelock active"
        );
        require(pendingBurns[tokenId] > 0, "No pending burn");

        uint256 amount = pendingBurns[tokenId];
        pendingBurns[tokenId] = 0;

        IFractionalizedERC20(tokenData[tokenId].erc20Token).burn(from, amount);
        emit ERC20Burned(tokenId, from, amount);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        // Enforce soulbound property
        require(from == address(0) || to == address(0), "Token is soulbound");

        return super._update(to, tokenId, auth);
    }

    // Admin function to set global timelock
    function setGlobalTimelock(
        uint256 duration
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalTimelock = duration;
    }

    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
