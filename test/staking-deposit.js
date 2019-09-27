const BN = require('bn.js');
const Utils = require("./utils");

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - Deposit", accounts => {
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
        it("should deposit successfully", async () => {
            const nonce = await Utils.approveAndDeposit(
                owner, 
                fxcToken, 
                stakingContract,
                100
            );
            
            const pendingDeposit = await stakingContract._nonceToPendingDeposit(nonce);
            assert.equal(
                owner, pendingDeposit.depositor, 
                "Pending Deposit depositor should be owner!"
            );
            assert(
                new BN(100).eq(pendingDeposit.amount),
                "Pending deposit amount should match deposited amount!"
            );
        });
    });

    describe("constraints", () => {
        it("should fail if amount is 0", async () => {
            const nonceBefore = await stakingContract._depositNonce();
            try {
                await stakingContract.deposit(0, {from: owner});
                assert(false, "This should have thrown");
            } catch(e) {
                assert(
                    e.message.includes("Cannot deposit 0"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
            const nonceAfter = await stakingContract._depositNonce();

            assert(
                nonceBefore.eq(nonceAfter), 
                "Nonce should not have increased!"
            );
        });

        it("should fail if transfer is not approved", async () => {
            const nonceBefore = await stakingContract._depositNonce();
            try {
                await stakingContract.deposit(100, {from: owner});
                assert(false, "This should have thrown");
            } catch(e) {
                // Transfer without approval makes the approaved balance go below 0.
                assert(
                    e.message.includes("SafeMath: subtraction overflow"),
                    `Error thrown does not match exepcted error ${e.message}`
                );
            }
            const nonceAfter = await stakingContract._depositNonce();

            assert(
                nonceBefore.eq(nonceAfter), 
                "Nonce should not have increased!"
            );
        });
    })
});