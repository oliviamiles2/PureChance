import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { PureChance, PureChance__factory } from "../types";

type Signers = {
  player: HardhatEthersSigner;
  friend: HardhatEthersSigner;
};

async function encryptPicks(contractAddress: string, signer: HardhatEthersSigner, first: number, second: number) {
  return fhevm.createEncryptedInput(contractAddress, signer.address).add8(first).add8(second).encrypt();
}

describe("PureChance", function () {
  let signers: Signers;
  let pureChance: PureChance;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { player: ethSigners[0], friend: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    const factory = (await ethers.getContractFactory("PureChance")) as PureChance__factory;
    pureChance = (await factory.deploy()) as PureChance;
    contractAddress = await pureChance.getAddress();
  });

  it("stores the encrypted ticket and initializes score", async function () {
    const encrypted = await encryptPicks(contractAddress, signers.player, 5, 7);

    await pureChance
      .connect(signers.player)
      .buyTicket(encrypted.handles[0], encrypted.handles[1], encrypted.inputProof, {
        value: ethers.parseEther("0.001"),
      });

    const [encFirst, encSecond, active] = await pureChance.getTicket(signers.player.address);
    expect(active).to.eq(true);

    const first = await fhevm.userDecryptEuint(FhevmType.euint8, encFirst, contractAddress, signers.player);
    const second = await fhevm.userDecryptEuint(FhevmType.euint8, encSecond, contractAddress, signers.player);

    expect(first).to.eq(5);
    expect(second).to.eq(7);

    const scoreHandle = await pureChance.getEncryptedScore(signers.player.address);
    const score = await fhevm.userDecryptEuint(FhevmType.euint32, scoreHandle, contractAddress, signers.player);
    expect(score).to.eq(0);
  });

  it("runs a draw and updates encrypted score", async function () {
    const encrypted = await encryptPicks(contractAddress, signers.player, 2, 3);
    await pureChance
      .connect(signers.player)
      .buyTicket(encrypted.handles[0], encrypted.handles[1], encrypted.inputProof, {
        value: ethers.parseEther("0.001"),
      });

    const tx = await pureChance.connect(signers.player).startDraw();
    await tx.wait();

    const [encDrawA, encDrawB, encReward, blockNumber] = await pureChance.getLastDraw(signers.player.address);
    expect(blockNumber).to.be.gt(0);

    const reward = await fhevm.userDecryptEuint(FhevmType.euint32, encReward, contractAddress, signers.player);
    const drawA = await fhevm.userDecryptEuint(FhevmType.euint8, encDrawA, contractAddress, signers.player);
    const drawB = await fhevm.userDecryptEuint(FhevmType.euint8, encDrawB, contractAddress, signers.player);

    expect([0n, 10n, 100n]).to.include(reward);
    expect(drawA).to.be.gte(1);
    expect(drawA).to.be.lte(9);
    expect(drawB).to.be.gte(1);
    expect(drawB).to.be.lte(9);

    const scoreHandle = await pureChance.getEncryptedScore(signers.player.address);
    const score = await fhevm.userDecryptEuint(FhevmType.euint32, scoreHandle, contractAddress, signers.player);
    expect(score).to.eq(reward);

    const [, , activeAfterDraw] = await pureChance.getTicket(signers.player.address);
    expect(activeAfterDraw).to.eq(false);
  });
});
