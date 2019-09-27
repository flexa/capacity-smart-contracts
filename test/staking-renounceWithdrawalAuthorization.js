const BN = require('bn.js');
const truffleAssert = require('truffle-assertions');
const Utils = require("./utils");

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - renounceWithdrawalAuthorization", accounts => {
    const owner = accounts[0];
    const fallbackPublisherAddress = accounts[1];
    const withdrawalPublisherAddress = accounts[2];
    const immediatelyWithdrawableLimitPublisher = accounts[3];

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

        await stakingContract.addWithdrawalRoot(
            Utils.keccak256("invalid"), 
            1, 
            [],
            {from: withdrawalPublisherAddress}
        );
    });

    describe("execution", () => {
        it("should renounce for sender", async () => {
            const previousNonce = await stakingContract._addressToWithdrawalNonce(accounts[4]);
            const receipt = await stakingContract.renounceWithdrawalAuthorization(accounts[4], {from: accounts[4]});

            truffleAssert.eventEmitted(receipt, 'RenounceWithdrawalAuthorization', (ev) => {
                return ev.forAddress === accounts[4];
            });

            const withdrawalNonce = await stakingContract._addressToWithdrawalNonce(accounts[4]);
            assert(previousNonce.lt(withdrawalNonce), "Withdrawal nonce should have increased!")
            assert(withdrawalNonce.eq(new BN(1)), "Withdrawal nonce should be 1!")
        });
    });

    describe("permissions", () => {
        it("should allow owner to stake anybody", async () => {
            const previousNonce = await stakingContract._addressToWithdrawalNonce(accounts[4]);
            const receipt = await stakingContract.renounceWithdrawalAuthorization(accounts[4], {from: withdrawalPublisherAddress});

            truffleAssert.eventEmitted(receipt, 'RenounceWithdrawalAuthorization', (ev) => {
                return ev.forAddress === accounts[4];
            });

            const withdrawalNonce = await stakingContract._addressToWithdrawalNonce(accounts[4]);
            assert(previousNonce.lt(withdrawalNonce), "Withdrawal nonce should have increased!")
            assert(withdrawalNonce.eq(new BN(1)), "Withdrawal nonce should be 1!")
        });

        it("should allow withdrawal publisher to stake anybody", async () => {
            const previousNonce = await stakingContract._addressToWithdrawalNonce(accounts[4]);
            const receipt = await stakingContract.renounceWithdrawalAuthorization(accounts[4], {from: owner});

            truffleAssert.eventEmitted(receipt, 'RenounceWithdrawalAuthorization', (ev) => {
                return ev.forAddress === accounts[4];
            });

            const withdrawalNonce = await stakingContract._addressToWithdrawalNonce(accounts[4]);
            assert(previousNonce.lt(withdrawalNonce), "Withdrawal nonce should have increased!")
            assert(withdrawalNonce.eq(new BN(1)), "Withdrawal nonce should be 1!")
        });

        it("should fail if from address is not sender and sender is not owner", async () => {
            try {
                await stakingContract.renounceWithdrawalAuthorization(accounts[5], {from: accounts[4]});
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the owner, withdrawal publisher, and address in question can renounce a withdrawal authorization"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("constraints", () => {
        it("should fail to stake if nonce >= max withdrawal nonce", async () => {
            const previousNonce = await stakingContract._addressToWithdrawalNonce(accounts[4]);
            const receipt = await stakingContract.renounceWithdrawalAuthorization(accounts[4], {from: accounts[4]});

            truffleAssert.eventEmitted(receipt, 'RenounceWithdrawalAuthorization', (ev) => {
                return ev.forAddress === accounts[4];
            });

            const withdrawalNonce = await stakingContract._addressToWithdrawalNonce(accounts[4]);
            assert(previousNonce.lt(withdrawalNonce), "Withdrawal nonce should have increased!")
            assert(withdrawalNonce.eq(new BN(1)), "Withdrawal nonce should be 1!")


            try {
                await stakingContract.renounceWithdrawalAuthorization(accounts[4], {from: accounts[4]});
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Address nonce indicates there are no funds withdrawable"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });
});