# PharmaChain: Blockchain-Based Pharmaceutical Provenance Tracking

## Overview

PharmaChain is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It addresses the critical issue of counterfeit pharmaceuticals by tokenizing each pill pack as a unique serialized NFT (Non-Fungible Token). These NFTs store immutable provenance data, allowing stakeholders—manufacturers, distributors, pharmacies, and consumers—to scan a QR code or NFC tag on the pack to verify its authenticity and trace its journey through the supply chain. 

By leveraging blockchain's transparency and immutability, PharmaChain solves real-world problems such as:
- **Counterfeit Drugs**: The WHO estimates that 10% of medicines in low- and middle-income countries are substandard or falsified, leading to health risks and economic losses.
- **Supply Chain Opacity**: Traditional systems lack real-time visibility, making it hard to detect tampering, recalls, or diversions.
- **Regulatory Compliance**: Ensures adherence to standards like DSCSA (Drug Supply Chain Security Act) by providing auditable trails.
- **Consumer Trust**: Empowers end-users to verify product legitimacy via a simple scan, reducing fraud in global pharma markets.

The system involves 6 core smart contracts written in Clarity, ensuring secure, decentralized operations without reliance on centralized databases.

## Features

- **Tokenization**: Each pill pack is minted as an NFT with metadata including batch ID, manufacturing date, expiration, and provenance history.
- **Provenance Tracking**: Immutable logs of transfers from manufacturer to distributor, pharmacy, and consumer.
- **Verification Scanning**: Public functions allow anyone to query an NFT's history via a token ID (scanned from physical pack).
- **Role-Based Access**: Manufacturers mint tokens, distributors transfer ownership, and auditors view logs.
- **Batch Management**: Handle large-scale production and recalls efficiently.
- **Auditability**: All actions are logged on-chain for compliance and dispute resolution.

## Architecture

PharmaChain's smart contracts interact as follows:
1. **ManufacturerRegistry**: Registers and verifies manufacturers.
2. **PillNFT**: Core NFT contract for minting and managing pill pack tokens.
3. **SupplyChainTracker**: Tracks ownership transfers and updates provenance.
4. **BatchManager**: Handles batch creation and association with individual tokens.
5. **VerificationOracle**: Provides public verification functions for scans.
6. **AuditLog**: Maintains an immutable event log for all actions.

These contracts are deployed on the Stacks blockchain, which settles on Bitcoin for added security. Front-end apps (e.g., web/mobile) can integrate via Hiro Wallet or Leather for user interactions.

### Smart Contracts Details

All contracts are written in Clarity, a decidable language that prevents reentrancy and ensures predictable execution.

#### 1. ManufacturerRegistry.clar
- **Purpose**: Manages registration of authorized manufacturers to prevent unauthorized minting.
- **Key Functions**:
  - `register-manufacturer (principal: principal, name: (string-ascii 50))`: Registers a manufacturer (only callable by contract owner or admin).
  - `is-registered (principal: principal)`: Checks if a principal is a registered manufacturer.
  - `revoke-manufacturer (principal: principal)`: Revokes registration (admin only).
- **Data Maps**:
  - `manufacturers`: Maps principals to registration details (e.g., name, registration timestamp).
- **Traits/Interfaces**: Implements a simple registry trait for integration with other contracts.

#### 2. PillNFT.clar
- **Purpose**: Defines the NFT standard for individual pill packs, based on SIP-009 (Stacks Improvement Proposal for NFTs).
- **Key Functions**:
  - `mint (token-id: uint, recipient: principal, metadata: (tuple (batch-id uint) (mfg-date uint) (exp-date uint) (serial (string-ascii 32))))`: Mints a new NFT (only by registered manufacturers).
  - `transfer (token-id: uint, sender: principal, recipient: principal)`: Transfers ownership (updates in SupplyChainTracker).
  - `get-metadata (token-id: uint)`: Retrieves token metadata.
  - `burn (token-id: uint)`: Burns a token (e.g., for recalls).
- **Data Maps**:
  - `token-metadata`: Maps token IDs to metadata tuples.
  - `owners`: Maps token IDs to current owners.
- **Traits/Interfaces**: Implements SIP-009 NFT trait.

