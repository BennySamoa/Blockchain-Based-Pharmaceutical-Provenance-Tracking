import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, principalCV } from "@stacks/transactions";

const ERR_UNAUTHORIZED = 100;
const ERR_NOT_FOUND = 101;
const ERR_PAUSED = 103;
const ERR_INVALID_BATCH_ID = 104;
const ERR_INVALID_DATE = 105;
const ERR_INVALID_SERIAL = 106;
const ERR_INVALID_COMPOSITION = 107;
const ERR_INVALID_DOSAGE = 108;
const ERR_INVALID_TOKEN_ID = 110;
const ERR_INVALID_URI = 114;
const ERR_MAX_TOKENS_EXCEEDED = 115;

interface Metadata {
  batchId: number;
  mfgDate: number;
  expDate: number;
  serial: string;
  composition: string;
  dosage: string;
  manufacturer: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class PillNFTMock {
  state: {
    lastTokenId: number;
    contractOwner: string;
    mintPaused: boolean;
    baseUri: string;
    minters: Map<string, boolean>;
    tokenMetadata: Map<number, Metadata>;
    owners: Map<number, string>;
    maxTokens: number;
  } = {
    lastTokenId: 0,
    contractOwner: "ST1TEST",
    mintPaused: false,
    baseUri: "https://pharmachain.api/token/",
    minters: new Map(),
    tokenMetadata: new Map(),
    owners: new Map(),
    maxTokens: 1000000,
  };
  caller: string = "ST1TEST";
  events: Array<{ event: string; [key: string]: any }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      lastTokenId: 0,
      contractOwner: "ST1TEST",
      mintPaused: false,
      baseUri: "https://pharmachain.api/token/",
      minters: new Map(),
      tokenMetadata: new Map(),
      owners: new Map(),
      maxTokens: 1000000,
    };
    this.caller = "ST1TEST";
    this.events = [];
  }

  setContractOwner(newOwner: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: false };
    this.state.contractOwner = newOwner;
    return { ok: true, value: true };
  }

  addMinter(newMinter: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: false };
    this.state.minters.set(newMinter, true);
    return { ok: true, value: true };
  }

  removeMinter(minter: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: false };
    this.state.minters.delete(minter);
    return { ok: true, value: true };
  }

  pauseMint(): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: false };
    this.state.mintPaused = true;
    return { ok: true, value: true };
  }

  resumeMint(): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: false };
    this.state.mintPaused = false;
    return { ok: true, value: true };
  }

  setBaseUri(newUri: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: false };
    if (newUri.length === 0) return { ok: false, value: false };
    this.state.baseUri = newUri;
    return { ok: true, value: true };
  }

  setMaxTokens(newMax: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: false };
    if (newMax <= this.state.lastTokenId) return { ok: false, value: false };
    this.state.maxTokens = newMax;
    return { ok: true, value: true };
  }

  mint(
    recipient: string,
    batchId: number,
    mfgDate: number,
    expDate: number,
    serial: string,
    composition: string,
    dosage: string
  ): Result<number> {
    if (this.state.mintPaused) return { ok: false, value: ERR_PAUSED };
    if (!this.state.minters.get(this.caller) && this.caller !== this.state.contractOwner) return { ok: false, value: ERR_UNAUTHORIZED };
    if (this.state.lastTokenId >= this.state.maxTokens) return { ok: false, value: ERR_MAX_TOKENS_EXCEEDED };
    if (batchId <= 0) return { ok: false, value: ERR_INVALID_BATCH_ID };
    if (mfgDate <= 0) return { ok: false, value: ERR_INVALID_DATE };
    if (expDate <= 0) return { ok: false, value: ERR_INVALID_DATE };
    if (serial.length === 0 || serial.length > 32) return { ok: false, value: ERR_INVALID_SERIAL };
    if (composition.length > 256) return { ok: false, value: ERR_INVALID_COMPOSITION };
    if (dosage.length > 50) return { ok: false, value: ERR_INVALID_DOSAGE };

    const newTokenId = this.state.lastTokenId + 1;
    this.state.tokenMetadata.set(newTokenId, {
      batchId,
      mfgDate,
      expDate,
      serial,
      composition,
      dosage,
      manufacturer: this.caller,
    });
    this.state.owners.set(newTokenId, recipient);
    this.state.lastTokenId = newTokenId;
    this.events.push({ event: "mint", tokenId: newTokenId, recipient });
    return { ok: true, value: newTokenId };
  }

  transfer(tokenId: number, sender: string, recipient: string): Result<boolean> {
    if (this.caller !== sender) return { ok: false, value: false };
    const owner = this.state.owners.get(tokenId);
    if (!owner || owner !== sender) return { ok: false, value: false };
    this.state.owners.set(tokenId, recipient);
    this.events.push({ event: "transfer", tokenId, from: sender, to: recipient });
    return { ok: true, value: true };
  }

  burn(tokenId: number): Result<boolean> {
    const owner = this.state.owners.get(tokenId);
    if (!owner) return { ok: false, value: false };
    if (this.caller !== owner) return { ok: false, value: false };
    this.state.tokenMetadata.delete(tokenId);
    this.state.owners.delete(tokenId);
    this.events.push({ event: "burn", tokenId, owner });
    return { ok: true, value: true };
  }

  updateMetadata(tokenId: number, newExpDate: number, newComposition: string, newDosage: string): Result<boolean> {
    const metadata = this.state.tokenMetadata.get(tokenId);
    if (!metadata) return { ok: false, value: false };
    if (this.caller !== metadata.manufacturer) return { ok: false, value: false };
    if (newExpDate <= 0) return { ok: false, value: false };
    if (newComposition.length > 256) return { ok: false, value: false };
    if (newDosage.length > 50) return { ok: false, value: false };
    this.state.tokenMetadata.set(tokenId, {
      ...metadata,
      expDate: newExpDate,
      composition: newComposition,
      dosage: newDosage,
    });
    this.events.push({ event: "metadata-update", tokenId });
    return { ok: true, value: true };
  }

  getMetadata(tokenId: number): Metadata | null {
    return this.state.tokenMetadata.get(tokenId) || null;
  }

  getOwner(tokenId: number): Result<string | null> {
    return { ok: true, value: this.state.owners.get(tokenId) || null };
  }

  getLastTokenId(): Result<number> {
    return { ok: true, value: this.state.lastTokenId };
  }

  getTokenUri(tokenId: number): Result<string> {
    return { ok: true, value: `${this.state.baseUri}${tokenId}` };
  }

  isMintPaused(): Result<boolean> {
    return { ok: true, value: this.state.mintPaused };
  }

  getMaxTokens(): Result<number> {
    return { ok: true, value: this.state.maxTokens };
  }

  getBaseUri(): Result<string> {
    return { ok: true, value: this.state.baseUri };
  }

  getContractOwner(): Result<string> {
    return { ok: true, value: this.state.contractOwner };
  }
}

