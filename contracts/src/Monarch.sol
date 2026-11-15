// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MONARCH - trade to conquer territory on Monad
/// @notice Records players, their bases and territory, battle settlements, and battle history.
///         Battles are refereed off-chain; only the referee can settle them.
contract Monarch {
    uint32 public constant STARTING_GOLD = 200;
    uint32 public constant GOLD_PER_WIN = 100;
    uint32 public constant TROPHIES_PER_WIN = 25;
    uint32 public constant TROPHIES_PER_LOSS = 10;
    uint32 public constant LOOT_BPS = 1000; // winner takes 10% of the loser's gold

    uint16 public constant STARTING_LAND = 4;
    uint16 public constant MAX_LAND = 25;

    /// @notice Shared world map: realms anyone can conquer. Battles for no realm pass NO_REALM.
    uint8 public constant REALM_COUNT = 16;
    uint8 public constant NO_REALM = 255;

    uint8 public constant BUILDING_COUNT = 4; // 0 Command Center, 1 Gold Extractor, 2 Mech Bay, 3 Trophy Vault
    uint8 public constant MAX_LEVEL = 5;
    uint32 public constant EXTRACTOR_BONUS_PER_LEVEL = 20; // extra gold per win
    uint32 public constant VAULT_BONUS_PER_LEVEL = 5; // extra trophies per win
    uint32 public constant EXTRACTOR_RATE_PER_LEVEL = 2; // gold per minute
    uint32 public constant EXTRACTOR_CAP_PER_LEVEL = 150; // max uncollected gold

    struct Player {
        string name;
        uint32 trophies;
        uint32 gold;
        uint32 wins;
        uint32 losses;
        uint16 land;
        uint64 lastCollect;
        bool exists;
    }

    struct BattleRecord {
        address winner;
        int32 winnerBps;
        uint64 timestamp;
        address loser;
        int32 loserBps;
        uint32 loot;
        uint8 realm;
    }

    struct Session {
        address player;
        uint64 expiry;
    }

    address public owner;
    address public referee;

    mapping(address => Player) public players;
    address[] public playerList;
    mapping(bytes32 => bool) public settled;
    mapping(address => uint8[BUILDING_COUNT]) internal buildings;
    mapping(uint8 => address) public realmOwner;

    BattleRecord[] internal battleLog;
    mapping(address => uint32[]) internal playerBattles;

    /// @notice Session key => the player it acts for. Lets the game sign and send without wallet pop-ups.
    mapping(address => Session) public sessions;
    mapping(address => address) public activeSession;

    event Registered(address indexed player, string name);
    event BattleSettled(
        bytes32 indexed battleId,
        address indexed winner,
        address indexed loser,
        int32 winnerBps,
        int32 loserBps,
        uint32 loot,
        uint8 realm
    );
    event Upgraded(address indexed player, uint8 indexed building, uint8 level, uint32 cost);
    event Collected(address indexed player, uint32 amount);
    event SessionStarted(address indexed player, address indexed key, uint64 expiry);
    event SessionEnded(address indexed player, address indexed key);
    event RefereeChanged(address referee);

    error NotOwner();
    error NotReferee();
    error AlreadyRegistered();
    error InvalidName();
    error NotRegistered();
    error AlreadySettled();
    error InvalidPlayers();
    error InvalidBuilding();
    error MaxLevelReached();
    error CommandCenterTooLow();
    error NotEnoughGold();
    error InvalidSession();
    error TransferFailed();
    error InvalidRealm();
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

    // ---------------------------------------------------------------- players

    function register(string calldata name) external {
        if (players[msg.sender].exists) revert AlreadyRegistered();
        uint256 len = bytes(name).length;
        if (len == 0 || len > 24) revert InvalidName();

        Player storage p = players[msg.sender];
        p.name = name;
        p.gold = STARTING_GOLD;
        p.land = STARTING_LAND;
        p.lastCollect = uint64(block.timestamp);
        p.exists = true;
        buildings[msg.sender] = [1, 1, 1, 1];
        playerList.push(msg.sender);
        emit Registered(msg.sender, name);
    }

    /// @notice The player `account` acts for: itself, or the owner of a live session key.
    function playerOf(address account) public view returns (address) {
        Session memory s = sessions[account];
        if (s.player != address(0) && s.expiry >= block.timestamp) return s.player;
        return account;
    }

    // ---------------------------------------------------------------- sessions

    /// @notice Authorize `key` to act for the caller until `expiry`. Any MON sent is forwarded to `key` for gas.
    function startSession(address key, uint64 expiry) external payable {
        if (!players[msg.sender].exists) revert NotRegistered();
        if (key == address(0) || key == msg.sender || players[key].exists || expiry <= block.timestamp) {
            revert InvalidSession();
        }
        Session memory existing = sessions[key];
        if (existing.player != address(0) && existing.player != msg.sender) revert InvalidSession();

        _endSession(msg.sender);
        sessions[key] = Session(msg.sender, expiry);
        activeSession[msg.sender] = key;
        emit SessionStarted(msg.sender, key, expiry);

        if (msg.value > 0) {
            (bool ok,) = key.call{value: msg.value}("");
            if (!ok) revert TransferFailed();
        }
    }

    function endSession() external {
        _endSession(playerOf(msg.sender));
    }

    function _endSession(address player) internal {
        address key = activeSession[player];
        if (key == address(0)) return;
        delete sessions[key];
        delete activeSession[player];
        emit SessionEnded(player, key);
    }

    // ---------------------------------------------------------------- base

    /// @notice Spend gold to raise a building one level. Nothing can exceed the Command Center.
    function upgrade(uint8 building) external {
        address player = playerOf(msg.sender);
        Player storage p = players[player];
        if (!p.exists) revert NotRegistered();
        if (building >= BUILDING_COUNT) revert InvalidBuilding();

        uint8[BUILDING_COUNT] storage levels = buildings[player];
        uint8 next = levels[building] + 1;
        if (next > MAX_LEVEL) revert MaxLevelReached();
        if (building != 0 && next > levels[0]) revert CommandCenterTooLow();

        if (building == 1) _collect(player);
        uint32 cost = baseCost(building) * next;
        if (p.gold < cost) revert NotEnoughGold();

        p.gold -= cost;
        levels[building] = next;
        emit Upgraded(player, building, next, cost);
    }

    /// @notice Claim the gold the Extractor has produced since the last collection.
    function collect() external {
        address player = playerOf(msg.sender);
        if (!players[player].exists) revert NotRegistered();
        _collect(player);
    }

    function _collect(address player) internal {
        uint32 amount = pendingGold(player);
        Player storage p = players[player];
        p.lastCollect = uint64(block.timestamp);
        if (amount == 0) return;
        p.gold += amount;
        emit Collected(player, amount);
    }

    function pendingGold(address player) public view returns (uint32) {
        Player storage p = players[player];
        if (!p.exists) return 0;
        uint256 level = buildings[player][1];
        uint256 produced = ((block.timestamp - p.lastCollect) * EXTRACTOR_RATE_PER_LEVEL * level) / 60;
        uint256 cap = EXTRACTOR_CAP_PER_LEVEL * level;
        return uint32(produced > cap ? cap : produced);
    }

    function baseCost(uint8 building) public pure returns (uint32) {
        if (building == 0) return 100; // Command Center
        if (building == 1) return 60; // Gold Extractor
        if (building == 2) return 50; // Mech Bay
        if (building == 3) return 80; // Trophy Vault
        revert InvalidBuilding();
    }

    function goldPerWin(address player) public view returns (uint32) {
        return GOLD_PER_WIN + EXTRACTOR_BONUS_PER_LEVEL * (buildings[player][1] - 1);
    }

    function trophiesPerWin(address player) public view returns (uint32) {
        return TROPHIES_PER_WIN + VAULT_BONUS_PER_LEVEL * (buildings[player][3] - 1);
    }

    /// @notice Highest battle leverage the player's Mech Bay allows.
    function maxLeverage(address player) public view returns (uint8) {
        uint8 level = buildings[player][2];
        return level == 0 ? 1 : level + 1;
    }

    // ---------------------------------------------------------------- battles

    /// @param winnerBps / loserBps battle returns in basis points (for the record only).
    /// @param realm the realm fought over, or NO_REALM. An owned realm can only change hands in a battle with its owner.
    function settleBattle(bytes32 battleId, address winner, address loser, int32 winnerBps, int32 loserBps, uint8 realm)
        external
        onlyReferee
    {
        if (settled[battleId]) revert AlreadySettled();
        if (winner == loser) revert InvalidPlayers();
        Player storage w = players[winner];
        Player storage l = players[loser];
        if (!w.exists || !l.exists) revert NotRegistered();
        if (realm != NO_REALM && realm >= REALM_COUNT) revert InvalidRealm();
        address holder = realm == NO_REALM ? address(0) : realmOwner[realm];
        if (holder != address(0) && holder != winner && holder != loser) revert OwnerNotInBattle();

        settled[battleId] = true;

        uint32 loot = uint32((uint256(l.gold) * LOOT_BPS) / 10_000);
        l.gold -= loot;
        w.gold += goldPerWin(winner) + loot;

        w.trophies += trophiesPerWin(winner);
        l.trophies = l.trophies > TROPHIES_PER_LOSS ? l.trophies - TROPHIES_PER_LOSS : 0;
        w.wins += 1;
        l.losses += 1;

        if (realm == NO_REALM) {
            if (w.land < MAX_LAND) w.land += 1;
            if (l.land > STARTING_LAND) l.land -= 1;
        } else if (holder != winner) {
            realmOwner[realm] = winner;
            if (w.land < MAX_LAND) w.land += 1;
            if (holder == loser && l.land > STARTING_LAND) l.land -= 1;
        }

        uint32 index = uint32(battleLog.length);
        battleLog.push(BattleRecord(winner, winnerBps, uint64(block.timestamp), loser, loserBps, loot, realm));
        playerBattles[winner].push(index);
        playerBattles[loser].push(index);

        emit BattleSettled(battleId, winner, loser, winnerBps, loserBps, loot, realm);
    }

    function getRealms() external view returns (address[REALM_COUNT] memory owners) {
        for (uint8 i = 0; i < REALM_COUNT; i++) {
            owners[i] = realmOwner[i];
        }
    }

    // ---------------------------------------------------------------- views

    function getBuildings(address player) external view returns (uint8[BUILDING_COUNT] memory) {
        return buildings[player];
    }

    function battleCount() external view returns (uint256) {
        return battleLog.length;
    }

    /// @notice Up to `limit` of the most recent battles overall, newest first.
    function getRecentBattles(uint256 limit) external view returns (BattleRecord[] memory out) {
        uint256 n = battleLog.length < limit ? battleLog.length : limit;
        out = new BattleRecord[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = battleLog[battleLog.length - 1 - i];
        }
    }

    /// @notice Up to `limit` of `player`'s most recent battles, newest first.
    function getHistory(address player, uint256 limit) external view returns (BattleRecord[] memory out) {
        uint32[] storage ids = playerBattles[player];
        uint256 n = ids.length < limit ? ids.length : limit;
        out = new BattleRecord[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = battleLog[ids[ids.length - 1 - i]];
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
