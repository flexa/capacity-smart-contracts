const BN = require('bn.js');
const Utils = require("./utils");

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - setFallbackRoot", accounts => {
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

        // Bump deposit nonce so we can invalidate it.
        await Utils.approveAndDeposit(
            owner, 
            fxcToken, 
            stakingContract,
            100
        );
    });

    describe("execution", () => {
        it("should set fallback root", async () => {
            const maxDepositIncluded = await stakingContract._fallbackMaxDepositIncluded();

            const rootToSet = Utils.keccak256('new fallback root');

            await Utils.setFallbackRoot(
                fallbackPublisherAddress, 
                stakingContract, 
                rootToSet,
                maxDepositIncluded.add(new BN(1)),
            );
        });
    });

    describe("permissions", () => {
        it("should allow owner to add a new root", async () => {
            const maxDepositIncluded = await stakingContract._fallbackMaxDepositIncluded();

            const rootToSet = Utils.keccak256('new fallback root');

            await Utils.setFallbackRoot(
                owner, 
                stakingContract, 
                rootToSet, 
                maxDepositIncluded.add(new BN(1)),
            );
        });

        it("should disallow non-owner non-fallbackPublisher to add a new root", async () => {
            const maxDepositIncluded = await stakingContract._fallbackMaxDepositIncluded();

            const rootToSet = Utils.keccak256('new fallback root');

            try {
                await Utils.setFallbackRoot(
                    withdrawalPublisherAddress, 
                    stakingContract, 
                    rootToSet, 
                    maxDepositIncluded.add(new BN(1)),
                );
            } catch(e) {
                assert(
                    e.message.includes("Only the owner and fallback publisher can set the fallback root hash"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("constraints", () => {
        it("prevents deposit nonce from decreasing", async () => {
            const maxDepositIncluded = await stakingContract._fallbackMaxDepositIncluded();

            const rootToSet = Utils.keccak256('new fallback root');

            try {
                await Utils.setFallbackRoot(
                    fallbackPublisherAddress, 
                    stakingContract, 
                    rootToSet, 
                    maxDepositIncluded.add(new BN(1)),
                );
            } catch(e) {
                assert(
                    e.message.includes("Max deposit included must remain the same or increase"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("prevents invalidating future deposits", async () => {
            const rootToSet = Utils.keccak256('new fallback root');
            const depositNonce = await stakingContract._depositNonce();

            try {
                await Utils.setFallbackRoot(
                    fallbackPublisherAddress, 
                    stakingContract, 
                    rootToSet, 
                    depositNonce.add(new BN(1)),
                );
            } catch(e) {
                assert(
                    e.message.includes("Cannot invalidate future deposits"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("should fail if new root is 0", async () => {
            const maxDepositIncluded = await stakingContract._fallbackMaxDepositIncluded();
            const rootToSet = Utils.getEmptyBytes32();
            try {
                await Utils.setFallbackRoot(
                    fallbackPublisherAddress, 
                    stakingContract, 
                    rootToSet, 
                    maxDepositIncluded.add(new BN(1)),
                );
            } catch(e) {
                assert(
                    e.message.includes("New root may not be 0"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("prevents fallback root from being set if fallback mechanism is active", async () => {
            await stakingContract.resetFallbackMechanismDate({from: fallbackPublisherAddress});
            await Utils.setFallbackWithdrawalDelay(stakingContract, 1);
            await Utils.moveTimeForwardSecondsAndMineBlock(5);

            const maxDepositIncluded = await stakingContract._fallbackMaxDepositIncluded();
            const rootToSet = Utils.keccak256('new fallback root');

            try {
                await Utils.setFallbackRoot(
                    fallbackPublisherAddress, 
                    stakingContract, 
                    rootToSet,
                    maxDepositIncluded.add(new BN(1)),
                );
            } catch(e) {
                assert(
                    e.message.includes("Cannot set fallback root while fallback mechanism is active"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });
});