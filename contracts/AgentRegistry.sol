// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title AgentRegistry
 * @notice ERC-8004 Agent Identity Registry.
 *         Registers AI agents with on-chain identity, tracks reputation,
 *         and mints evolving identity badges (ERC-721 NFTs).
 */
contract AgentRegistry is ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl {
    using Strings for uint256;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @dev Agent status
    enum AgentStatus { Active, Paused, Banned }

    /// @dev Agent profile stored on-chain
    struct AgentProfile {
        uint256 tokenId;
        address wallet;
        string name;
        string metadataURI;
        AgentStatus status;
        uint256 registrationTime;
        uint256 totalTasks;
        uint256 successfulTasks;
        uint256 totalEarned;
        uint256 reputationScore;
    }

    /// @dev Mapping from tokenId to AgentProfile
    mapping(uint256 => AgentProfile) public agents;
    /// @dev Mapping from wallet address to tokenId
    mapping(address => uint256) public walletToToken;
    /// @dev Total registered agents
    uint256 public totalAgents;

    /// @dev Base URI for badge metadata
    string private _baseTokenURI;

    event AgentRegistered(uint256 indexed tokenId, address indexed wallet, string name);
    event AgentStatusChanged(uint256 indexed tokenId, AgentStatus status);
    event ReputationUpdated(uint256 indexed tokenId, uint256 newScore);
    event TaskRecorded(uint256 indexed tokenId, uint256 taskId, bool success, uint256 reward);
    event BadgeMinted(uint256 indexed tokenId, uint256 badgeLevel);

    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not operator");
        _;
    }

    constructor() ERC721("AgentPayroll Identity", "AGENT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _baseTokenURI = "ipfs://default/";
    }

    /**
     * @notice Register a new agent. Mints an ERC-8004 identity NFT.
     * @param wallet Agent wallet address
     * @param name Agent display name
     * @param metadataURI URI for off-chain agent metadata
     * @return tokenId The minted NFT token ID
     */
    function registerAgent(
        address wallet,
        string calldata name,
        string calldata metadataURI
    ) external onlyOperator returns (uint256) {
        require(wallet != address(0), "Invalid wallet");
        require(walletToToken[wallet] == 0, "Already registered");
        require(bytes(name).length > 0, "Name required");

        totalAgents++;
        uint256 tokenId = totalAgents;

        _safeMint(wallet, tokenId);

        agents[tokenId] = AgentProfile({
            tokenId: tokenId,
            wallet: wallet,
            name: name,
            metadataURI: metadataURI,
            status: AgentStatus.Active,
            registrationTime: block.timestamp,
            totalTasks: 0,
            successfulTasks: 0,
            totalEarned: 0,
            reputationScore: 0
        });

        walletToToken[wallet] = tokenId;

        emit AgentRegistered(tokenId, wallet, name);
        return tokenId;
    }

    /**
     * @notice Update agent status (pause/ban/activate).
     */
    function setAgentStatus(uint256 tokenId, AgentStatus status) external onlyOperator {
        require(_ownerOf(tokenId) != address(0), "Agent does not exist");
        agents[tokenId].status = status;
        emit AgentStatusChanged(tokenId, status);
    }

    /**
     * @notice Record a completed task and update reputation (called by TaskRegistry).
     * @param wallet Agent wallet address
     * @param taskId Completed task ID
     */
    function recordTaskCompletion(address wallet, uint256 taskId) external onlyOperator {
        uint256 tokenId = walletToToken[wallet];
        require(tokenId != 0, "Agent not registered");

        AgentProfile storage agent = agents[tokenId];
        agent.totalTasks++;
        agent.successfulTasks++;

        // Reputation formula: base score from success rate, bonus from task count
        uint256 successRate = (agent.successfulTasks * 100) / agent.totalTasks;
        uint256 taskBonus = agent.totalTasks * 5;
        uint256 newScore = successRate + taskBonus;
        if (newScore > 100) newScore = 100;

        agent.reputationScore = newScore;

        emit TaskRecorded(tokenId, taskId, true, 0);
        emit ReputationUpdated(tokenId, newScore);
    }

    /**
     * @notice Record agent earnings (called by Treasury after payment).
     */
    function recordEarnings(address wallet, uint256 amount) external onlyOperator {
        uint256 tokenId = walletToToken[wallet];
        require(tokenId != 0, "Agent not registered");
        agents[tokenId].totalEarned += amount;
    }

    /**
     * @notice Mint an identity badge with evolving metadata.
     * @param tokenId Agent token ID
     * @param badgeLevel Badge level (1-5) determining metadata URI
     */
    function mintIdentityBadge(uint256 tokenId, uint256 badgeLevel) external onlyOperator {
        require(_ownerOf(tokenId) != address(0), "Agent does not exist");
        require(badgeLevel >= 1 && badgeLevel <= 5, "Level 1-5 only");

        string memory badgeURI = string(abi.encodePacked(
            _baseTokenURI, "badge/", badgeLevel.toString(), "/", tokenId.toString(), ".json"
        ));
        _setTokenURI(tokenId, badgeURI);

        emit BadgeMinted(tokenId, badgeLevel);
    }

    // --- View functions ---

    function isRegistered(address wallet) external view returns (bool) {
        return walletToToken[wallet] != 0;
    }

    function getAgent(uint256 tokenId) external view returns (AgentProfile memory) {
        require(_ownerOf(tokenId) != address(0), "Agent does not exist");
        return agents[tokenId];
    }

    function getAgentByWallet(address wallet) external view returns (AgentProfile memory) {
        uint256 tokenId = walletToToken[wallet];
        require(tokenId != 0, "Agent not registered");
        return agents[tokenId];
    }

    function getAgentHistory(uint256 tokenId) external view returns (AgentProfile memory) {
        require(_ownerOf(tokenId) != address(0), "Agent does not exist");
        return agents[tokenId];
    }

    // --- Admin functions ---

    function setBaseURI(string calldata baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseURI;
    }

    // --- Required overrides ---

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
