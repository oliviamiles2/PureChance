import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (hre.network.name === "sepolia" && (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === "")) {
    throw new Error("PRIVATE_KEY is required in .env to deploy on sepolia");
  }

  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedPureChance = await deploy("PureChance", {
    from: deployer,
    log: true,
  });

  console.log(`PureChance contract: `, deployedPureChance.address);
};
export default func;
func.id = "deploy_pureChance"; // id required to prevent reexecution
func.tags = ["PureChance"];
