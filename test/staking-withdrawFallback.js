const BN = require('bn.js');
const Utils = require("./utils");
const truffleAssert = require('truffle-assertions');

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - withdraw", async accounts => {
    await Utils.moveTimeForwardSecondsAndMineBlock(1);

    const owner = accounts[0];
    const fallbackPublisherAddress = accounts[1];
    const withdrawalPublisherAddress = accounts[2];
    const immediatelyWithdrawableLimitPublisher = accounts[3];
    
    const account = accounts[4];
    const maxCumulativeWithdrawalAmount = new BN(100);
    const maxDepositNonce = new BN(1);

    let stakingContract;
    let fxcToken;

    let merkleProof;

    beforeEach(async () => {
        fxcToken = await LocalFXCToken.new();
        stakingContract = await Staking.new(
            fxcToken.address,
            fallbackPublisherAddress,
            withdrawalPublisherAddress,
            immediatelyWithdrawableLimitPublisher
        );

        await Utils.approveAndDeposit(owner, fxcToken, stakingContract, 10000);
        ({merkleRoot, merkleProof} = await Utils.setFallbackRootGivingAddressWithdrawableBalance(
            fallbackPublisherAddress,
            account,
            maxCumulativeWithdrawalAmount,
            maxDepositNonce,
            stakingContract
        ));

        await Utils.setFallbackWithdrawalDelay(stakingContract, 1);
        await Utils.moveTimeForwardSecondsAndMineBlock(5);
    });

    describe("execution", () => {
        it("should fallback withdraw", async () => {
            await Utils.withdrawFallback(
                account,
                account,
                maxCumulativeWithdrawalAmount,
                merkleProof,
                stakingContract,
                fxcToken
            );
        });
    });

    describe("permissions", () => {
        it("should allow owner to force withdrawal", async () => {
            await Utils.withdrawFallback(
                owner,
                account,
                maxCumulativeWithdrawalAmount,
                merkleProof,
                stakingContract,
                fxcToken
            );
        });

        it("should disallow non-contract-owner, non-account-owner withdrawal", async () => {
            try {
                await Utils.withdrawFallback(
                    withdrawalPublisherAddress,
                    account,
                    maxCumulativeWithdrawalAmount,
                    merkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the owner or recipient can execute a fallback withdrawal"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("constraints", () => {
        it("fails if the fallback withdrawal delay hasn't lapsed", async () => {
            await Utils.setFallbackWithdrawalDelay(stakingContract, 15);

            await Utils.moveTimeForwardSecondsAndMineBlock(1);

            try {
                await Utils.withdrawFallback(
                    account,
                    account,
                    maxCumulativeWithdrawalAmount,
                    merkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Fallback withdrawal period is not active"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("fails for double-withdrawals", async () => {
            // Will set the account's fallback nonce to the root nonce
            await Utils.withdrawFallback(
                account,
                account,
                maxCumulativeWithdrawalAmount,
                merkleProof,
                stakingContract,
                fxcToken
            );

            try {
                await Utils.withdrawFallback(
                    account,
                    account,
                    maxCumulativeWithdrawalAmount,
                    merkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Withdrawal not permitted when amount withdrawn is at lifetime withdrawal limit"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
        
        it("fails for invalid merkle proof", async () => {
            const badMerkleProof = [Utils.keccak256("invalid")];
            try {
                await Utils.withdrawFallback(
                    account,
                    account,
                    maxCumulativeWithdrawalAmount,
                    badMerkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Root hash unauthorized"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("fails if max cumulative amount is wrong", async () => {
            const badMerkleProof = [Utils.keccak256("invalid")];
            try {
                await Utils.withdrawFallback(
                    account,
                    account,
                    maxCumulativeWithdrawalAmount.add(new BN(1)),
                    badMerkleProof,
                    stakingContract,
                    fxcToken,
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Root hash unauthorized"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("fails for old merkle proof if root is updated", async () => {
            await Utils.setFallbackWithdrawalDelay(stakingContract, 10000);
            await Utils.moveTimeForwardSecondsAndMineBlock(1);

            // Sets the fallback nonce 2 ahead of authorized account fallback nonce
            ({merkleRoot, merkleProof} = await Utils.setFallbackRootGivingAddressWithdrawableBalance(
                fallbackPublisherAddress,
                withdrawalPublisherAddress,
                maxCumulativeWithdrawalAmount,
                maxDepositNonce,
                stakingContract
            ));

            await Utils.setFallbackWithdrawalDelay(stakingContract, 1);
            await Utils.moveTimeForwardSecondsAndMineBlock(5);

            try {
                await Utils.withdrawFallback(
                    account,
                    account,
                    maxCumulativeWithdrawalAmount,
                    merkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Root hash unauthorized"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("fails to withdraw from regular authorized withdrawal with honest authorized account nonce after fallback withdrawal", async () => {
            const rootNonce = new BN(1);
            const accountNonce = new BN(0);

            ({merkleProof: regularWithdrawalMerkleProof} = await Utils.addWithdrawalRootGivingAddressWithdrawableBalance(
                withdrawalPublisherAddress,
                account,
                maxCumulativeWithdrawalAmount,
                rootNonce,
                accountNonce,
                stakingContract
            ));

            await Utils.setImmediatelyWithdrawableLimit(
                immediatelyWithdrawableLimitPublisher,
                maxCumulativeWithdrawalAmount,
                stakingContract
            );
            
            await Utils.withdrawFallback(
                account,
                account,
                maxCumulativeWithdrawalAmount,
                merkleProof,
                stakingContract,
                fxcToken
            );

            try {
                await Utils.withdraw(
                    account,
                    account,
                    maxCumulativeWithdrawalAmount,
                    accountNonce,
                    rootNonce,
                    regularWithdrawalMerkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Account nonce in contract exceeds provided max authorized withdrawal nonce for this account"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        })

        it("fails to withdraw from regular authorized withdrawal with dishonest authorized account nonce after fallback withdrawal", async () => {
            const rootNonce = new BN(1);
            const accountNonce = new BN(0);

            ({merkleProof: regularWithdrawalMerkleProof} = await Utils.addWithdrawalRootGivingAddressWithdrawableBalance(
                withdrawalPublisherAddress,
                account,
                maxCumulativeWithdrawalAmount,
                rootNonce,
                accountNonce,
                stakingContract
            ));

            await Utils.setImmediatelyWithdrawableLimit(
                immediatelyWithdrawableLimitPublisher,
                maxCumulativeWithdrawalAmount,
                stakingContract
            );
            
            await Utils.withdrawFallback(
                account,
                account,
                maxCumulativeWithdrawalAmount,
                merkleProof,
                stakingContract,
                fxcToken
            );

            try {
                await Utils.withdraw(
                    account,
                    account,
                    maxCumulativeWithdrawalAmount,
                    accountNonce.add(new BN(1)),
                    rootNonce,
                    regularWithdrawalMerkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Root hash unauthorized"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        })
     });
});