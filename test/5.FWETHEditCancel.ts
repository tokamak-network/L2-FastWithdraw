import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
// import { task, types } from 'hardhat/config'
// import { HardhatRuntimeEnvironment } from 'hardhat/types'
// import '@nomiclabs/hardhat-ethers'
// import 'hardhat-deploy'
import { ethers } from "hardhat";
import { BytesLike, Event } from 'ethers'

import { CrossChainMessenger, MessageStatus, NativeTokenBridgeAdapter, NumberLike } from '../src'
import L1CrossTradeProxy_ABI from "../artifacts/contracts/L1/L1CrossTradeProxy.sol/L1CrossTradeProxy.json"
import L1CrossTrade_ABI from "../artifacts/contracts/L1/L1CrossTrade.sol/L1CrossTrade.json"
import L2CrossTradeProxy_ABI from "../artifacts/contracts/L2/L2CrossTradeProxy.sol/L2CrossTradeProxy.json"
import L2CrossTrade_ABI from "../artifacts/contracts/L2/L2CrossTrade.sol/L2CrossTrade.json"
import L1StandardBridgeABI from '../contracts-bedrock/forge-artifacts/L1StandardBridge.sol/L1StandardBridge.json'
import OptimismMintableERC20TokenFactoryABI from '../contracts-bedrock/forge-artifacts/OptimismMintableERC20Factory.sol/OptimismMintableERC20Factory.json'
import OptimismMintableERC20TokenABI from '../contracts-bedrock/forge-artifacts/OptimismMintableERC20.sol/OptimismMintableERC20.json'
import MockERC20ABI from '../contracts-bedrock/forge-artifacts/MockERC20Token.sol/MockERC20Token.json'

import dotenv from "dotenv" ;

dotenv.config();

