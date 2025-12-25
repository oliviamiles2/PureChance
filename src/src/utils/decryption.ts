import { JsonRpcSigner } from 'ethers';

export async function userDecryptHandles(
  instance: any,
  signer: JsonRpcSigner,
  userAddress: string,
  contractAddress: string,
  handles: string[],
) {
  const keypair = instance.generateKeypair();
  const contractAddresses = [contractAddress];
  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = "7";

  const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );

  const handleContractPairs = handles.map((handle) => ({
    handle,
    contractAddress,
  }));

  return instance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace("0x", ""),
    contractAddresses,
    userAddress,
    startTimeStamp,
    durationDays,
  );
}
