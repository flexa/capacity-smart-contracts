# network-staking-contract

Contains the Smart Contract source code for Flexa's staking wallet, allowing users to deposit FXC to be staked on the Flexa platform.

# Requirements
* [NodeJS](https://nodejs.org/en/download/)

# Running locally
In order to run the contracts locally,
* Compile the smart contracts
* Start the Truffle development console
* Deploy the smart contracts
```javascript
$ cd /path/to/network-staking-contract
$ npm install                   // Install the required NPM packages (truffle and openzeppelin-solidity for now)
$ truffle compile               // compiles the smart contracts
$ truffle develop               // starts the truffle development console, including a local blockchain
Truffle Develop started at http://127.0.0.1:9545/
...
truffle(develop)> deploy        // deploys the smart contracts
Starting migrations...
...
   Deploying 'Staking'
   -------------------
   > transaction hash:    0x713118674a2d2d33965896000d0608fc742d4e168200183661e45ae2440b3c8d
   > Blocks: 0            Seconds: 0
   > contract address:    0x62395D7FF20eBae660b0d212f47E823Ad4Cc1Db2
   > account:             0x93606DdFd78D741B6f9d6D572E8b9bfEcB32930B
   > balance:             99.88672006
   > gas used:            3964787
   > gas price:           20 gwei
   > value sent:          0 ETH
   > total cost:          0.07929574 ETH

   > Saving artifacts
   -------------------------------------
   > Total cost:          0.10776974 ETH
...
```

Now that the contracts are deployed, you can interact with them within the Truffle development console:
```javascript
truffle(develop)> const staking = await Staking.deployed()
truffle(develop)> await staking._withdrawalPublisher() // simply hitting a getter function.
'0x369CCCb3bF65a6D44C2CE65CAC45Bc02D4052Aa2'
```

For testing locally, we've deployed a vanilla ERC-20 (TFXC) token to mimic FXC. You'll need to grant the FlexaStakingWallet contract access to deposit your TFXC funds:
```javascript
truffle(develop)> const token = await LocalFXCToken.deployed()
truffle(develop)> await token.approve(staking.address, 100)  // Approve 100 TFXC for deposit
```

Now you may test deposit, withdrawal, etc.
```javascript
truffle(develop)> await staking.deposit(100)
truffle(develop)> await staking._nonceToPendingDeposit(1)
Result {
  '0': '<your account address here>',
  '1':
   BN {
     negative: 0,
     words: [ 100, <1 empty item> ],
     length: 1,
     red: null },
  depositor: '<your account address here>',
  amount:
   BN {
     negative: 0,
     words: [ 100, <1 empty item> ],
     length: 1,
     red: null } }
truffle(develop)> const account = (await web3.eth.getAccounts())[0]
truffle(develop)> await staking.withdraw(account, 100, 1, [])
{ Error: Returned error: VM Exception while processing transaction: revert Root hash unauthorized -- Reason given: Root hash unauthorized. ...
// Error because the authorization for this withdrawal doesn't exist
```

# Automated Tests
Tests are divided between unit tests and integration tests, which can be run with:
```javascript
cd /path/to/network-staking-contract
truffle test
```

# Deploying

## Rinkeby
### Setup:
1) Create a `.env` file of the same format as `.example.env` but with the correct mnemonic and infura Rinkeby Key

2) Uncomment the following in `truffle-config.js`:
```
    //    optimizer: {
    //      enabled: true,
    //      runs: 200
    //    },
```

### Deployment
Clean start migration: `truffle migrate --network rinkeby --reset --compile-all`

OR

Incremental migration: `truffle migrate --network rinkeby --compile-all`

### Test
Open up the truffle console pointed to rinkeby: `truffle console --network rinkeby `

```javascript
truffle(rinkeby)> const staking = await Staking.deployed()
truffle(rinkeby)> const fxcAddress = await staking._tokenAddress()
truffle(rinkeby)> fxcAddress
> // this should be the deployed LocalFXCToken address 
truffle(rinkeby)> const token = await LocalFXCToken.deployed()
truffle(rinkeby)> const balance = await token.balanceOf('0x369CCCb3bF65a6D44C2CE65CAC45Bc02D4052Aa2')
truffle(rinkeby)> balance.toString()
> '1000000000000000000000000' // Initial supply of test FXC
```

