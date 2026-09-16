const hre = require("hardhat");

async function main() {
  const Factory = await hre.ethers.getContractFactory("FreelanceDAO");
  const dao = await Factory.deploy();
  await dao.waitForDeployment();
  console.log("FreelanceDAO", await dao.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
