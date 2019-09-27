const BN = require('bn.js');
const Utils = require("./utils");

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - addWithdrawalRoot", accounts => {
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

    describe("execution", () => {
        it("should add a new root", async () => {
            const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
            const rootToSet = Utils.keccak256('new withdrawal root');

            await Utils.addWithdrawalRoot(
                withdrawalPublisherAddress, 
                stakingContract, 
                rootToSet, 
                oldMaxNonce.add(new BN(1)), 
                []
            );
        });

        it("should remove previous roots", async () => {
            const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
            
            const firstRoot = Utils.keccak256('new withdrawal root');
            await Utils.addWithdrawalRoot(
                withdrawalPublisherAddress, 
                stakingContract, 
                firstRoot, 
                oldMaxNonce.add(new BN(1)), 
                []
            );

            const secondRoot = Utils.keccak256('new withdrawal root 2');
            await Utils.addWithdrawalRoot(
                withdrawalPublisherAddress, 
                stakingContract, 
                secondRoot, 
                oldMaxNonce.add(new BN(2)), 
                []
            );

            const third = Utils.keccak256('new withdrawal root 3');
            await Utils.addWithdrawalRoot(
                withdrawalPublisherAddress, 
                stakingContract, 
                third, 
                oldMaxNonce.add(new BN(3)), 
                [firstRoot, secondRoot]
            );
        });

        it("should remove previous roots out of order", async () => {
            const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
            
            const firstRoot = Utils.keccak256('new withdrawal root');
            await Utils.addWithdrawalRoot(
                withdrawalPublisherAddress, 
                stakingContract, 
                firstRoot, 
                oldMaxNonce.add(new BN(1)), 
                []
            );

            const secondRoot = Utils.keccak256('new withdrawal root 2');
            await Utils.addWithdrawalRoot(
                withdrawalPublisherAddress, 
                stakingContract, 
                secondRoot, 
                oldMaxNonce.add(new BN(2)), 
                []
            );

            const third = Utils.keccak256('new withdrawal root 3');
            await Utils.addWithdrawalRoot(
                withdrawalPublisherAddress, 
                stakingContract, 
                third, 
                oldMaxNonce.add(new BN(3)), 
                [secondRoot, firstRoot]
            );
        });
    });

    describe("permissions", () => {
        it("should allow owner to add a new root", async () => {
            const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
            const rootToSet = Utils.keccak256('new withdrawal root');

            await Utils.addWithdrawalRoot(
                owner, 
                stakingContract, 
                rootToSet, 
                oldMaxNonce.add(new BN(1)), 
                []
            );
        });

        it("should disallow non-owner non-withdrawalPublisher to add a new root", async () => {
            const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
            const rootToSet = Utils.keccak256('new withdrawal root');

            try {
                await Utils.addWithdrawalRoot(
                    owner, 
                    stakingContract, 
                    rootToSet, 
                    oldMaxNonce.add(new BN(1)), 
                    []
                );
            } catch(e) {
                assert(
                    e.message.includes("Only the owner and withdrawal publisher can add and replace withdrawal root hashes"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("constraints", () => {
        it("should require new root to be 1 greater than last root", async () => {
            const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
            const rootToSet = Utils.keccak256('new withdrawal root');

            try {
                await Utils.addWithdrawalRoot(
                    owner, 
                    stakingContract, 
                    rootToSet, 
                    oldMaxNonce.add(new BN(2)), 
                    []
                );
            } catch(e) {
                assert(
                    e.message.includes("Nonce must be exactly max nonce + 1"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("should not allow the same root to be pulbished twice", async () => {
            const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
            const rootToSet = Utils.keccak256('new withdrawal root');
            await Utils.addWithdrawalRoot(
                owner, 
                stakingContract, 
                rootToSet, 
                oldMaxNonce.add(new BN(1)), 
                []
            );

            try {
                await Utils.addWithdrawalRoot(
                    owner, 
                    stakingContract, 
                    rootToSet, 
                    oldMaxNonce.add(new BN(2)), 
                    []
                );
            } catch(e) {
                assert(
                    e.message.includes("Root already exists and is associated with a different nonce"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("should not allow a 0 root to be added", async () => {
            const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
            const rootToSet = Utils.getEmptyBytes32();

            try {
                await Utils.addWithdrawalRoot(
                    withdrawalPublisherAddress, 
                    stakingContract, 
                    rootToSet, 
                    oldMaxNonce.add(new BN(1)), 
                    []
                );
            } catch(e) {
                assert(
                    e.message.includes("Added root may not be 0"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });
});