import { BridgeClientCredentials } from "hue-sync";
import { access, readFile, writeFile, rm as removeFile } from "fs/promises";

const BridgeClientCredentialsPath = "./client.json";

export const persistNewCredentials = async (data: BridgeClientCredentials) => {
  try {
    await writeFile(BridgeClientCredentialsPath, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

export const getRegisteredCredentials =
  async (): Promise<BridgeClientCredentials | undefined> => {
    try {
      await access(BridgeClientCredentialsPath);

      const clientData = await readFile(BridgeClientCredentialsPath, {
        encoding: "utf8",
      });

      return JSON.parse(clientData) as BridgeClientCredentials;
    } catch {}
  };

export const clearPersistedCredentials = async () => {
  try {
    await access(BridgeClientCredentialsPath);
    await removeFile(BridgeClientCredentialsPath, {});
  } catch {}
};
