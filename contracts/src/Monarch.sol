// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MONARCH - trade to conquer territory on Monad
/// @notice Records players, battle settlements, rewards, and US state ownership.
///         Battles are refereed off-chain; only the referee can settle them.
contract Monarch {
    uint8 public constant STATE_COUNT = 8; // 0 CA, 1 OR, 2 WA, 3 TX, 4 FL, 5 NY, 6 CO, 7 IL
    uint32 public constant TROPHIES_PER_WIN = 25;
    uint32 public constant GOLD_PER_WIN = 100;

    struct Player {
        string name;
        uint32 trophies;
        uint32 gold;
        uint32 wins;
        uint32 losses;
        uint8 statesOwned;
        bool exists;
    }

    address public owner;
    address public referee;

    mapping(address => Player) public players;
    address[] public playerList;
    mapping(uint8 => address) public stateOwner;
    mapping(bytes32 => bool) public settled;

    event Registered(address indexed player, string name);
    event BattleSettled(
        bytes32 indexed battleId,
        uint8 indexed stateId,
        address indexed winner,
        address loser,
        int32 winnerBps,
        int32 loserBps
    );
    event RefereeChanged(address referee);

    error NotOwner();
    error NotReferee();
    error AlreadyRegistered();
    error InvalidName();
    error NotRegistered();
    error InvalidState();
    error AlreadySettled();
    error InvalidPlayers();
    error OwnerNotInBattle();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyReferee() {
        if (msg.sender != referee) revert NotReferee();
        _;
    }

    constructor(address _referee) {
        owner = msg.sender;
        referee = _referee;
    }

    function setReferee(address _referee) external onlyOwner {
        referee = _referee;
        emit RefereeChanged(_referee);
    }

    function register(string calldata name) external {
        if (players[msg.sender].exists) revert AlreadyRegistered();
        uint256 len = bytes(name).length;
        if (len == 0 || len > 24) revert InvalidName();

        players[msg.sender].name = name;
        players[msg.sender].exists = true;
        playerList.push(msg.sender);
        emit Registered(msg.sender, name);
    }

    /// @param winnerBps / loserBps battle returns in basis points (for the record only).
    function settleBattle(
        bytes32 battleId,
        uint8 stateId,
        address winner,
        address loser,
        int32 winnerBps,
        int32 loserBps
    ) external onlyReferee {
        if (settled[battleId]) revert AlreadySettled();
        if (stateId >= STATE_COUNT) revert InvalidState();
        if (winner == loser) revert InvalidPlayers();
        if (!players[winner].exists || !players[loser].exists) revert NotRegistered();

        address current = stateOwner[stateId];
        if (current != address(0) && current != winner && current != loser) revert OwnerNotInBattle();

        settled[battleId] = true;

        if (current != winner) {
            if (current != address(0)) players[current].statesOwned -= 1;
            stateOwner[stateId] = winner;
            players[winner].statesOwned += 1;
        }

        Player storage w = players[winner];
        w.trophies += TROPHIES_PER_WIN;
        w.gold += GOLD_PER_WIN;
        w.wins += 1;
        players[loser].losses += 1;

        emit BattleSettled(battleId, stateId, winner, loser, winnerBps, loserBps);
    }

    function getStates() external view returns (address[STATE_COUNT] memory owners) {
        for (uint8 i = 0; i < STATE_COUNT; i++) {
            owners[i] = stateOwner[i];
        }
    }

    function getPlayers() external view returns (address[] memory addrs, Player[] memory data) {
        uint256 n = playerList.length;
        addrs = playerList;
        data = new Player[](n);
        for (uint256 i = 0; i < n; i++) {
            data[i] = players[playerList[i]];
        }
    }
}
