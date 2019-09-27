const Utils = require("./utils");

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - resetFallbackMechanismDate", accounts => {
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
        it("should reset fallback date", async () => {
            await Utils.resetFallbackMechanismDate(fallbackPublisherAddress, stakingContract);
        });
    });

    describe("permissions", () => {
        it("should allow owner to reset fallback date", async () => {
            await Utils.resetFallbackMechanismDate(owner, stakingContract);
        });

        it("should disallow non-owner non-fallbackPublisher to reset fallback date", async () => {
            try {
                await Utils.resetFallbackMechanismDate(withdrawalPublisherAddress, stakingContract);
            } catch(e) {
                assert(
                    e.message.includes("Only the owner and fallback publisher can reset fallback mechanism date"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
        });
    });
});