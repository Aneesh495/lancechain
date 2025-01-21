// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MockERC1271Wallet is IERC1271 {
    address public immutable owner;
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;

    constructor(address _owner) {
        owner = _owner;
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view override returns (bytes4) {
        address recovered = ECDSA.recover(hash, signature);
        if (recovered == owner) {
            return MAGICVALUE;
        }
        return 0xffffffff;
    }

    receive() external payable {}
}
