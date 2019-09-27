const Utils = require("./utils");
const truffleAssert = require('truffle-assertions');

const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

contract("Staking - authorizeOwnershipTransfer", accounts => {
    const owner = accounts[0];
    const fallbackPublisherAddress = accounts[1];
    const withdrawalPublisherAddress = accounts[2];
    const immediatelyWithdrawableLimitPublisher = accounts[3];

    const authorized = accounts[5];

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

        await stakingContract.authorizeOwnershipTransfer(authorized);
    });

    it("should assume ownership", async () => {
        const currentOwner = await stakingContract._owner();

        const receipt = await stakingContract.assumeOwnership({from: authorized});

        truffleAssert.eventEmitted(receipt, 'OwnerUpdate', (ev) => {
            return ev.oldValue === currentOwner && 
                ev.newValue === authorized;
        });

        const ownerAfter = await stakingContract._owner();
        assert.notEqual(currentOwner, ownerAfter, 'Owner should be updated!');
        assert.equal(ownerAfter, authorized, "New owner is not authorized new owner!");

        const authorizedNewOwnerAfter = await stakingContract._authorizedNewOwner();
        assert.equal(authorizedNewOwnerAfter, Utils.getNullAddress(), 'Authorized new owner should be null address!');
        
    });

    it("should fail update if not authorized new owner", async () => {
        try {
            await stakingContract.assumeOwnership({from: owner});
            assert(false, "This should have thrown");
        } catch(e) {
            assert(
                e.message.includes("Only the authorized new owner can accept ownership"),
                `Error thrown does not match exepcted error ${e.message}`
            );
        }
    });
})