import rawBRE from 'hardhat';
import { Signer, ethers } from 'ethers';
import { getEthersSigners } from '../helpers/contracts-helpers';
import { initializeMakeSuite } from './helpers/make-suite';
import { deployMintableErc20, deployATokenMock } from '../helpers/contracts-accessors';
import { waitForTx } from '../helpers/misc-utils';
import { MintableErc20 } from '../types/MintableErc20';
import { testDeployIncentivesController } from './helpers/deploy';
import {
  StakedAaveV3,
  StakedAaveV3Factory,
  StakedTokenIncentivesControllerFactory,
} from '../types';

const topUpWalletsWithAave = async (
  wallets: Signer[],
  aaveToken: MintableErc20,
  amount: string
) => {
  for (const wallet of wallets) {
    await waitForTx(await aaveToken.connect(wallet).mint(amount));
  }
};

const buildTestEnv = async (
  deployer: Signer,
  vaultOfRewards: Signer,
  proxyAdmin: Signer,
  restWallets: Signer[]
) => {
  console.time('setup');

  const aaveToken = await deployMintableErc20(['Aave', 'aave']);

  await waitForTx(await aaveToken.connect(vaultOfRewards).mint(ethers.utils.parseEther('1000000')));
  await topUpWalletsWithAave(
    [restWallets[0], restWallets[1], restWallets[2], restWallets[3], restWallets[4]],
    aaveToken,
    ethers.utils.parseEther('100').toString()
  );

  const { incentivesProxy, stakeProxy } = await testDeployIncentivesController(
    vaultOfRewards,
    proxyAdmin,
    aaveToken
  );
  await deployATokenMock(incentivesProxy.address, 'aDai');
  await deployATokenMock(incentivesProxy.address, 'aWeth');

  console.timeEnd('setup');

  return {
    aaveToken,
    incentivesController: StakedTokenIncentivesControllerFactory.connect(
      incentivesProxy.address,
      deployer
    ),
    aaveStake: StakedAaveV3Factory.connect(stakeProxy.address, deployer),
  };
};

before(async () => {
  await rawBRE.run('set-DRE');
  const [deployer, proxyAdmin, ...restWallets] = await getEthersSigners();
  const { aaveToken, aaveStake, incentivesController } = await buildTestEnv(
    deployer,
    deployer,
    proxyAdmin,
    restWallets
  );
  await initializeMakeSuite(aaveToken, aaveStake, incentivesController);
  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});
