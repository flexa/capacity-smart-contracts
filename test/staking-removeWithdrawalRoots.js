const BN = require('bn.js');
const Utils = require("./utils");

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - removeWithdrawalRoots", accounts => {
    const owner = accounts[0];
    const fallbackPublisherAddress = accounts[1];
    const withdrawalPublisherAddress = accounts[2];
    const immediatelyWithdrawableLimitPublisher = accounts[3];

    let stakingContract;
    let fxcToken;

    let rootOne;
    let rootTwo;

    beforeEach(async () => {
        fxcToken = await LocalFXCToken.new();
        stakingContract = await Staking.new(
            fxcToken.address, 
            fallbackPublisherAddress, 
            withdrawalPublisherAddress,
            immediatelyWithdrawableLimitPublisher
        );

        const oldMaxNonce = await stakingContract._maxWithdrawalRootNonce();
        rootOne = Utils.keccak256('new withdrawal root');

        await Utils.addWithdrawalRoot(
            withdrawalPublisherAddress, 
            stakingContract, 
            rootOne, 
            oldMaxNonce.add(new BN(1))
        );

        rootTwo = Utils.keccak256('new withdrawal root 2');

        await Utils.addWithdrawalRoot(
            withdrawalPublisherAddress, 
            stakingContract, 
            rootTwo, 
            oldMaxNonce.add(new BN(2))
        );
    });

    describe("execution", () => {
        it("should remove first withdrawal root", async () => {
            await Utils.removeWithdrawalRoots(
                withdrawalPublisherAddress, 
                [rootOne],
                stakingContract
            );
        });

        it("should remove second withdrawal root", async () => {
            await Utils.removeWithdrawalRoots(
                withdrawalPublisherAddress, 
                [rootTwo],
                stakingContract
            );
        });

        it("should remove both withdrawal roots", async () => {
            await Utils.removeWithdrawalRoots(
                withdrawalPublisherAddress, 
                [rootOne, rootTwo],
                stakingContract
            );
        });

        it("should remove both withdrawal roots out of order", async () => {
            await Utils.removeWithdrawalRoots(
                withdrawalPublisherAddress, 
                [rootTwo, rootOne],
                stakingContract
            );
        });
    });

    describe("permissions", () => {
        it("should allow owner to add a new root", async () => {
            await Utils.removeWithdrawalRoots(
                owner, 
                [rootOne],
                stakingContract
            );
        });

        it("should disallow non-owner non-withdrawalPublisher to add a new root", async () => {
            try {
                await Utils.removeWithdrawalRoots(
                    fallbackPublisherAddress, 
                    [rootOne],
                    stakingContract
                );
            } catch(e) {
                assert(
                    e.message.includes("Only the owner and withdrawal publisher can remove withdrawal root hashes"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });
});