describe("PillNFT Contract", () => {
  let contract: PillNFTMock;

  beforeEach(() => {
    contract = new PillNFTMock();
    contract.reset();
  });

  it("adds minter successfully", () => {
    const result = contract.addMinter("ST2MINTER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.minters.get("ST2MINTER")).toBe(true);
  });

  it("rejects add minter by non-owner", () => {
    contract.caller = "ST3FAKE";
    const result = contract.addMinter("ST2MINTER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("removes minter successfully", () => {
    contract.addMinter("ST2MINTER");
    const result = contract.removeMinter("ST2MINTER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.minters.has("ST2MINTER")).toBe(false);
  });

  it("pauses and resumes mint", () => {
    let result = contract.pauseMint();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.mintPaused).toBe(true);
    result = contract.resumeMint();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.mintPaused).toBe(false);
  });

  it("sets base uri successfully", () => {
    const result = contract.setBaseUri("https://newuri.com/");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.baseUri).toBe("https://newuri.com/");
  });

  it("rejects invalid base uri", () => {
    const result = contract.setBaseUri("");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets max tokens successfully", () => {
    const result = contract.setMaxTokens(2000000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxTokens).toBe(2000000);
  });

  it("rejects invalid max tokens", () => {
    const result = contract.setMaxTokens(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("mints successfully as owner", () => {
    const result = contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);
    const metadata = contract.getMetadata(1);
    expect(metadata?.batchId).toBe(1);
    expect(metadata?.serial).toBe("SERIAL123");
    expect(contract.state.owners.get(1)).toBe("ST4RECIP");
    expect(contract.events[0].event).toBe("mint");
  });

  it("mints successfully as minter", () => {
    contract.addMinter("ST2MINTER");
    contract.caller = "ST2MINTER";
    const result = contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);
  });

  it("rejects mint when paused", () => {
    contract.pauseMint();
    const result = contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PAUSED);
  });

  it("rejects mint by unauthorized", () => {
    contract.caller = "ST3FAKE";
    const result = contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("rejects mint with invalid batch id", () => {
    const result = contract.mint(
      "ST4RECIP",
      0,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BATCH_ID);
  });

  it("rejects mint with invalid serial", () => {
    const result = contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "",
      "Composition details",
      "10mg"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SERIAL);
  });

  it("transfers successfully", () => {
    contract.mint(
      "ST1TEST",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const result = contract.transfer(1, "ST1TEST", "ST5NEW");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.owners.get(1)).toBe("ST5NEW");
    expect(contract.events[1].event).toBe("transfer");
  });

  it("rejects transfer by non-owner", () => {
    contract.mint(
      "ST1TEST",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    contract.caller = "ST3FAKE";
    const result = contract.transfer(1, "ST3FAKE", "ST5NEW");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("burns successfully", () => {
    contract.mint(
      "ST1TEST",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const result = contract.burn(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.owners.has(1)).toBe(false);
    expect(contract.state.tokenMetadata.has(1)).toBe(false);
    expect(contract.events[1].event).toBe("burn");
  });

  it("rejects burn by non-owner", () => {
    contract.mint(
      "ST1TEST",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    contract.caller = "ST3FAKE";
    const result = contract.burn(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates metadata successfully", () => {
    contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const result = contract.updateMetadata(1, 9876543210, "New composition", "20mg");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const metadata = contract.getMetadata(1);
    expect(metadata?.expDate).toBe(9876543210);
    expect(metadata?.composition).toBe("New composition");
    expect(metadata?.dosage).toBe("20mg");
    expect(contract.events[1].event).toBe("metadata-update");
  });

  it("rejects metadata update by non-manufacturer", () => {
    contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateMetadata(1, 9876543210, "New composition", "20mg");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects metadata update with invalid date", () => {
    contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const result = contract.updateMetadata(1, 0, "New composition", "20mg");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("gets metadata correctly", () => {
    contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const metadata = contract.getMetadata(1);
    expect(metadata?.serial).toBe("SERIAL123");
  });

  it("gets owner correctly", () => {
    contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const result = contract.getOwner(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe("ST4RECIP");
  });

  it("gets last token id correctly", () => {
    contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const result = contract.getLastTokenId();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);
  });

  it("gets token uri correctly", () => {
    contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const result = contract.getTokenUri(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe("https://pharmachain.api/token/1");
  });

  it("gets mint paused status", () => {
    contract.pauseMint();
    const result = contract.isMintPaused();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("gets max tokens", () => {
    const result = contract.getMaxTokens();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1000000);
  });

  it("gets base uri", () => {
    const result = contract.getBaseUri();
    expect(result.ok).toBe(true);
    expect(result.value).toBe("https://pharmachain.api/token/");
  });

  it("gets contract owner", () => {
    const result = contract.getContractOwner();
    expect(result.ok).toBe(true);
    expect(result.value).toBe("ST1TEST");
  });

  it("rejects mint beyond max tokens", () => {
    contract.setMaxTokens(1);
    contract.mint(
      "ST4RECIP",
      1,
      1234567890,
      1234567890,
      "SERIAL123",
      "Composition details",
      "10mg"
    );
    const result = contract.mint(
      "ST4RECIP",
      2,
      1234567890,
      1234567890,
      "SERIAL456",
      "Composition details",
      "10mg"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_TOKENS_EXCEEDED);
  });

  it("sets contract owner successfully", () => {
    const result = contract.setContractOwner("ST6NEWOWNER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.contractOwner).toBe("ST6NEWOWNER");
  });

  it("rejects set contract owner by non-owner", () => {
    contract.caller = "ST3FAKE";
    const result = contract.setContractOwner("ST6NEWOWNER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});