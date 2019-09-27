const BN = require("bn.js");
const truffleAssert = require('truffle-assertions');

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const EMPTY_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000"
const EMPTY_LEAF_HASH = web3.utils.keccak256(web3.eth.abi.encodeParameter('uint256', 0)) 
let nonce = 1;

module.exports = class Utils {

    static async deposit(address, tokenContract, stakingContract, amount) {
        const balance = await tokenContract.balanceOf(stakingContract.address);

        const nonceBefore = await stakingContract._depositNonce();
        const receipt = await stakingContract.deposit(amount, {from: address});
        const nonce = await stakingContract._depositNonce();

        truffleAssert.eventEmitted(receipt, 'Deposit', (ev) => {
            return ev.depositor === address && 
                ev.amount.eq(new BN(amount)) &&
                ev.nonce.eq(nonceBefore.add(new BN(1)));
        });

        assert(
            nonce.eq(nonceBefore.add(new BN(1))), 
            "Deposit nonce not incremented!"
        );
    
        const updatedBalance = await tokenContract.balanceOf(stakingContract.address);
        assert(
            updatedBalance.eq(balance.add(new BN(amount))), 
            "Approve and deposit did not work. Balance unchanged."
        );
        
        return nonce;
    }

    static async approveAndDeposit(address, tokenContract, stakingContract, amount) {
        await tokenContract.approve(stakingContract.address, amount, {from: address});
        return await Utils.deposit(address, tokenContract, stakingContract, amount);
    }

    static async executePendingDepositRefund(address, account, tokenContract, stakingContract, depositAmount, depositNonce) {
        const depositBalance = await tokenContract.balanceOf(account);

        const receipt = await stakingContract.refundPendingDeposit(depositNonce, {from: address});

        truffleAssert.eventEmitted(receipt, 'PendingDepositRefund', (ev) => {
            return ev.depositorAddress === account && 
                ev.amount.eq(depositAmount) &&
                ev.nonce.eq(depositNonce);
        });

        const refundBalance = await tokenContract.balanceOf(account);

        assert(
            depositBalance.add(depositAmount).eq(refundBalance),
            "Refund balance not added to account FXC balance!"
        );

        const pendingDeposit = stakingContract._nonceToPendingDeposit(depositNonce);
        assert(
            pendingDeposit.amount === undefined &&
            pendingDeposit.depositor === undefined,
            "Pending Deposit should be deleted!"
        )
    }

    static async addWithdrawalRoot(address, stakingContract, root, nonce, replacedRoots = []) {
        const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
        
        const replacedRootNonces = []
        for (const replacedRoot of replacedRoots) {
            replacedRootNonces.push(await stakingContract._withdrawalRootToNonce(replacedRoot))
        }

        const receipt = await stakingContract.addWithdrawalRoot(
            root, 
            nonce, 
            replacedRoots, 
            {from: address}
        );

        truffleAssert.eventEmitted(receipt, 'WithdrawalRootHashAddition', (ev) => {
            return ev.rootHash === root && 
                ev.nonce.eq(nonce);
        });

        for (let i = 0; i < replacedRoots.length; i++) {
            await Utils.assertWithdrawalRootDeleted(
                replacedRoots[i], 
                replacedRootNonces[i], 
                stakingContract, 
                receipt
            );
        }

        const newMaxNonce = await stakingContract._maxWithdrawalRootNonce();
        assert(newMaxNonce.eq(nonce), "Max nonce not updated to nonce passed to function!");
        assert(newMaxNonce.eq(oldMaxNonce.add(new BN(1))), "Max nonce not incremented by 1!");
        
        const rootNonce = await stakingContract._withdrawalRootToNonce(root);
        assert(rootNonce.eq(newMaxNonce), "Root to nonce map not updated!");
    }

    static async withdraw(address, account, amount, accountNonce, rootNonce, merkleProof, stakingContract, tokenContract) {
        const withdrawableLimitBefore = await stakingContract._immediatelyWithdrawableLimit();
        const cumulativeWithdrawalTotalBefore = await stakingContract._addressToCumulativeAmountWithdrawn(account);
        const balanceBefore = await tokenContract.balanceOf(account);

        const receipt = await stakingContract.withdraw(
            account, 
            amount, 
            accountNonce, 
            merkleProof, 
            {from: address}
        );

        truffleAssert.eventEmitted(receipt, 'Withdrawal', (ev) => {
            return ev.toAddress === account &&
                ev.amount.eq(amount) &&
                ev.rootNonce.eq(rootNonce) &&
                ev.authorizedAccountNonce.eq(accountNonce);
        });

        const balanceAfter = await tokenContract.balanceOf(account);
        assert(
            balanceAfter.sub(balanceBefore).eq(amount), 
            "Account FXC Balance didn't increase by the correct amount!"
        );

        const accountNonceAfter = await stakingContract._addressToWithdrawalNonce(account);
        assert(
            accountNonceAfter.eq(rootNonce), 
            "Account nonce did not update properly!"
        );

        const withdrawableLimitAfter = await stakingContract._immediatelyWithdrawableLimit();
        assert(
            withdrawableLimitBefore.sub(withdrawableLimitAfter).eq(amount), 
            "Immediately withdrawable limit didn't decrease by the proper amount!"
        );

        const cumulativeWithdrawalTotalAfter = await stakingContract._addressToCumulativeAmountWithdrawn(account);
        assert(
            cumulativeWithdrawalTotalAfter.sub(amount).eq(cumulativeWithdrawalTotalBefore), 
            "Address cumulative amount withdrawn should have increased by the withdrawal amount!"
        );
    }

    static async withdrawFallback(address, account, maxCumulativeAmountWithdrawn, merkleProof, stakingContract, tokenContract) {
            
        const balanceBefore = await tokenContract.balanceOf(account);
        const cumulativeWithdrawalTotalBefore = await stakingContract._addressToCumulativeAmountWithdrawn(account);

        const receipt = await stakingContract.withdrawFallback(
            account, 
            maxCumulativeAmountWithdrawn,
            merkleProof, 
            {from: address}
        );

        const withdrawalAmount = maxCumulativeAmountWithdrawn.sub(cumulativeWithdrawalTotalBefore)

        truffleAssert.eventEmitted(receipt, 'FallbackWithdrawal', (ev) => {
            return ev.toAddress === account &&
                ev.amount.eq(withdrawalAmount)
        });

        const balanceAfter = await tokenContract.balanceOf(account);
        assert(
            balanceAfter.sub(balanceBefore).eq(withdrawalAmount), 
            "Account FXC Balance didn't increase by the correct amount!"
        );

        const cumulativeWithdrawalTotalAfter = await stakingContract._addressToCumulativeAmountWithdrawn(account);
        assert(
            cumulativeWithdrawalTotalAfter.gt(cumulativeWithdrawalTotalBefore), 
            "Cumulative withdrawal total should be more after!"
        );

        const withdrawalNonceAfter = await stakingContract._addressToWithdrawalNonce(account);
        const maxWithdrawalRootNonce = await stakingContract._maxWithdrawalRootNonce();
        assert(
            withdrawalNonceAfter.eq(maxWithdrawalRootNonce), 
            "Fallback withdrawal should invalidate any authorized normal withdrawals!"
        );
    }

    static async setFallbackRoot(address, stakingContract, rootToSet, maxDepositIncluded) {
        const oldFallbackSetDate = await stakingContract._fallbackSetDate();
        
        const receipt = await stakingContract.setFallbackRoot(
            rootToSet, 
            maxDepositIncluded, 
            {from: address}
        );

        truffleAssert.eventEmitted(receipt, 'FallbackRootHashSet', (ev) => {
            return ev.rootHash === rootToSet && 
                ev.maxDepositNonceIncluded.eq(maxDepositIncluded);
        });

        const newFallbackSetDate = await stakingContract._fallbackSetDate();
        assert(!newFallbackSetDate.eq(oldFallbackSetDate), "New fallback set date equals old one!");

        const newMaxDepositIncluded = await stakingContract._fallbackMaxDepositIncluded();
        assert(newMaxDepositIncluded.eq(maxDepositIncluded), "new Max deposit does not match max deposit included!");
        
        const newRoot = await stakingContract._fallbackRoot();
        assert(newRoot === rootToSet, "Root does not match root to set!");
    }

    static async setImmediatelyWithdrawableLimit(address, amount, stakingContract) {
        const oldLimit = await stakingContract._immediatelyWithdrawableLimit();
        await Utils.modifyImmediatelyWithdrawableLimit(
            address,
            oldLimit.gt(amount) ? oldLimit.sub(amount).neg() : amount.sub(oldLimit),
            stakingContract
        );
    }

    static async modifyImmediatelyWithdrawableLimit(address, amount, stakingContract) {
        const oldLimit = await stakingContract._immediatelyWithdrawableLimit();
        const receipt = await stakingContract.modifyImmediatelyWithdrawableLimit(amount, {from: address});
        const newLimit = await stakingContract._immediatelyWithdrawableLimit();

        const expectedNewLimit = oldLimit.add(amount)

        truffleAssert.eventEmitted(receipt, 'ImmediatelyWithdrawableLimitUpdate', (ev) => {
            return ev.oldValue.eq(oldLimit) &&
                ev.newValue.eq(expectedNewLimit);
        });

        assert(!oldLimit.eq(newLimit), 'Limit was not updated!');
        assert(newLimit.eq(expectedNewLimit), "Limit does not match value it was updated to!");
    }

    static async removeWithdrawalRoots(address, rootsToRemove, stakingContract) {
        const removedNonces = []
        for (const rootToRemove of rootsToRemove) {
            removedNonces.push(await stakingContract._withdrawalRootToNonce(rootToRemove))
        }

        const receipt = await stakingContract.removeWithdrawalRoots(rootsToRemove, {from: address});
        
        for (let i = 0; i < rootsToRemove.length; i++) {
            await Utils.assertWithdrawalRootDeleted(rootsToRemove[i], removedNonces[i], stakingContract, receipt);
        }
    }

    static async assertWithdrawalRootDeleted(root, nonce, stakingContract, txReceipt) {
        truffleAssert.eventEmitted(txReceipt, 'WithdrawalRootHashRemoval', (ev) => {
            return ev.rootHash === root && 
                ev.nonce.eq(nonce);
        });

        const rootNonce = await stakingContract._withdrawalRootToNonce(root);
        assert(rootNonce.eq(new BN(0)), `Root nonce still exists: ${rootNonce}, root: ${root}`);
    }

    static async setFallbackWithdrawalDelay(stakingContract, delay) {
        const oldValue = await stakingContract._fallbackWithdrawalDelaySeconds();
        const receipt = await stakingContract.setFallbackWithdrawalDelay(delay);
        const newValue = await stakingContract._fallbackWithdrawalDelaySeconds();

        truffleAssert.eventEmitted(receipt, 'FallbackWithdrawalDelayUpdate', (ev) => {
            return ev.oldValue.eq(oldValue) && 
                ev.newValue.eq(new BN(delay));
        });

        assert.equal(newValue, delay);
    }

    static async resetFallbackMechanismDate(address, stakingContract) {
        const fallbackSetDate = await stakingContract._fallbackSetDate();

        const receipt = await stakingContract.resetFallbackMechanismDate({from: address});

        truffleAssert.eventEmitted(receipt, 'FallbackMechanismDateReset', (ev) => {
            return !ev.newDate.eq(fallbackSetDate);
        });

        const updatedFallbackSetDate = await stakingContract._fallbackSetDate();
        assert(
            !fallbackSetDate.eq(updatedFallbackSetDate),
            "Fallback set date should have been updated!"
        )
    }

    static async addWithdrawalRootGivingAddressWithdrawableBalance(
        publishAccount, 
        withdrawAccount,
        withdrawableAmount,
        rootNonce,
        addressNonce,
        stakingContract,
        rootsToRemove = []
    ) {

        const datahash = web3.utils.soliditySha3(
            withdrawAccount, 
            withdrawableAmount, 
            addressNonce
        );
        let root;
        if (datahash < EMPTY_LEAF_HASH) {
            root = web3.utils.soliditySha3(datahash, EMPTY_LEAF_HASH);
        } else {
            root = web3.utils.soliditySha3(EMPTY_LEAF_HASH, datahash);
        }

        await Utils.addWithdrawalRoot(publishAccount, stakingContract, root, rootNonce, rootsToRemove);

        return {
            merkleRoot: root,
            merkleProof: [EMPTY_LEAF_HASH]
        }
    }

    static async setFallbackRootGivingAddressWithdrawableBalance(
        publishAccount, 
        withdrawAccount,
        maxCumulativeAmountWithdrawn,
        maxDepositIncluded,
        stakingContract
    ) {

        const datahash = web3.utils.soliditySha3(
            withdrawAccount, 
            maxCumulativeAmountWithdrawn, 
        );
        let root;
        if (datahash < EMPTY_LEAF_HASH) {
            root = web3.utils.soliditySha3(datahash, EMPTY_LEAF_HASH);
        } else {
            root = web3.utils.soliditySha3(EMPTY_LEAF_HASH, datahash);
        }

        await Utils.setFallbackRoot(publishAccount, stakingContract, root, maxDepositIncluded);

        return {
            merkleRoot: root,
            merkleProof: [EMPTY_LEAF_HASH]
        }
    }

    static getNullAddress() {
        return NULL_ADDRESS;
    }
    
    static getEmptyBytes32() {
        return EMPTY_BYTES32;
    }

    static hexStringToBN(str) {
        return new BN(str.slice(2), "hex");
    }

    static keccak256(str) {
        return web3.utils.keccak256(str);
    }

    static async moveTimeForwardSecondsAndMineBlock(seconds) {
        await Utils.web3Send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [seconds],
            id: 0
        });

        await Utils.web3Send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: nonce++
        });
    }
    
    static web3Send(params) {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send(
                params,
                (err, result) => {
                    if (err) { return reject(err); }
                    return resolve(result);
                }
            );
        });
    }
}
