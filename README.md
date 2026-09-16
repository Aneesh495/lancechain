# lancechain

Hardhat escrow contracts plus a minimal wallet console (ethers v6).

```bash
cd services/contracts && npm install && npx hardhat test
npx hardhat node
# other terminal
npx hardhat run scripts/deploy.js --network localhost
```

```bash
cd apps/web && cp .env.example .env
npm install && npm start
```

Set `REACT_APP_FREELANCE_DAO_ADDRESS` to the deploy output.

`services/contracts/` · Solidity · `apps/web/` · console
