// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Monarch} from "../src/Monarch.sol";

contract MonarchTest is Test {
    Monarch monarch;
    address referee = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    uint256 nonce;

    function setUp() public {
        vm.warp(1_000_000);
        monarch = new Monarch(referee);
        vm.prank(alice);
        monarch.register("alice");
        vm.prank(bob);
        monarch.register("bob");
        vm.prank(carol);
        monarch.register("carol");
    }

    function _p(address who) internal view returns (Monarch.Player memory p) {
        (p.name, p.trophies, p.gold, p.wins, p.losses, p.land, p.lastCollect, p.exists) = monarch.players(who);
    }

    function _win(address winner, address loser) internal {
        vm.prank(referee);
        monarch.settleBattle(keccak256(abi.encode(nonce++)), winner, loser, 150, -150);
    }

    function test_RegisterGrantsStartingBase() public view {
        Monarch.Player memory p = _p(alice);
        assertEq(p.gold, 200);
        assertEq(p.land, 4);
        uint8[4] memory b = monarch.getBuildings(alice);
        for (uint256 i = 0; i < 4; i++) assertEq(b[i], 1);
    }

    function test_SettleRewardsLootLandAndTrophies() public {
        _win(alice, bob); // bob 200 gold -> loot 20
        Monarch.Player memory a = _p(alice);
        Monarch.Player memory b = _p(bob);
        assertEq(a.gold, 200 + 100 + 20);
        assertEq(b.gold, 180);
        assertEq(a.trophies, 25);
        assertEq(b.trophies, 0);
        assertEq(a.land, 5);
        assertEq(b.land, 4); // never below starting land
        assertEq(a.wins, 1);
        assertEq(b.losses, 1);

        _win(bob, alice);
        a = _p(alice);
        assertEq(a.trophies, 15);
        assertEq(a.land, 4);
    }

    function test_LandCapsAtMax() public {
        for (uint256 i = 0; i < 30; i++) _win(alice, bob);
        assertEq(_p(alice).land, 25);
    }

    function test_SettleOnlyReferee() public {
        vm.expectRevert(Monarch.NotReferee.selector);
        monarch.settleBattle(keccak256("x"), alice, bob, 1, -1);
    }

    function test_SettleTwiceReverts() public {
        vm.startPrank(referee);
        monarch.settleBattle(keccak256("x"), alice, bob, 1, -1);
        vm.expectRevert(Monarch.AlreadySettled.selector);
        monarch.settleBattle(keccak256("x"), alice, bob, 1, -1);
        vm.stopPrank();
    }

    function test_SettleRejectsUnregisteredAndSelf() public {
        vm.startPrank(referee);
        vm.expectRevert(Monarch.NotRegistered.selector);
        monarch.settleBattle(keccak256("x"), alice, address(0xDEAD), 1, -1);
        vm.expectRevert(Monarch.InvalidPlayers.selector);
        monarch.settleBattle(keccak256("y"), alice, alice, 1, -1);
        vm.stopPrank();
    }

    function test_HistoryNewestFirst() public {
        _win(alice, bob);
        _win(carol, alice);
        _win(bob, carol);

        Monarch.BattleRecord[] memory h = monarch.getHistory(alice, 10);
        assertEq(h.length, 2);
        assertEq(h[0].winner, carol);
        assertEq(h[1].winner, alice);
        assertEq(h[1].loot, 20);

        Monarch.BattleRecord[] memory recent = monarch.getRecentBattles(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].winner, bob);
        assertEq(monarch.battleCount(), 3);
    }

    function test_UpgradeCostsAndCommandCenterCap() public {
        vm.startPrank(alice);
        vm.expectRevert(Monarch.CommandCenterTooLow.selector);
        monarch.upgrade(1);
        monarch.upgrade(0); // 200 cost at level 2
        vm.stopPrank();
        assertEq(_p(alice).gold, 0);
        assertEq(monarch.getBuildings(alice)[0], 2);
    }

    function test_UpgradeNeedsGold() public {
        _win(alice, bob);
        vm.startPrank(alice);
        monarch.upgrade(0); // 320 - 200
        vm.expectRevert(Monarch.NotEnoughGold.selector);
        monarch.upgrade(0); // 300
        vm.stopPrank();
    }

    function test_ExtractorProducesUpToCap() public {
        assertEq(monarch.pendingGold(alice), 0);
        vm.warp(block.timestamp + 10 minutes);
        assertEq(monarch.pendingGold(alice), 20);
        vm.warp(block.timestamp + 10 days);
        assertEq(monarch.pendingGold(alice), 150);

        vm.prank(alice);
        monarch.collect();
        assertEq(_p(alice).gold, 350);
        assertEq(monarch.pendingGold(alice), 0);
    }

    function test_BuildingEffects() public {
        for (uint256 i = 0; i < 6; i++) _win(alice, bob);
        vm.startPrank(alice);
        monarch.upgrade(0);
        monarch.upgrade(1);
        monarch.upgrade(2);
        monarch.upgrade(3);
        vm.stopPrank();
        assertEq(monarch.goldPerWin(alice), 120);
        assertEq(monarch.trophiesPerWin(alice), 30);
        assertEq(monarch.maxLeverage(alice), 3);
        assertEq(monarch.maxLeverage(bob), 2);
    }

    function test_SessionKeyActsForPlayer() public {
        address key = address(0x5E55);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        monarch.startSession{value: 0.1 ether}(key, uint64(block.timestamp + 1 days));
        assertEq(key.balance, 0.1 ether);
        assertEq(monarch.playerOf(key), alice);

        vm.warp(block.timestamp + 10 minutes);
        vm.prank(key);
        monarch.collect();
        assertEq(_p(alice).gold, 220);

        vm.prank(key);
        monarch.upgrade(0);
        assertEq(monarch.getBuildings(alice)[0], 2);

        vm.warp(block.timestamp + 2 days);
        assertEq(monarch.playerOf(key), key);
        vm.prank(key);
        vm.expectRevert(Monarch.NotRegistered.selector);
        monarch.collect();
    }

    function test_SessionRotationAndEnd() public {
        address k1 = address(0x5E51);
        address k2 = address(0x5E52);
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.startPrank(alice);
        monarch.startSession(k1, exp);
        monarch.startSession(k2, exp);
        vm.stopPrank();
        assertEq(monarch.playerOf(k1), k1);
        assertEq(monarch.playerOf(k2), alice);

        vm.prank(k2);
        monarch.endSession();
        assertEq(monarch.playerOf(k2), k2);
        assertEq(monarch.activeSession(alice), address(0));
    }

    function test_SessionCannotBeHijacked() public {
        address key = address(0x5E55);
        uint64 exp = uint64(block.timestamp + 1 days);
        vm.prank(alice);
        monarch.startSession(key, exp);
        vm.prank(bob);
        vm.expectRevert(Monarch.InvalidSession.selector);
        monarch.startSession(key, exp);
        vm.prank(bob);
        vm.expectRevert(Monarch.InvalidSession.selector);
        monarch.startSession(carol, exp);
    }
}