#### 3. SupplyChainTracker.clar
- **Purpose**: Tracks the provenance chain by logging transfers and ownership changes.
- **Key Functions**:
  - `record-transfer (token-id: uint, from: principal, to: principal, timestamp: uint)`: Logs a transfer (called by PillNFT during transfers).
  - `get-provenance (token-id: uint)`: Returns the full history list for a token.
  - `validate-chain (token-id: uint)`: Verifies if the chain is intact (no unauthorized jumps).
- **Data Maps**:
  - `provenance-history`: Maps token IDs to lists of transfer tuples (from, to, timestamp, role).
- **Traits/Interfaces**: Uses a tracker trait to hook into NFT transfers.

#### 4. BatchManager.clar
- **Purpose**: Manages batches of pill packs for efficient large-scale operations, like minting multiples or recalls.
- **Key Functions**:
  - `create-batch (batch-id: uint, manufacturer: principal, size: uint, mfg-date: uint, exp-date: uint)`: Creates a new batch (manufacturer only).
  - `associate-token-to-batch (token-id: uint, batch-id: uint)`: Links an NFT to a batch.
  - `recall-batch (batch-id: uint)`: Marks all tokens in a batch as recalled (triggers burns if needed).
  - `get-batch-tokens (batch-id: uint)`: Lists all token IDs in a batch.
- **Data Maps**:
  - `batches`: Maps batch IDs to details (manufacturer, size, dates, status).
  - `batch-tokens`: Maps batch IDs to lists of token IDs.
- **Traits/Interfaces**: Integrates with PillNFT for batch minting.

#### 5. VerificationOracle.clar
- **Purpose**: Provides public endpoints for scanning and verifying pill packs without needing wallet interaction.
- **Key Functions**:
  - `verify-token (token-id: uint)`: Returns provenance, metadata, and validity status (e.g., not recalled, chain intact).
  - `scan-and-validate (token-id: uint, scanner: principal)`: Logs a scan event and returns verification (publicly callable).
  - `get-validity-status (token-id: uint)`: Quick check for active/recalled/tampered.
- **Data Maps**:
  - `scan-logs`: Maps token IDs to lists of scan events (scanner, timestamp).
- **Traits/Interfaces**: Read-only trait for external apps.

#### 6. AuditLog.clar
- **Purpose**: Centralizes logging of all events for auditing and compliance reporting.
- **Key Functions**:
  - `log-event (event-type: (string-ascii 20), token-id: (optional uint), details: (string-utf8 256))`: Logs an event (called by other contracts).
  - `get-logs-by-token (token-id: uint)`: Retrieves logs for a specific token.
  - `get-global-logs (start: uint, end: uint)`: Paginated global log access (admin or public with limits).
- **Data Maps**:
  - `events`: A list of all events (appended only, immutable).
  - `token-events`: Maps token IDs to event indices.
- **Traits/Interfaces**: Event emitter trait used by all other contracts.

## How It Works

1. **Minting**: A registered manufacturer creates a batch and mints NFTs for each pill pack, embedding metadata.
2. **Transfer**: As the pack moves (e.g., to distributor), ownership is transferred via PillNFT, logging in SupplyChainTracker and AuditLog.
3. **Scanning**: Consumers or stakeholders scan a QR code linked to the token ID, calling VerificationOracle to check provenance.
4. **Recall/Compliance**: If issues arise, batches can be recalled, invalidating tokens.
5. **Integration**: Mobile apps scan QR/NFC, query the blockchain via Stacks API, and display results.

## Installation and Deployment

### Prerequisites
- Stacks CLI (Clarinet) for local development.
- Hiro Wallet for testnet/mainnet interactions.
- Node.js for any front-end (optional).

### Steps
1. Clone the repo: `git clone <repo-url>`
2. Install Clarinet: Follow [Stacks docs](https://docs.stacks.co/clarity).
3. Run local devnet: `clarinet integrate`
4. Deploy contracts: Use Clarinet to deploy to testnet, then mainnet.
5. Test: Use provided test scripts in `/tests` folder.

## Testing

- Unit tests for each contract in `/contracts/tests`.
- Integration tests simulate full supply chain flows.
- Coverage: Aim for 90%+ using Clarinet's testing tools.

## Security Considerations

- Clarity's decidability prevents common vulnerabilities like reentrancy.
- Only registered principals can mint/transfer.
- All data is public but tamper-proof.
- Audit recommended before mainnet deployment.

## Contributing

Fork the repo, create a branch, and submit PRs. Follow Clarity best practices.

## License

MIT License. See LICENSE file for details.