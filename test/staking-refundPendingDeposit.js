const BN = require('bn.js');
const Utils = require("./utils");

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - refundPendingDeposit", async accounts => {
    await Utils.moveTimeForwardSecondsAndMineBlock(1);

    const owner = accounts[0];
    const fallbackPublisherAddress = accounts[1];
    const withdrawalPublisherAddress = accounts[2];
    const immediatelyWithdrawableLimitPublisher = accounts[3];
    const account = accounts[4];

    let stakingContract;
    let fxcToken;

    beforeEach(async () => {
        fxcToken = await LocalFXCToken.new();
        stakingContract = await Staking.new(
            fxcToken.address, 
            fallbackPublisherAddress, 
            withdrawalPublisherAddress,
            immediatelyWithdrawableLimitPublisher
        );

        await stakingContract.setFallbackRoot(
            Utils.keccak256("invalid"), 
            0,
            {from: fallbackPublisherAddress}
        );

        
        await Utils.setFallbackWithdrawalDelay(stakingContract, 1);
        await fxcToken.transfer(account, 100, {from: owner});
        
        await Utils.moveTimeForwardSecondsAndMineBlock(5);
    });

    describe("execution", () => {
        it("should refund pending deposit", async () => {
            const depositAmount = new BN(50);
            const nonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());

            await Utils.executePendingDepositRefund(account, account, fxcToken, stakingContract, depositAmount, nonce);
        });

        it("should refund both pending deposits when multiple pending", async () => {
            const depositAmount = new BN(50);
            const firstNonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());
            const secondNonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());
            
            await Utils.executePendingDepositRefund(account, account, fxcToken, stakingContract, depositAmount, firstNonce);
            await Utils.executePendingDepositRefund(account, account, fxcToken, stakingContract, depositAmount, secondNonce);
        });

        it("should refund both pending deposits out of order when multiple pending", async () => {
            const depositAmount = new BN(50);
            const firstNonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());
            const secondNonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());
            
            await Utils.executePendingDepositRefund(account, account, fxcToken, stakingContract, depositAmount, secondNonce);
            await Utils.executePendingDepositRefund(account, account, fxcToken, stakingContract, depositAmount, firstNonce);
        });
    });

    describe("permissions", () => {
        it("should permit owner to refund", async () => {
            const depositAmount = new BN(50);
            const nonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());
            
            Utils.executePendingDepositRefund(owner, account, fxcToken, stakingContract, depositAmount, nonce);
        });

        it("should disallow non-owner, non-depositor to refund", async () => {
            const depositAmount = new BN(50);
            const nonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());
            
            try {
                await Utils.executePendingDepositRefund(accounts[5], account, fxcToken, stakingContract, depositAmount, nonce);
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the owner or depositor can initiate the refund of a pending deposit"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("constraints", () => {
        it("should disallow refunds when fallback mechanism is not active", async () => {
            await Utils.setFallbackWithdrawalDelay(stakingContract, 100);

            const depositAmount = new BN(50);
            const nonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());
            
            try {
                await Utils.executePendingDepositRefund(account, account, fxcToken, stakingContract, depositAmount, nonce);
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Fallback withdrawal period is not active, so refunds are not permitted"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("should disallow refund of deposit included in fallback root tree", async () => {
            const depositAmount = new BN(50);
            const nonce = await Utils.approveAndDeposit(account, fxcToken, stakingContract, depositAmount.toNumber());
            
            await Utils.setFallbackWithdrawalDelay(stakingContract, 10000);
            await Utils.moveTimeForwardSecondsAndMineBlock(1);

            await stakingContract.setFallbackRoot(
                Utils.keccak256("invalid"), 
                1,
                {from: fallbackPublisherAddress}
            );

            await Utils.setFallbackWithdrawalDelay(stakingContract, 1);
            await Utils.moveTimeForwardSecondsAndMineBlock(5);

            try {
                await Utils.executePendingDepositRefund(account, account, fxcToken, stakingContract, depositAmount, nonce);
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("There is no pending deposit for the specified nonce"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });
});