// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Monarch} from "../src/Monarch.sol";

/// forge script script/Deploy.s.sol --rpc-url monad --private-key $DEPLOYER_KEY --broadcast
contract Deploy is Script {
    function run() external returns (Monarch monarch) {
        address referee = vm.envAddress("REFEREE_ADDRESS");
        vm.startBroadcast();
        monarch = new Monarch(referee);
        vm.stopBroadcast();
        console.log("Monarch deployed at", address(monarch));
    }
}
