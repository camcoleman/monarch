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

    function test_SettleCapturesNeutralState() public {
        vm.prank(referee);
        monarch.settleBattle(keccak256("b1"), 0, alice, bob, 180, -180);

        assertEq(monarch.stateOwner(0), alice);
        (, uint32 trophies, uint32 gold, uint32 wins,, uint8 owned,) = monarch.players(alice);
        assertEq(trophies, 25);
        assertEq(gold, 100);
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
}
