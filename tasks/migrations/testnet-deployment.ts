import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { eContractid, eEthereumNetwork } from "../../helpers/types";
import {
  getAaveAdminPerNetwork,
  getLendTokenPerNetwork,
} from "../../helpers/constants";
import { checkVerification } from "../../helpers/etherscan-verification";

// Defines a comprehensive task for deploying and initializing the Aave Token and Migrator contracts.
task("deploy:aave-migration", "Deploys and initializes Aave Token and LendMigrator contracts.")
  .addFlag(
    "verify",
    "Verify AaveToken and LendToAaveMigrator contracts on Etherscan."
  )
  .addParam(
    "admin",
    "The address of the Aave Admin used for contract initialization.",
    "", // Default value is empty string, which forces usage of the constant lookup
  )
  .setAction(async ({ verify, admin }, localBRE) => {
    // 1. Setup Environment
    // Run an internal task to set up the environment, if necessary (e.g., setting up accounts).
    const BRE: HardhatRuntimeEnvironment = await localBRE.run("set-bre");
    const network = BRE.network.name as eEthereumNetwork;

    // Retrieve addresses from helper constants or use the provided parameter.
    let aaveAdmin = admin;
    if (!aaveAdmin) {
        aaveAdmin = getAaveAdminPerNetwork(network);
    }
    
    const lendTokenAddress = getLendTokenPerNetwork(network);

    if (!aaveAdmin) {
      // Throw an error if the admin address is still missing for the target network.
      throw Error(
        `The Aave Admin address is missing for network ${network}. Please set it via the --admin parameter.`
      );
    }

    // 2. Pre-Deployment Checks
    // Check if Etherscan credentials are set before deploying to prevent gas loss on failed verification.
    if (verify) {
      checkVerification();
    }

    console.log(`\n--- Starting AAVE Token Migration Deployment on ${network} ---`);
    console.log("AAVE ADMIN:", aaveAdmin);
    console.log("LEND TOKEN:", lendTokenAddress);

    // 3. Deployment Phase
    
    // Deploy Aave Token (Implementation + Proxy)
    console.log(`\nDeploying ${eContractid.AaveToken}...`);
    await BRE.run(`deploy-${eContractid.AaveToken}`, { verify });

    // Deploy LendToAaveMigrator (Implementation + Proxy)
    console.log(`\nDeploying ${eContractid.LendToAaveMigrator}...`);
    await BRE.run(`deploy-${eContractid.LendToAaveMigrator}`, {
      lendTokenAddress,
      verify,
    });

    // 4. Initialization Phase (via Proxy)
    
    // Initialize the AaveToken Proxy
    console.log(`\nInitializing ${eContractid.AaveToken} via proxy...`);
    await BRE.run(`initialize-${eContractid.AaveToken}`, {
      admin: aaveAdmin,
      onlyProxy: true, // Custom flag to indicate only proxy initialization
    });

    // Initialize the LendToAaveMigrator Proxy
    console.log(`Initializing ${eContractid.LendToAaveMigrator} via proxy...`);
    await BRE.run(`initialize-${eContractid.LendToAaveMigrator}`, {
      admin: aaveAdmin,
      onlyProxy: true, // Custom flag to indicate only proxy initialization
    });

    // 5. Completion
    console.log(
      "\n✔️ Finished the deployment and initialization of Aave Token Migration components. ✔️"
    );
  });
