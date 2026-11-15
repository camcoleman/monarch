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

    function setUp() public {
        monarch = new Monarch(referee);
        vm.prank(alice);
        monarch.register("alice");
        vm.prank(bob);
        monarch.register("bob");
        vm.prank(carol);
        monarch.register("carol");
    }

    function _gold(address p) internal view returns (uint32 gold) {
        (,, gold,,,,) = monarch.players(p);
    }

    function _win(bytes32 id, address winner, address loser) internal {
        vm.prank(referee);
        monarch.settleBattle(id, 1, winner, loser, 1, -1);
    }

    function test_RegisterGrantsStartingGoldAndBuildings() public view {
        assertEq(_gold(alice), 200);
        uint8[4] memory b = monarch.getBuildings(alice);
        for (uint256 i = 0; i < 4; i++) assertEq(b[i], 1);
    }

    function test_SettleCapturesNeutralState() public {
        vm.prank(referee);
        monarch.settleBattle(keccak256("b1"), 0, alice, bob, 180, -180);

        assertEq(monarch.stateOwner(0), alice);
        (, uint32 trophies, uint32 gold, uint32 wins,, uint8 owned,) = monarch.players(alice);
        assertEq(trophies, 25);
        assertEq(gold, 300);
        assertEq(wins, 1);
        assertEq(owned, 1);
        (,,,, uint32 losses,,) = monarch.players(bob);
        assertEq(losses, 1);
    }

    function test_RevertDuplicateSettlement() public {
        vm.startPrank(referee);
        monarch.settleBattle(keccak256("b1"), 0, alice, bob, 1, -1);
        vm.expectRevert(Monarch.AlreadySettled.selector);
        monarch.settleBattle(keccak256("b1"), 0, alice, bob, 1, -1);
        vm.stopPrank();
    }

    function test_RevertUnauthorized() public {
        vm.prank(alice);
        vm.expectRevert(Monarch.NotReferee.selector);
        monarch.settleBattle(keccak256("b1"), 0, alice, bob, 1, -1);
    }

    function test_OwnedStateRequiresOwnerInBattle() public {
        vm.startPrank(referee);
        monarch.settleBattle(keccak256("b1"), 0, alice, bob, 1, -1);
        vm.expectRevert(Monarch.OwnerNotInBattle.selector);
        monarch.settleBattle(keccak256("b2"), 0, carol, bob, 1, -1);

        monarch.settleBattle(keccak256("b3"), 0, carol, alice, 1, -1);
        vm.stopPrank();

        assertEq(monarch.stateOwner(0), carol);
        (,,,,, uint8 aliceOwned,) = monarch.players(alice);
        (,,,,, uint8 carolOwned,) = monarch.players(carol);
        assertEq(aliceOwned, 0);
        assertEq(carolOwned, 1);
    }

    function test_RevertDoubleRegister() public {
        vm.prank(alice);
        vm.expectRevert(Monarch.AlreadyRegistered.selector);
        monarch.register("again");
    }

    function test_UpgradeTownHallCostsGold() public {
        vm.prank(alice);
        monarch.upgrade(0);
        assertEq(monarch.getBuildings(alice)[0], 2);
        assertEq(_gold(alice), 0); // 100 * level 2
    }

    function test_RevertUpgradeWithoutGold() public {
        vm.startPrank(alice);
        monarch.upgrade(0);
        vm.expectRevert(Monarch.NotEnoughGold.selector);
        monarch.upgrade(0);
        vm.stopPrank();
    }

    function test_RevertBuildingAboveTownHall() public {
        vm.prank(alice);
        vm.expectRevert(Monarch.TownHallTooLow.selector);
        monarch.upgrade(1);
    }

    function test_RevertUnregisteredUpgrade() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(Monarch.NotRegistered.selector);
        monarch.upgrade(0);
    }

    function test_RevertPastMaxLevel() public {
        for (uint256 i = 0; i < 20; i++) _win(keccak256(abi.encode(i)), alice, bob);
        vm.startPrank(alice);
        for (uint8 lvl = 2; lvl <= 5; lvl++) monarch.upgrade(0);
        vm.expectRevert(Monarch.MaxLevelReached.selector);
        monarch.upgrade(0);
        vm.stopPrank();
    }

    function test_GoldMineBonusOnWin() public {
        _win(keccak256("w1"), alice, bob); // 200 + 100 = 300
        vm.prank(alice);
        monarch.upgrade(0); // Town Hall 2 costs 200 -> 100
        _win(keccak256("w2"), alice, bob); // 200
        vm.prank(alice);
        monarch.upgrade(1); // Gold Mine 2 costs 120 -> 80

        assertEq(monarch.goldPerWin(alice), 120);
        _win(keccak256("w3"), alice, bob);
        assertEq(_gold(alice), 200);
    }
}
