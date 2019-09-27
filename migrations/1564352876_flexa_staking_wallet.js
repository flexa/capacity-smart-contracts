const Staking = artifacts.require("Staking");
const LocalFXCToken = artifacts.require("LocalFXCToken");

const flexaTestWalletAddress = '0x369CCCb3bF65a6D44C2CE65CAC45Bc02D4052Aa2'
module.exports = async function(deployer, network) {
    if (network === 'test') {
        return;
    }

    console.log(`Deploying to network: ${network}`);
    // Hardcode FXC Token address if live
    if (network === 'live') {
        console.log('Deploying Staking Contract TO MAINNET!.');
        await deployer.deploy(
            Staking,
            '0x4a57E687b9126435a9B19E4A802113e266AdeBde', 
            0, // TODO: Figure out default fallback publisher
            0, // TODO: Figure out default withdrawal publisher
            0, // TODO: Figure out default immediately withdrawable limit publisher
        );

    } else if (network === 'develop') {
        console.log('Deploying Local FXC Token.');
        await deployer.deploy(LocalFXCToken);
        
        console.log('Deploying Staking Contract.');
        await deployer.deploy(
            Staking, 
            LocalFXCToken.address, 
            flexaTestWalletAddress,
            flexaTestWalletAddress,
            flexaTestWalletAddress
        );
    } else if (network === 'rinkeby-fork' || network === 'rinkeby') {
        console.log('Deploying Local FXC Token.');
        await deployer.deploy(LocalFXCToken);

        console.log('Deploying Staking Contract.');
        await deployer.deploy(
            Staking, 
            LocalFXCToken.address, 
            flexaTestWalletAddress, 
            flexaTestWalletAddress,
            flexaTestWalletAddress
        );
    }
};
