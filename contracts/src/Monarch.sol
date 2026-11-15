// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MONARCH - trade to conquer territory on Monad
/// @notice Records players, battle settlements, rewards, village buildings, and US state ownership.
///         Battles are refereed off-chain; only the referee can settle them.
contract Monarch {
    uint8 public constant STATE_COUNT = 8; // 0 CA, 1 OR, 2 WA, 3 TX, 4 FL, 5 NY, 6 CO, 7 IL
    uint32 public constant TROPHIES_PER_WIN = 25;
    uint32 public constant GOLD_PER_WIN = 100;
    uint32 public constant STARTING_GOLD = 200;

    uint8 public constant BUILDING_COUNT = 4; // 0 Town Hall, 1 Gold Mine, 2 Barracks, 3 Trophy Hall
    uint8 public constant MAX_LEVEL = 5;
    uint32 public constant MINE_BONUS_PER_LEVEL = 20;

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
    mapping(address => uint8[BUILDING_COUNT]) internal buildings;

    event Registered(address indexed player, string name);
    event BattleSettled(
        bytes32 indexed battleId,
        uint8 indexed stateId,
        address indexed winner,
        address loser,
        int32 winnerBps,
        int32 loserBps
    );
    event Upgraded(address indexed player, uint8 indexed building, uint8 level, uint32 cost);
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
    error InvalidBuilding();
    error MaxLevelReached();
    error TownHallTooLow();
    error NotEnoughGold();

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

        Player storage p = players[msg.sender];
        p.name = name;
        p.gold = STARTING_GOLD;
        p.exists = true;
        buildings[msg.sender] = [1, 1, 1, 1];
        playerList.push(msg.sender);
        emit Registered(msg.sender, name);
    }

    /// @notice Spend gold to raise a building one level. Other buildings can't exceed the Town Hall.
    function upgrade(uint8 building) external {
        Player storage p = players[msg.sender];
        if (!p.exists) revert NotRegistered();
        if (building >= BUILDING_COUNT) revert InvalidBuilding();

        uint8[BUILDING_COUNT] storage levels = buildings[msg.sender];
        uint8 next = levels[building] + 1;
        if (next > MAX_LEVEL) revert MaxLevelReached();
        if (building != 0 && next > levels[0]) revert TownHallTooLow();

        uint32 cost = baseCost(building) * next;
        if (p.gold < cost) revert NotEnoughGold();

        p.gold -= cost;
        levels[building] = next;
        emit Upgraded(msg.sender, building, next, cost);
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
        w.gold += goldPerWin(winner);
        w.wins += 1;
        players[loser].losses += 1;

        emit BattleSettled(battleId, stateId, winner, loser, winnerBps, loserBps);
    }

    function baseCost(uint8 building) public pure returns (uint32) {
        if (building == 0) return 100; // Town Hall
        if (building == 1) return 60; // Gold Mine
        if (building == 2) return 50; // Barracks
        if (building == 3) return 80; // Trophy Hall
        revert InvalidBuilding();
    }

    /// @notice Gold a win pays this player: base reward plus the Gold Mine bonus.
    function goldPerWin(address player) public view returns (uint32) {
        uint8 mine = buildings[player][1];
        return GOLD_PER_WIN + (mine > 1 ? MINE_BONUS_PER_LEVEL * (mine - 1) : 0);
    }

    function getBuildings(address player) external view returns (uint8[BUILDING_COUNT] memory) {
        return buildings[player];
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
