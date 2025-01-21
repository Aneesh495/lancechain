// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

contract RevertingReceiver {
    bool public shouldRevert = true;

    function setShouldRevert(bool val) external {
        shouldRevert = val;
    }

    receive() external payable {
        if (shouldRevert) {
            revert("ReceiverReverted");
        }
    }
}
