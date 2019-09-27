const BN = require('bn.js');
const Utils = require("./utils");

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - modifyImmediatelyWithdrawableLimit", accounts => {
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
        it("should add to immediately withdrawable limit", async () => {
            await Utils.modifyImmediatelyWithdrawableLimit(
                immediatelyWithdrawableLimitPublisher,
                new BN(10),
                stakingContract
            );
        });

        it("should subtract from immediately withdrawable limit", async () => {
            await Utils.modifyImmediatelyWithdrawableLimit(
                immediatelyWithdrawableLimitPublisher,
                new BN(-10),
                stakingContract
            );
        });
    });

    describe("permissions", () => {
        it("should allow owner to update immediately withdrawable limit", async () => {
            await Utils.modifyImmediatelyWithdrawableLimit(
                owner,
                new BN(-10),
                stakingContract
            );
        });

        it("should fail update if not publisher or owner", async () => {
            try {
                await Utils.modifyImmediatelyWithdrawableLimit(
                    accounts[1],
                    new BN(-10),
                    stakingContract
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Only the immediately withdrawable limit publisher and owner can modify the immediately withdrawable limit"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });

    describe("constraints", () => {
        it("should not allow underflow", async () => {
            const oldLimit = await stakingContract._immediatelyWithdrawableLimit();
            const modifyValue = oldLimit.neg().sub(new BN(1))
            try {
                await Utils.modifyImmediatelyWithdrawableLimit(
                    immediatelyWithdrawableLimitPublisher,
                    modifyValue,
                    stakingContract
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("SafeMath: subtraction overflow"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });

        it("should not allow overflow", async () => {
            const modifyValue = (new BN(2)).pow(new BN(255)).sub(new BN(1))
            await Utils.modifyImmediatelyWithdrawableLimit(
                immediatelyWithdrawableLimitPublisher,
                modifyValue,
                stakingContract
            );
            try {
                await Utils.modifyImmediatelyWithdrawableLimit(
                    immediatelyWithdrawableLimitPublisher,
                    modifyValue,
                    stakingContract
                );
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("SafeMath: addition overflow"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });
});