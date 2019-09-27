const BN = require('bn.js');
const Utils = require("./utils");
const truffleAssert = require('truffle-assertions');

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - withdraw", accounts => {
    const owner = accounts[0];
    const fallbackPublisherAddress = accounts[1];
    const withdrawalPublisherAddress = accounts[2];
    const immediatelyWithdrawableLimitPublisher = accounts[3];
    
    const account = accounts[4];
    const accountNonce = new BN(0);
    const amount = new BN(100);
    const rootNonce = new BN(1);

    let stakingContract;
    let fxcToken;

    let merkleRoot;
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
        ({merkleRoot, merkleProof} = await Utils.addWithdrawalRootGivingAddressWithdrawableBalance(
            withdrawalPublisherAddress,
            account,
            amount,
            rootNonce,
            accountNonce,
            stakingContract
        ));

        // Set the limit to one withdrawal
        await Utils.setImmediatelyWithdrawableLimit(
            immediatelyWithdrawableLimitPublisher,
            amount,
            stakingContract
        );
    });

    describe("execution", () => {
        it("should withdraw", async () => {
            await Utils.withdraw(
                account,
                account,
                amount,
                accountNonce,
                rootNonce,
                merkleProof,
                stakingContract,
                fxcToken
            );
        });
    });

    describe("permissions", () => {
        it("should allow owner to force withdrawal", async () => {
            await Utils.withdraw(
                owner,
                account,
                amount,
                accountNonce,
                rootNonce,
                merkleProof,
                stakingContract,
                fxcToken
            );
        });

        it("should disallow non-contract-owner, non-account-owner withdrawal", async () => {
            try {
                await Utils.withdraw(
                    fallbackPublisherAddress,
                    account,
                    amount,
                    accountNonce,
                    rootNonce,
                    merkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the owner or recipient can execute a withdrawal"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("constraints", () => {
        it("makes sure provided account nonce is <= account nonce in contract", async () => {
            // Will update the account nonce such that the next withdrawal is not permitted
            await Utils.withdraw(
                account,
                account,
                amount,
                accountNonce,
                rootNonce,
                merkleProof,
                stakingContract,
                fxcToken
            );
            try {
                await Utils.withdraw(
                    account,
                    account,
                    amount,
                    accountNonce,
                    rootNonce,
                    merkleProof,
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
        });

        it("does not allow cumulative withdrawals in excess of immediately withdrawable limit", async () => {
            // Will decrease immediately withdrawable limit to 0
            await Utils.withdraw(
                account,
                account,
                amount,
                accountNonce,
                rootNonce,
                merkleProof,
                stakingContract,
                fxcToken
            );
            try {
                await Utils.withdraw(
                    account,
                    account,
                    amount,
                    accountNonce.add(new BN(1)),
                    rootNonce,
                    merkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Withdrawal would push contract over its immediately withdrawable limit"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("fails if provided account nonce is not in any merkle root's leaf data", async () => {
            try {
                await Utils.withdraw(
                    account,
                    account,
                    amount,
                    accountNonce.add(new BN(1)),
                    rootNonce,
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

        it("fails if provided amount is not in any merkle root's leaf data", async () => {
            await Utils.setImmediatelyWithdrawableLimit(
                immediatelyWithdrawableLimitPublisher,
                amount.add(new BN(1)),
                stakingContract
            );

            try {
                await Utils.withdraw(
                    account,
                    account,
                    amount.add(new BN(1)),
                    accountNonce,
                    rootNonce,
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

        it("fails if merkle proof does not match", async () => {
            try {
                await Utils.withdraw(
                    account,
                    account,
                    amount,
                    accountNonce,
                    rootNonce,
                    [Utils.keccak256("Not the right root")],
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

        it("prevents double-withdrawals", async () => {
            const exceedingAccountNonce = rootNonce.add(new BN(2));

            ({_, merkleProof} = await Utils.addWithdrawalRootGivingAddressWithdrawableBalance(
                withdrawalPublisherAddress,
                account,
                amount,
                rootNonce.add(new BN(1)),
                exceedingAccountNonce,
                stakingContract,
                [merkleRoot]
            ));
            try {
                await Utils.withdraw(
                    account,
                    account,
                    amount,
                    exceedingAccountNonce,
                    rootNonce,
                    merkleProof,
                    stakingContract,
                    fxcToken
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Encoded nonce not greater than max last authorized nonce for this account"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

    });
});