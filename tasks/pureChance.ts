import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const TICKET_PRICE = "0.001";

task("task:game-address", "Prints the PureChance address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const pureChance = await deployments.get("PureChance");
  console.log("PureChance address is " + pureChance.address);
});

task("task:buy-ticket", "Buys a ticket with two encrypted picks")
  .addParam("first", "First pick between 1 and 9")
  .addParam("second", "Second pick between 1 and 9")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const first = parseInt(taskArguments.first);
    const second = parseInt(taskArguments.second);
    if (![first, second].every((n) => Number.isInteger(n) && n >= 1 && n <= 9)) {
      throw new Error("Both picks must be integers between 1 and 9");
    }

    const pureChanceDeployment = await deployments.get("PureChance");
    const signer = (await ethers.getSigners())[0];
    const contract = await ethers.getContractAt("PureChance", pureChanceDeployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(pureChanceDeployment.address, signer.address)
      .add8(first)
      .add8(second)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .buyTicket(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof, {
        value: ethers.parseEther(TICKET_PRICE),
      });
    console.log(`Sent buyTicket tx:${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`buyTicket confirmed status=${receipt?.status}`);
  });

task("task:draw", "Starts a draw for the caller and decrypts the result").setAction(
  async function (_taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const pureChanceDeployment = await deployments.get("PureChance");
    const signer = (await ethers.getSigners())[0];
    const contract = await ethers.getContractAt("PureChance", pureChanceDeployment.address);

    const tx = await contract.connect(signer).startDraw();
    console.log(`Sent startDraw tx:${tx.hash}`);
    await tx.wait();

    const [drawFirst, drawSecond, reward] = await _readLastDraw(
      contract,
      pureChanceDeployment.address,
      signer,
      fhevm,
    );
    const score = await _decryptScore(contract, pureChanceDeployment.address, signer, fhevm, ethers);

    console.log(`Draw numbers: ${drawFirst}, ${drawSecond}`);
    console.log(`Reward from draw: ${reward}`);
    console.log(`Updated score: ${score}`);
  },
);

task("task:decrypt-score", "Decrypts the caller score").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { ethers, deployments, fhevm } = hre;
  await fhevm.initializeCLIApi();

  const pureChanceDeployment = await deployments.get("PureChance");
  const signer = (await ethers.getSigners())[0];
  const contract = await ethers.getContractAt("PureChance", pureChanceDeployment.address);

  const score = await _decryptScore(contract, pureChanceDeployment.address, signer, fhevm, ethers);
  console.log(`Encrypted score: ${await contract.getEncryptedScore(signer.address)}`);
  console.log(`Decrypted score: ${score}`);
});

async function _decryptScore(contract: any, address: string, signer: any, fhevm: any, ethers: any) {
  const encryptedScore = await contract.getEncryptedScore(signer.address);
  if (encryptedScore === ethers.ZeroHash) {
    return 0;
  }

  return fhevm.userDecryptEuint(FhevmType.euint32, encryptedScore, address, signer);
}

async function _readLastDraw(contract: any, address: string, signer: any, fhevm: any) {
  const [encA, encB, encReward] = await contract.getLastDraw(signer.address);

  const drawA = await fhevm.userDecryptEuint(FhevmType.euint8, encA, address, signer);
  const drawB = await fhevm.userDecryptEuint(FhevmType.euint8, encB, address, signer);
  const reward = await fhevm.userDecryptEuint(FhevmType.euint32, encReward, address, signer);

  return [drawA, drawB, reward];
}
