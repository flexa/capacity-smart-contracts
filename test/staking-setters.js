const Utils = require("./utils");
const truffleAssert = require('truffle-assertions');

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - Setters", accounts => {
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
    });

    describe("setWithdrawalPublisher", () => {
        it("should update publisher", async () => {
            const currentPublisher = await stakingContract._withdrawalPublisher();
            const receipt = await stakingContract.setWithdrawalPublisher(accounts[4]);
            const newPublisher = await stakingContract._withdrawalPublisher();

            truffleAssert.eventEmitted(receipt, 'WithdrawalPublisherUpdate', (ev) => {
                return ev.oldValue === currentPublisher && 
                    ev.newValue === newPublisher;
            });

            assert.notEqual(currentPublisher, newPublisher, 'Publisher was not updated!');
            assert.equal(newPublisher, accounts[4], "Publisher does not match account it was updated to!");
        });

        it("should fail update if not owner", async () => {
            try {
                await stakingContract.setWithdrawalPublisher(accounts[4], {from: accounts[1]});
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the owner can set the withdrawal publisher address"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("setFallbackPublisher", () => {
        it("should update publisher", async () => {
            const currentPublisher = await stakingContract._fallbackPublisher();
            const receipt = await stakingContract.setFallbackPublisher(accounts[4]);
            const newPublisher = await stakingContract._fallbackPublisher();

            truffleAssert.eventEmitted(receipt, 'FallbackPublisherUpdate', (ev) => {
                return ev.oldValue === currentPublisher && 
                    ev.newValue === newPublisher;
            });

            assert.notEqual(currentPublisher, newPublisher, 'Publisher was not updated!');
            assert.equal(newPublisher, accounts[4], "Publisher does not match account it was updated to!");
        });

        it("should fail update if not owner", async () => {
            try {
                await stakingContract.setFallbackPublisher(accounts[4], {from: accounts[1]});
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the owner can set the fallback publisher address"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("setImmediatelyWithdrawableLimitPublisher", () => {
        it("should update publisher", async () => {
            const currentPublisher = await stakingContract._immediatelyWithdrawableLimitPublisher();
            const receipt = await stakingContract.setImmediatelyWithdrawableLimitPublisher(accounts[4]);
            const newPublisher = await stakingContract._immediatelyWithdrawableLimitPublisher();

            truffleAssert.eventEmitted(receipt, 'ImmediatelyWithdrawableLimitPublisherUpdate', (ev) => {
                return ev.oldValue === currentPublisher && 
                    ev.newValue === newPublisher;
            });

            assert.notEqual(currentPublisher, newPublisher, 'Publisher was not updated!');
            assert.equal(newPublisher, accounts[4], "Publisher does not match account it was updated to!");
        });

        it("should fail update if not owner", async () => {
            try {
                await stakingContract.setImmediatelyWithdrawableLimitPublisher(accounts[4], {from: accounts[1]});
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the owner can set the immediately withdrawable limit publisher address"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("setFallbackWithdrawalDelay", () => {
        it("should update delay", async () => {
            await Utils.setFallbackWithdrawalDelay(stakingContract, 10);
        });

        it("should fail update if not owner", async () => {
            try {
                await stakingContract.setFallbackWithdrawalDelay(10, {from: accounts[1]});
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the owner can set the fallback withdrawal delay"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("should not allow it to be set to 0", async () => {
            try {
                await Utils.setFallbackWithdrawalDelay(stakingContract, 0);
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("New fallback delay may not be 0"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });
});