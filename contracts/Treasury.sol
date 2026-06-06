// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @notice Holds all bounty funds and releases payments to agents.
 *         Only callable by TaskRegistry — no manual withdrawals.
 *         Every payment emits a permanent on-chain event for auditing.
 */
contract Treasury is AccessControl, ReentrancyGuard {
    bytes32 public constant REGISTRY_ROLE = keccak256("REGISTRY_ROLE");

    /// @dev Escrow record per task
    struct Escrow {
        uint256 taskId;
        uint256 amount;
        bool deposited;
        bool released;
    }

    /// @dev Total balance across all escrows
    uint256 public totalLocked;

    /// @dev Per-task escrow records
    mapping(uint256 => Escrow) public escrows;

    /// @dev Per-task: has it been refunded?
    mapping(uint256 => bool) public refunded;

    event BountyDeposited(uint256 indexed taskId, uint256 amount);
    event FundsReleased(uint256 indexed taskId, address indexed agent, uint256 amount);
    event PaymentEvent(uint256 indexed taskId, address indexed agent, uint256 amount, string action);

    modifier onlyRegistry() {
        require(hasRole(REGISTRY_ROLE, msg.sender), "Only TaskRegistry");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Set the TaskRegistry contract address.
     * @param registry TaskRegistry contract address
     */
    function setRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(registry != address(0), "Invalid address");
        _grantRole(REGISTRY_ROLE, registry);
    }

    /**
     * @notice Receive and lock bounty funds when a task is created.
     *         Only callable by TaskRegistry.
     * @param taskId ID of the task
     */
    function depositBounty(uint256 taskId) external payable onlyRegistry nonReentrant {
        require(msg.value > 0, "No funds sent");
        require(!escrows[taskId].deposited, "Already deposited");

        escrows[taskId] = Escrow({
            taskId: taskId,
            amount: msg.value,
            deposited: true,
            released: false
        });

        totalLocked += msg.value;

        emit BountyDeposited(taskId, msg.value);
        emit PaymentEvent(taskId, address(0), msg.value, "bounty_deposited");
    }

    /**
     * @notice Release funds to an agent upon successful task completion.
     *         Only callable by TaskRegistry.
     * @param taskId ID of the completed task
     * @param agent Recipient agent wallet
     */
    function releaseFunds(uint256 taskId, address agent) external onlyRegistry nonReentrant {
        Escrow storage escrow = escrows[taskId];
        require(escrow.deposited, "Not deposited");
        require(!escrow.released, "Already released");
        require(!refunded[taskId], "Already refunded");
        require(agent != address(0), "Invalid agent");

        escrow.released = true;
        totalLocked -= escrow.amount;

        uint256 amount = escrow.amount;

        (bool sent, ) = payable(agent).call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsReleased(taskId, agent, amount);
        emit PaymentEvent(taskId, agent, amount, "payment_released");
    }

    /**
     * @notice Get the balance of the treasury contract.
     */
    function getBalance() external view returns (uint256 contractBalance, uint256 locked, uint256 available) {
        contractBalance = address(this).balance;
        locked = totalLocked;
        available = contractBalance - locked;
    }

    /**
     * @notice Get escrow details for a specific task.
     */
    function getEscrow(uint256 taskId) external view returns (Escrow memory) {
        return escrows[taskId];
    }

    /**
     * @notice Emergency withdrawal of accidentally sent funds (admin only).
     */
    function emergencyWithdraw(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount <= address(this).balance - totalLocked, "Insufficient unlocked funds");
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdraw failed");
    }

    // Allow contract to receive ETH directly
    receive() external payable {}
}
