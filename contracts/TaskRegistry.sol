// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentRegistry.sol";
import "./Treasury.sol";

/**
 * @title TaskRegistry
 * @notice Central coordination layer for the Agent Payroll Protocol.
 *         Handles full task lifecycle: create → assign → submit proof → release payment.
 */
contract TaskRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    AgentRegistry public agentRegistry;
    Treasury public treasury;

    enum TaskStatus { Open, Assigned, Completed, Disputed, Expired }

    struct Task {
        uint256 id;
        address creator;
        address assignee;
        string description;
        string successCriteria;
        uint256 bountyAmount;
        uint256 deadline;
        TaskStatus status;
        string proofHash;
        bool paymentReleased;
    }

    uint256 public taskCounter;
    mapping(uint256 => Task) public tasks;
    mapping(address => uint256[]) public agentTasks;
    mapping(address => uint256[]) public creatorTasks;

    event TaskCreated(uint256 indexed taskId, address indexed creator, uint256 bountyAmount, uint256 deadline);
    event TaskAssigned(uint256 indexed taskId, address indexed assignee);
    event ProofSubmitted(uint256 indexed taskId, string proofHash);
    event PaymentReleased(uint256 indexed taskId, address indexed assignee, uint256 amount);
    event TaskDisputed(uint256 indexed taskId);
    event TaskExpired(uint256 indexed taskId);

    modifier onlyRegisteredAgent() {
        require(agentRegistry.isRegistered(msg.sender), "Agent not registered");
        _;
    }

    modifier onlyTaskAssignee(uint256 taskId) {
        require(tasks[taskId].assignee == msg.sender, "Not task assignee");
        _;
    }

    modifier onlyTaskCreator(uint256 taskId) {
        require(tasks[taskId].creator == msg.sender, "Not task creator");
        _;
    }

    constructor(address _agentRegistry, address _treasury) {
        require(_agentRegistry != address(0), "Invalid AgentRegistry");
        require(_treasury != address(0), "Invalid Treasury");
        agentRegistry = AgentRegistry(_agentRegistry);
        treasury = Treasury(payable(_treasury));
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    /**
     * @notice Create a new task with a bounty locked in escrow.
     * @param description Task description
     * @param successCriteria Criteria for proof verification
     * @param bountyAmount Amount in wei (mETH/USDY compatible)
     * @param deadline Unix timestamp deadline
     */
    function createTask(
        string calldata description,
        string calldata successCriteria,
        uint256 bountyAmount,
        uint256 deadline
    ) external payable nonReentrant returns (uint256) {
        require(bountyAmount > 0, "Bounty must be > 0");
        require(msg.value == bountyAmount, "Must send exact bounty");
        require(deadline > block.timestamp, "Deadline must be in future");
        require(bytes(description).length > 0, "Description required");
        require(bytes(successCriteria).length > 0, "Success criteria required");

        taskCounter++;
        uint256 taskId = taskCounter;

        tasks[taskId] = Task({
            id: taskId,
            creator: msg.sender,
            assignee: address(0),
            description: description,
            successCriteria: successCriteria,
            bountyAmount: bountyAmount,
            deadline: deadline,
            status: TaskStatus.Open,
            proofHash: "",
            paymentReleased: false
        });

        creatorTasks[msg.sender].push(taskId);

        // Lock bounty in treasury
        treasury.depositBounty{value: bountyAmount}(taskId);

        emit TaskCreated(taskId, msg.sender, bountyAmount, deadline);
        return taskId;
    }

    /**
     * @notice Claim an open task. Agent must be registered.
     * @param taskId ID of the task to claim
     */
    function assignTask(uint256 taskId) external onlyRegisteredAgent nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "Task not open");
        require(task.deadline > block.timestamp, "Task expired");

        task.assignee = msg.sender;
        task.status = TaskStatus.Assigned;

        agentTasks[msg.sender].push(taskId);

        emit TaskAssigned(taskId, msg.sender);
    }

    /**
     * @notice Submit proof of completion for an assigned task.
     * @param taskId ID of the completed task
     * @param proofHash Verifiable proof hash of the result
     */
    function submitProof(uint256 taskId, string calldata proofHash)
        external
        onlyTaskAssignee(taskId)
        nonReentrant
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Assigned, "Task not assigned");
        require(task.deadline > block.timestamp, "Task expired");
        require(bytes(proofHash).length > 0, "Proof required");

        task.proofHash = proofHash;
        task.status = TaskStatus.Completed;
        task.paymentReleased = true;

        // Release payment to agent
        treasury.releaseFunds(taskId, task.assignee);

        // Update agent reputation
        agentRegistry.recordTaskCompletion(task.assignee, taskId);

        emit ProofSubmitted(taskId, proofHash);
        emit PaymentReleased(taskId, task.assignee, task.bountyAmount);
    }

    /**
     * @notice Dispute a task (creator or operator).
     * @param taskId ID of the disputed task
     */
    function disputeTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(
            msg.sender == task.creator || hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorized"
        );
        require(task.status == TaskStatus.Assigned, "Task not assignable");
        require(task.deadline > block.timestamp, "Task expired");

        task.status = TaskStatus.Disputed;

        emit TaskDisputed(taskId);
    }

    /**
     * @notice Mark a task as expired and refund the creator.
     * @param taskId ID of the expired task
     */
    function expireTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open || task.status == TaskStatus.Assigned, "Wrong status");
        require(block.timestamp > task.deadline, "Deadline not passed");

        task.status = TaskStatus.Expired;

        // Refund creator
        (bool sent, ) = payable(task.creator).call{value: task.bountyAmount}("");
        require(sent, "Refund failed");

        emit TaskExpired(taskId);
    }

    /**
     * @notice Resolve a disputed task (operator only).
     * @param taskId ID of the disputed task
     * @param releaseToAgent true = pay agent, false = refund creator
     */
    function resolveDispute(uint256 taskId, bool releaseToAgent)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Disputed, "Not disputed");

        task.status = TaskStatus.Completed;
        task.paymentReleased = true;

        if (releaseToAgent) {
            treasury.releaseFunds(taskId, task.assignee);
            emit PaymentReleased(taskId, task.assignee, task.bountyAmount);
        } else {
            (bool sent, ) = payable(task.creator).call{value: task.bountyAmount}("");
            require(sent, "Refund failed");
        }
    }

    // --- View functions ---

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getAgentTasks(address agent) external view returns (uint256[] memory) {
        return agentTasks[agent];
    }

    function getCreatorTasks(address creator) external view returns (uint256[] memory) {
        return creatorTasks[creator];
    }

    function getOpenTaskCount() external view returns (uint256) {
        uint256 count;
        for (uint256 i = 1; i <= taskCounter; i++) {
            if (tasks[i].status == TaskStatus.Open) count++;
        }
        return count;
    }

    // --- Maintenance ---

    function updateTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid Treasury");
        treasury = Treasury(payable(_treasury));
    }

    function updateAgentRegistry(address _agentRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_agentRegistry != address(0), "Invalid AgentRegistry");
        agentRegistry = AgentRegistry(_agentRegistry);
    }
}