describe("5.FWETHEditCancel", function () {
  let network = "devnetL1"
  let deployedAddress = require('./data/deployed.'+network+'.json');
  let predeployedAddress = require('./data/predeployed.'+network+'.json');

  const erc20ABI = [
    {
      inputs: [
        { internalType: 'address', name: '_spender', type: 'address' },
        { internalType: 'uint256', name: '_value', type: 'uint256' },
      ],
      name: 'approve',
      outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
      name: 'faucet',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        {
          internalType: 'address',
          name: 'from',
          type: 'address'
        },
        {
          internalType: 'address',
          name: 'to',
          type: 'address'
        },
        {
          internalType: 'uint256',
          name: 'amount',
          type: 'uint256'
        }
      ],
      name: 'transferFrom',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool'
        }
      ],
      stateMutability: 'nonpayable',
      type: 'function'
    },
  ]

  const privateKey = process.env.PRIVATE_KEY as BytesLike
  const privateKey2 = process.env.PRIVATE_KEY2 as BytesLike

  const l1Provider = new ethers.providers.StaticJsonRpcProvider(
    process.env.L1_URL
  )
  const l2Provider = new ethers.providers.StaticJsonRpcProvider(
    process.env.L2_URL
  )
  const l1Wallet = new ethers.Wallet(privateKey, l1Provider)
  console.log('l1Wallet :', l1Wallet.address)
  const l1user1 = new ethers.Wallet(privateKey2, l1Provider)
  console.log('l1user1 :', l1user1.address)
  const l2Wallet = new ethers.Wallet(privateKey, l2Provider)
  // console.log('l2Wallet :', l2Wallet.address)
  const l2user1 = new ethers.Wallet(privateKey2, l2Provider)

  const ETH = '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000'

  const oneETH = ethers.utils.parseUnits('1', 18)
  const twoETH = ethers.utils.parseUnits('2', 18)
  const threeETH = ethers.utils.parseUnits('3', 18)
  // const fourETH = ethers.utils.parseUnits('4', 18)
  const fiveETH = ethers.utils.parseUnits('5', 18)
  const sixETH = ethers.utils.parseUnits('6', 18)
  const tenETH = ethers.utils.parseUnits('10', 18)
  const hundETH = ethers.utils.parseUnits('100', 18)

  const zeroAddr = '0x'.padEnd(42, '0')

  // let L1CrossTradeLogicDep : any;
  let L1CrossTradeLogic : any;
  let L1CrossTradeProxy : any;
  let L1CrossTradeContract : any;

  // let L2CrossTradeProxyDep : any;
  let L2CrossTradeLogic : any;
  let L2CrossTradeProxy : any;
  let L2CrossTradeContract : any;
  
  let deployer : any;

  let nativeTokenAddr = "0x75fE809aE1C4A66c27a0239F147d0cc5710a104A"

  let MockERC20 : any;
  let l2MockERC20 : any;

  const name = 'Mock'
  const symbol = 'MTK'

  const l2name = 'L2Mock'
  const l2symbol = 'LTK'

  const l2CrossDomainMessengerAddr = '0x4200000000000000000000000000000000000007'
  let l1Contracts : any;
  let bridges : any;
  let messenger : any;

  let l2NativeToken = process.env.NATIVE_TOKEN || ''
  let addressManager = process.env.ADDRESS_MANAGER || ''
  let l1CrossDomainMessenger = process.env.L1_CROSS_DOMAIN_MESSENGER || ''
  let l1StandardBridge = process.env.L1_STANDARD_BRIDGE || ''
  let optimismPortal = process.env.OPTIMISM_PORTAL || ''
  let l2OutputOracle = process.env.L2_OUTPUT_ORACLE || ''

  let l1ChainId : any;
  let l2ChainId : any;

  let l2NativeTokenContract : any;
  let L1StandardBridgeContract : any;
  let L2CrossTradeBalance : any;
  let l2ETHERC20 : any;

  let beforeL2ETHBalance : any;
  let beforeL1ETHBalance : any;
  let beforeL2Contract : any;
  let afterL2ETHBalance : any;
  let afterL1ETHBalance : any;
  let afterL2Contract : any;

  let editTime = 180
  
  before('create fixture loader', async () => {
    // [deployer] = await ethers.getSigners();

    l1ChainId = (await l1Provider.getNetwork()).chainId
    l2ChainId = (await l2Provider.getNetwork()).chainId
    if (l2NativeToken === '') {
      l2NativeToken = deployedAddress.L2NativeToken
    }
  
    if (addressManager === '') {
      addressManager = deployedAddress.AddressManager
    }
  
    if (l1CrossDomainMessenger === '') {
      l1CrossDomainMessenger = deployedAddress.L1CrossDomainMessengerProxy
    }
  
    if (l1StandardBridge === '') {
      l1StandardBridge = deployedAddress.L1StandardBridgeProxy
    }
  
    if (optimismPortal === '') {
      optimismPortal = deployedAddress.OptimismPortalProxy
    }
  
    if (l2OutputOracle === '') {
      l2OutputOracle = deployedAddress.L2OutputOracleProxy
    }

    l1Contracts = {
      StateCommitmentChain: zeroAddr,
      CanonicalTransactionChain: zeroAddr,
      BondManager: zeroAddr,
      AddressManager: addressManager,
      L1CrossDomainMessenger: l1CrossDomainMessenger,
      L1StandardBridge: l1StandardBridge,
      OptimismPortal: optimismPortal,
      L2OutputOracle: l2OutputOracle,
    }
    // console.log(l1Contracts)

    bridges = {
      NativeToken: {
        l1Bridge: l1Contracts.L1StandardBridge,
        l2Bridge: predeployedAddress.L2StandardBridge,
        Adapter: NativeTokenBridgeAdapter,
      },
    }

    messenger = new CrossChainMessenger({
      bedrock: true,
      contracts: {
        l1: l1Contracts,
      },
      bridges,
      l1ChainId,
      l2ChainId,
      l1SignerOrProvider: l1Wallet,
      l2SignerOrProvider: l2Wallet,
    })
  
  })

  describe("deployContract", () => {
    it("l2NativeTokenContract", async () => {
      l2NativeTokenContract = new ethers.Contract(
        l2NativeToken,
        erc20ABI,
        l1Wallet
      )

      // let tx = await l2NativeTokenContract.balanceOf(
      //   l1Wallet.address
      // )
      // console.log('TON balance in L1(Wallet):', Number(tx.toString()))
      // tx = await l2NativeTokenContract.balanceOf(
      //   l1user1.address
      // )
      // console.log('TON balance in L1(user1):', Number(tx.toString()))
      // let l1Balance = await l1Wallet.getBalance()
      // console.log('l1 native balance: (ETH) (Wallet)', l1Balance.toString())
      // let l2Balance = await l2Wallet.getBalance()
      // console.log('l2 native balance: (TON) (Wallet)', l2Balance.toString())
      // l1Balance = await l1user1.getBalance()
      // console.log('l1 native balance: (ETH) (user1)', l1Balance.toString())
      // l2Balance = await l2user1.getBalance()
      // console.log('l2 native balance: (TON) (user1)', l2Balance.toString())
    })
    
    it("L1CrossTradeLogic", async () => {
      const L1CrossTradeLogicDep = new ethers.ContractFactory(
        L1CrossTrade_ABI.abi,
        L1CrossTrade_ABI.bytecode,
        l1Wallet
      )

      L1CrossTradeLogic = await L1CrossTradeLogicDep.deploy()
      await L1CrossTradeLogic.deployed()

      // console.log("L1FasitWithdrawLogic :", L1CrossTradeLogic.address);
    })

    it("L1CrossTradeProxy", async () => {
      const L1CrossTradeProxyDep = new ethers.ContractFactory(
        L1CrossTradeProxy_ABI.abi,
        L1CrossTradeProxy_ABI.bytecode,
        l1Wallet
      )

      L1CrossTradeProxy = await L1CrossTradeProxyDep.deploy()
      await L1CrossTradeProxy.deployed()
      // console.log("L1CrossTradeProxy :", L1CrossTradeProxy.address);
    })

    it("L1CrossTradeProxy upgradeTo", async () => {
      await (await L1CrossTradeProxy.upgradeTo(L1CrossTradeLogic.address)).wait();
      let imp2 = await L1CrossTradeProxy.implementation()
      if(L1CrossTradeLogic.address !== imp2) {
        console.log("===========L1CrossTradeProxy upgradeTo ERROR!!===========")
      }
    })

    it("set L1CrossTrade", async () => {
      L1CrossTradeContract = new ethers.Contract(
        L1CrossTradeProxy.address,
        L1CrossTrade_ABI.abi,
        l1Wallet
      )
    })

    it("L2CrossTradeLogic", async () => {
      const L2CrossTradeLogicDep = new ethers.ContractFactory(
        L2CrossTrade_ABI.abi,
        L2CrossTrade_ABI.bytecode,
        l2Wallet
      )

      L2CrossTradeLogic = await L2CrossTradeLogicDep.deploy()
      await L2CrossTradeLogic.deployed()

      // console.log("L2FasitWithdrawLogic :", L2CrossTradeLogic.address);
    })

    it("L2CrossTradeProxy", async () => {
      const L2CrossTradeProxyDep = new ethers.ContractFactory(
        L2CrossTradeProxy_ABI.abi,
        L2CrossTradeProxy_ABI.bytecode,
        l2Wallet
      )

      L2CrossTradeProxy = await L2CrossTradeProxyDep.deploy()
      await L2CrossTradeProxy.deployed()
      // console.log("L2CrossTradeProxy :", L2CrossTradeProxy.address);
    })

    it("L2CrossTradeProxy upgradeTo", async () => {
      await (await L2CrossTradeProxy.upgradeTo(L2CrossTradeLogic.address)).wait();
      let imp2 = await L2CrossTradeProxy.implementation()
      if(L2CrossTradeLogic.address !== imp2) {
        console.log("===========L2CrossTradeProxy upgradeTo ERROR!!===========")
      }
    })

    it("set L2CrossTrade", async () => {
      L2CrossTradeContract = new ethers.Contract(
        L2CrossTradeProxy.address,
        L2CrossTrade_ABI.abi,
        l2Wallet
      )
    })

    it("L1CrossTrade initialize", async () => {
      await (await L1CrossTradeProxy.connect(l1Wallet).initialize(
        l1Contracts.L1CrossDomainMessenger
      )).wait()

      const checkL1Inform = await L1CrossTradeProxy.crossDomainMessenger()
      if(checkL1Inform !== l1Contracts.L1CrossDomainMessenger){
        console.log("===========L1CrossTrade initialize ERROR!!===========")
      }
    })

    it("L1CrossTrade set chainInfo", async () => {
      await (await L1CrossTradeProxy.connect(l1Wallet).chainInfo(
        L2CrossTradeContract.address,
        zeroAddr,
        l2NativeTokenContract.address,
        l2ChainId,
        editTime
      )).wait()
    })

    it("L2CrossTrade initialize", async () => {
      await (await L2CrossTradeProxy.connect(l2Wallet).initialize(
        l2CrossDomainMessengerAddr,
        L1CrossTradeContract.address,
        predeployedAddress.LegacyERC20ETH,
        l2NativeTokenContract.address
      )).wait();
    
      const checkL2Inform = await L2CrossTradeProxy.crossDomainMessenger()
      if(checkL2Inform !== l2CrossDomainMessengerAddr){
        console.log("===========L2CrossTrade initialize ERROR!!===========")
      }
      let tx = await L2CrossTradeContract.saleCount()
      expect(tx).to.be.equal(0)
      tx = await L2CrossTradeContract.l1CrossTradeContract()
      if(tx !== L1CrossTradeContract.address){
        console.log("===========L2CrossTrade initialize ERROR!!===========")
      }
      tx = await L2CrossTradeContract.legacyERC20ETH()
      if(tx !== predeployedAddress.LegacyERC20ETH){
        console.log("===========L2CrossTrade initialize ERROR!!===========")
      }
      tx = await L2CrossTradeContract.nativeL1token()
      if(tx !== l2NativeTokenContract.address){
        console.log("===========L2CrossTrade initialize ERROR!!===========")
      }
    })

    it("deploy MockERC20 in L1", async () => {
      const DeployMockERC20 = new ethers.ContractFactory(
        MockERC20ABI.abi,
        MockERC20ABI.bytecode,
        l1Wallet
      )
      MockERC20 = await DeployMockERC20.deploy(name,symbol)
      await MockERC20.deployed()
      await MockERC20.mint(l1Wallet.address, tenETH)
      await MockERC20.mint(l1user1.address, tenETH)
    })

    it("deploy MockERC20 in L2", async () => {
      const factory_OptimismMintable = new ethers.Contract(
        predeployedAddress.OptimismMintableERC20Factory,
        OptimismMintableERC20TokenFactoryABI.abi,
        l2Wallet
      )

      let tx = await factory_OptimismMintable.createOptimismMintableERC20(
        MockERC20.address,
        l2name,
        l2symbol
      )
      await tx.wait()

      const receipt = await tx.wait()
      const event = receipt.events.find(
        (e: Event) => e.event === 'OptimismMintableERC20Created'
      )
    
      if (!event) {
        throw new Error('Unable to find OptimismMintableERC20Created event')
      }

      l2MockERC20 = new ethers.Contract(
        event.args.localToken,
        OptimismMintableERC20TokenABI.abi,
        l2Wallet
      )
    })

    it("Set L1StandrardBridgeContract", async () => {
      L1StandardBridgeContract = new ethers.Contract(
        l1Contracts.L1StandardBridge,
        L1StandardBridgeABI.abi,
        l1Wallet
      )
    })

    it("deploy the L2ETH Contract", async () => {
      l2ETHERC20 = new ethers.Contract(
        predeployedAddress.ETH,
        erc20ABI,
        l2Wallet
      )
    })
  });

  describe("FW ETH Test", () => {
    it("Deposit ETH to L2", async () => {
      beforeL1ETHBalance = await l1Wallet.getBalance()
      beforeL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)

      const tx = await L1StandardBridgeContract.connect(l1Wallet).depositETH(
        20000,
        '0x',
        {
          value: tenETH,
        }
      )
    
      const depositTx = await tx.wait()
      // console.log(
      //   'depositTx Tx:',
      //   depositTx.transactionHash,
      //   ' Block',
      //   depositTx.blockNumber,
      //   ' hash',
      //   tx.hash
      // )
    
      await messenger.waitForMessageStatus(
        depositTx.transactionHash,
        MessageStatus.RELAYED
      )

      afterL1ETHBalance = await l1Wallet.getBalance()
      afterL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)

      expect(beforeL1ETHBalance).to.be.gt(afterL1ETHBalance)
      expect(afterL2ETHBalance).to.be.gt(beforeL2ETHBalance)
    })

    it("requestFW (ETH) in L2", async () => {
      let beforel2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      let beforeL2CrossTradeBalance = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)

      let tx = await l2ETHERC20.connect(l2Wallet).approve(L2CrossTradeContract.address, threeETH)
      await tx.wait()
      // console.log('pass the approve')

      await (await L2CrossTradeContract.connect(l2Wallet).requestFW(
        zeroAddr,
        l2ETHERC20.address,
        threeETH,
        twoETH,
        l1ChainId
      )).wait()
      
      let afterl2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      let afterL2CrossTradeBalance = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)

      expect(beforel2ETHBalance).to.be.gt(afterl2ETHBalance)
      expect(afterL2CrossTradeBalance).to.be.gt(beforeL2CrossTradeBalance)

      const saleCount = await L2CrossTradeProxy.saleCount()
      expect(saleCount).to.be.equal(1);
      let saleInformation = await L2CrossTradeProxy.dealData(saleCount)
      if(saleInformation.requester !== l2Wallet.address) {
        console.log("===========requestFW Fail!!===========")
      } 
    })

    it("before fail editFW", async () => {
      beforeL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('l2 native balance(requester): ', beforeL2Balance.toString())
      beforeL2Contract  = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('before l2 native balance (L2CrossTradeBalance): ', beforeL2Contract.toString())
    })


    it("revert the cancelFW (need the make the requestFW Owner", async () => {
      const saleCount = await L2CrossTradeProxy.saleCount()

      let saleInformation = await L2CrossTradeContract.dealData(saleCount)

      await expect(L1CrossTradeContract.connect(l1user1).cancel(
        saleInformation.l1token,
        l2ETHERC20.address,
        threeETH,
        saleCount,
        l2ChainId,
        1200000,
        saleInformation.hashValue
      )).to.be.rejectedWith("Hash values do not match.")
      
      // const cancelTx = await L1CrossTradeContract.connect(l1user1).cancel(
      //   saleCount,
      //   0
      // );
      // await cancelTx.wait();

      // await messenger.waitForMessageStatus(cancelTx.hash, MessageStatus.RELAYED)
    })

    it("after fail cancelFW", async () => {
      afterL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('l2 native balance(requester): ', afterL2ETHBalance.toString())
      afterL2Contract = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('after l2 native balance (L2CrossTradeBalance): ', afterL2Contract.toString())


      expect(beforeL2ETHBalance).to.be.equal(afterL2ETHBalance)
      expect(beforeL2Contract).to.be.equal(afterL2Contract)
    })

    it("cancelFw in L1", async () => {
      beforeL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('l2 native balance(requester): ', beforeL2Balance.toString())
      beforeL2Contract  = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('before l2 native balance (L2CrossTradeBalance): ', beforeL2Contract.toString())

      const saleCount = await L2CrossTradeProxy.saleCount()

      let saleInformation = await L2CrossTradeContract.dealData(saleCount)

      const cancelTx = await L1CrossTradeContract.connect(l1Wallet).cancel(
        saleInformation.l1token,
        l2ETHERC20.address,
        threeETH,
        saleCount,
        l2ChainId,
        1200000,
        saleInformation.hashValue
      );
      await cancelTx.wait();

      await messenger.waitForMessageStatus(cancelTx.hash, MessageStatus.RELAYED)
      // console.log("send the Message L1 to L2");

      afterL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('l2 native balance(requester): ', afterL2ETHBalance.toString())
      afterL2Contract = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('after l2 native balance (L2CrossTradeBalance): ', afterL2Contract.toString())

      expect(afterL2ETHBalance).to.be.gt(beforeL2ETHBalance)
      expect(beforeL2Contract).to.be.gt(afterL2Contract)
    })

    it("requestFW in L2 (second salecount)", async () => {
      // let l2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('l2 ETH(ERC20) balance (Wallet): ', l2ETHBalance.toString())

      // L2CrossTradeBalance = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('before L2 ETH (L2CrossTradeBalance): ', L2CrossTradeBalance.toString())

      let tx = await l2ETHERC20.connect(l2Wallet).approve(L2CrossTradeContract.address, threeETH)
      await tx.wait()

      await (await L2CrossTradeContract.connect(l2Wallet).requestFW(
        zeroAddr,
        l2ETHERC20.address,
        threeETH,
        twoETH,
        l1ChainId
      )).wait()

      // l2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('after l2 ETH(ERC20) balance (Wallet): ', l2ETHBalance.toString())
      // L2CrossTradeBalance = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('after l2 ETH (L2CrossTradeBalance): ', L2CrossTradeBalance.toString())

      const saleCount = await L2CrossTradeProxy.saleCount()
      // console.log('saleCount : ', saleCount);
      expect(saleCount).to.be.equal(2);
      // let saleInformation = await L2CrossTradeProxy.dealData(saleCount)
      // console.log('saleInformation : ', saleInformation);
    })

    it("before fail editFW", async () => {
      beforeL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('l2 native balance(requester): ', beforeL2Balance.toString())
      beforeL2Contract  = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('before l2 native balance (L2CrossTradeBalance): ', beforeL2Contract.toString())
    })


    it("revert the editFW (need the make the requestFW Owner)", async () => {
      const saleCount = await L2CrossTradeProxy.saleCount()

      let saleInformation = await L2CrossTradeContract.dealData(saleCount)

      await expect(L1CrossTradeContract.connect(l1user1).edit(
        saleInformation.l1token,
        saleInformation.l2token,
        threeETH,
        oneETH,
        saleCount,
        l2ChainId,
        1200000,
        saleInformation.hashValue
      )).to.be.rejectedWith("Hash values do not match.")
      
      // const editTx = await L1CrossTradeContract.connect(l1user1).edit(
      //   saleInformation.l1token,
      //   saleInformation.l2token,
      //   threeETH,
      //   oneETH,
      //   saleCount,
      //   l2ChainId,
      //   1200000,
      //   saleInformation.hashValue
      // )
      // await editTx.wait()
    
      // await messenger.waitForMessageStatus(editTx.hash, MessageStatus.RELAYED)
    })

    it("after fail editFW", async () => {
      afterL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('l2 native balance(requester): ', afterL2ETHBalance.toString())
      afterL2Contract = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('after l2 native balance (L2CrossTradeBalance): ', afterL2Contract.toString())


      expect(beforeL2ETHBalance).to.be.equal(afterL2ETHBalance)
      expect(beforeL2Contract).to.be.equal(afterL2Contract)
    })

    it("edit in L1", async () => {
      beforeL2ETHBalance = await l2ETHERC20.balanceOf(l2Wallet.address)
      // console.log('l2 ETH(ERC20) balance (Wallet): ', beforeL2ETHBalance.toString())

      beforeL2Contract = await l2ETHERC20.balanceOf(L2CrossTradeContract.address)
      // console.log('before L2 ETH (L2CrossTradeBalance): ', beforeL2Contract.toString())

      const saleCount = await L2CrossTradeProxy.saleCount()

      let saleInformation = await L2CrossTradeContract.dealData(saleCount)

      const editTx = await L1CrossTradeContract.connect(l1Wallet).edit(
        saleInformation.l1token,
        saleInformation.l2token,
        threeETH,
        oneETH,
        saleCount,
        l2ChainId,
        1200000,
        saleInformation.hashValue
      )
      await editTx.wait()
      // console.log("editTx : ", editTx.hash)
    
      await messenger.waitForMessageStatus(editTx.hash, MessageStatus.RELAYED)
      // console.log("send the Message L1 to L2");
      
      saleInformation = await L2CrossTradeContract.dealData(saleCount)
      let editCheck = await L2CrossTradeContract.editCheck(saleInformation.hashValue)
      if(editCheck != true) {
        console.log("=============== edit ERROR ===============")
      }
    })
  })

});
