const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FreelanceDAO", function () {
  async function deploy() {
    const [client, freelancer, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FreelanceDAO");
    const dao = await Factory.deploy();
    await dao.waitForDeployment();
    return { dao, client, freelancer, other };
  }

  it("creates a funded project", async function () {
    const { dao, client, freelancer } = await deploy();
    await dao.connect(client).createProject(freelancer.address, {
      value: ethers.parseEther("1"),
    });
    const project = await dao.projects(0);
    expect(project.client).to.equal(client.address);
    expect(project.freelancer).to.equal(freelancer.address);
    expect(project.amount).to.equal(ethers.parseEther("1"));
    expect(await dao.nextProjectId()).to.equal(1n);
  });

  it("releases escrow after freelancer completes and client confirms", async function () {
    const { dao, client, freelancer } = await deploy();
    await dao.connect(client).createProject(freelancer.address, {
      value: ethers.parseEther("0.5"),
    });
    await dao.connect(freelancer).markAsCompleted(0);
    const before = await ethers.provider.getBalance(freelancer.address);
    const tx = await dao.connect(client).confirmCompletion(0);
    await tx.wait();
    const after = await ethers.provider.getBalance(freelancer.address);
    expect(after - before).to.equal(ethers.parseEther("0.5"));
  });

  it("rejects completion from non-freelancer", async function () {
    const { dao, client, freelancer, other } = await deploy();
    await dao.connect(client).createProject(freelancer.address, {
      value: ethers.parseEther("0.1"),
    });
    await expect(dao.connect(other).markAsCompleted(0)).to.be.reverted;
  });
});
