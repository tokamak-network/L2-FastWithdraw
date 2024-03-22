//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

contract ProxyStorage  {

    bool public pauseProxy;

    mapping(uint256 => address) public proxyImplementation;
    mapping(address => bool) public aliveImplementation;
    mapping(bytes4 => address) public selectorImplementation;

}
