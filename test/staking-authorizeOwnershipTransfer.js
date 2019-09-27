const truffleAssert = require('truffle-assertions');

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - authorizeOwnershipTransfer", accounts => {
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

    it("should authorize new owner", async () => {
        const currentOwner = await stakingContract._owner();
        const authorizedNewOwner = await stakingContract._authorizedNewOwner();

        const receipt = await stakingContract.authorizeOwnershipTransfer(accounts[3]);

        truffleAssert.eventEmitted(receipt, 'OwnershipTransferAuthorization', (ev) => {
            return ev.authorizedAddress === accounts[3];
        });

        const ownerAfter = await stakingContract._owner();
        assert.equal(currentOwner, ownerAfter, 'Owner should not be updated!');

        const authorizedNewOwnerAfter = await stakingContract._authorizedNewOwner();
        assert.notEqual(authorizedNewOwner, authorizedNewOwnerAfter, 'Authorized new owner should have been updated!');
        assert.equal(authorizedNewOwnerAfter, accounts[3], "Authorized new owner does not match account it was updated to!");
    });

    it("should fail update if not owner", async () => {
        try {
            await stakingContract.authorizeOwnershipTransfer(accounts[3], {from: accounts[1]});
            assert(false, "This should have thrown");
        } catch(e) {
            assert(
                e.message.includes("Only the owner can authorize a new address to become owner"),
                `Error thrown does not match exepcted error ${e.message}`
            );
        }
    });
})