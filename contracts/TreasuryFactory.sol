// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IGnosisSafe {
    function addOwnerWithThreshold(address owner, uint256 _threshold) external;
    function getThreshold() external view returns (uint256);
    function getOwners() external view returns (address[] memory);
}

contract Treasury is Pausable, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum ChangeType { SPEND, SPENDER, PARAMETER, TIMELOCK }

    struct Change {
        bytes data;
        uint256 releaseTime;
        bool executed;
        ChangeType changeType;
    }

    IGnosisSafe public immutable safe;
    
    uint256 public spendingTimelock;
    uint256 public spenderTimelock;
    uint256 public parameterTimelock;
    uint256 public timelockTimelock;
    
    uint256 public minimumAmount;
    uint256 public deadline;
    
    mapping(address => bool) public spenders;
    mapping(address => bool) public whitelistedTokens;
    mapping(bytes32 => Change) public changes;
    mapping(address => mapping(address => uint256)) public deposits;
    
    event ChangeRequested(bytes32 indexed lockId, ChangeType indexed changeType);
    event ChangeExecuted(bytes32 indexed lockId);
    event NewSigner(address signer, uint256 newThreshold);
    event TokenWhitelistUpdated(address token, bool status);
    
    constructor(
        address _safe,
        uint256 _minimumAmount,
        uint256 _deadline,
        address[] memory _whitelistedTokens
    ) Ownable(_safe) {
        safe = IGnosisSafe(_safe);
        minimumAmount = _minimumAmount;
        deadline = _deadline;
        spendingTimelock = 1 days;
        spenderTimelock = 7 days;
        parameterTimelock = 3 days;
        timelockTimelock = 14 days;
        _setWhitelistedTokens(_whitelistedTokens, true);
    }

    function _setWhitelistedTokens(address[] memory tokens, bool status) internal {
        for(uint i = 0; i < tokens.length; i++) {
            whitelistedTokens[tokens[i]] = status;
            emit TokenWhitelistUpdated(tokens[i], status);
        }
    }

    function setTokenWhitelist(address[] calldata tokens, bool status) external onlyOwner {
        _setWhitelistedTokens(tokens, status);
    }
    
    function _getTimelock(ChangeType changeType) internal view returns (uint256) {
        if (changeType == ChangeType.SPEND) return spendingTimelock;
        if (changeType == ChangeType.SPENDER) return spenderTimelock;
        if (changeType == ChangeType.PARAMETER) return parameterTimelock;
        return timelockTimelock;
    }

    function requestChange(ChangeType changeType, bytes calldata data) external returns (bytes32) {
        if (changeType == ChangeType.SPEND) {
            require(spenders[msg.sender], "Not authorized spender");
        } else {
            require(msg.sender == owner(), "Not owner");
        }

        bytes32 lockId = keccak256(abi.encodePacked(msg.sender, data, block.timestamp, changeType));
        changes[lockId] = Change({
            data: data,
            releaseTime: block.timestamp + _getTimelock(changeType),
            executed: false,
            changeType: changeType
        });

        emit ChangeRequested(lockId, changeType);
        return lockId;
    }

    function executeChange(bytes32 lockId) external {
        Change storage change = changes[lockId];
        require(!change.executed, "Already executed");
        require(block.timestamp >= change.releaseTime, "Timelock not expired");

        if (change.changeType == ChangeType.SPEND) {
            (address token, uint256 amount, address recipient) = abi.decode(change.data, (address, uint256, address));
            require(whitelistedTokens[token], "Token not whitelisted");
            IERC20(token).safeTransfer(recipient, amount);
        } else if (change.changeType == ChangeType.SPENDER) {
            (address account, bool status) = abi.decode(change.data, (address, bool));
            spenders[account] = status;
        } else if (change.changeType == ChangeType.PARAMETER) {
            (uint256 newDeadline, uint256 newMinAmount) = abi.decode(change.data, (uint256, uint256));
            deadline = newDeadline;
            minimumAmount = newMinAmount;
        } else if (change.changeType == ChangeType.TIMELOCK) {
            (uint256 spendTime, uint256 spenderTime, uint256 paramTime, uint256 timeLockTime) = 
                abi.decode(change.data, (uint256, uint256, uint256, uint256));
            spendingTimelock = spendTime;
            spenderTimelock = spenderTime;
            parameterTimelock = paramTime;
            timelockTimelock = timeLockTime;
        }

        change.executed = true;
        emit ChangeExecuted(lockId);
    }

    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function deposit(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(block.timestamp < deadline, "Crowdfunding ended");
        require(amount >= minimumAmount, "Amount too low");
        require(whitelistedTokens[token], "Token not whitelisted");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][token] += amount;
        
        uint256 threshold = safe.getThreshold();
        address[] memory owners = safe.getOwners();
        uint256 newThreshold = threshold;
        
        bool isOwner = false;
        for(uint i = 0; i < owners.length; i++) {
            if(owners[i] == msg.sender) {
                isOwner = true;
                break;
            }
        }
        
        if(!isOwner) {
            if (owners.length / threshold > 2) {
                newThreshold = threshold + 1;
            }
            safe.addOwnerWithThreshold(msg.sender, newThreshold);
            emit NewSigner(msg.sender, newThreshold);
        }
    }
}

contract TreasuryFactory is ReentrancyGuard {
    using SafeERC20 for IERC20;

    event TreasuryCreated(address treasury);
    
    function createTreasury(
        address safe,
        uint256 minimumAmount,
        uint256 deadline,
        address[] calldata whitelistedTokens,
        address depositToken,
        uint256 depositAmount
    ) external nonReentrant returns (address) {
        require(depositAmount >= minimumAmount, "Initial deposit too low");
        
        IGnosisSafe safeContract = IGnosisSafe(safe);
        require(safeContract.getThreshold() == 1, "Invalid safe threshold");
        
        address[] memory owners = safeContract.getOwners();
        require(owners.length == 1, "Invalid number of owners");
        require(owners[0] == msg.sender, "Invalid owner");

        bool validToken = false;
        for(uint i = 0; i < whitelistedTokens.length; i++) {
            if(whitelistedTokens[i] == depositToken) {
                validToken = true;
                break;
            }
        }
        require(validToken, "Deposit token not whitelisted");

        Treasury treasury = new Treasury(
            safe,
            minimumAmount,
            deadline,
            whitelistedTokens
        );
        
        IERC20(depositToken).safeTransferFrom(msg.sender, address(treasury), depositAmount);
        
        emit TreasuryCreated(address(treasury));
        return address(treasury);
    }
}