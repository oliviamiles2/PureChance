import { useState } from 'react';
import { Contract, parseEther } from 'ethers';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_CONFIGURED } from '../config/contracts';
import { userDecryptHandles } from '../utils/decryption';
import '../styles/Card.css';

type TicketData = readonly [string, string, boolean] | undefined;

type TicketFormProps = {
  address?: string;
  ticketData: TicketData;
  refreshTicket?: () => void;
  refreshScore?: () => void;
  refreshDraw?: () => void;
};

const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function TicketForm({ address, ticketData, refreshTicket, refreshScore, refreshDraw }: TicketFormProps) {
  const { instance, isLoading: zamaLoading } = useZamaInstance();
  const signer = useEthersSigner();

  const [firstPick, setFirstPick] = useState(1);
  const [secondPick, setSecondPick] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [decodedPicks, setDecodedPicks] = useState<[number, number] | null>(null);

  const active = Boolean(ticketData?.[2]);
  const encryptedHandles =
    ticketData && ticketData[0] !== ZERO_HANDLE && ticketData[1] !== ZERO_HANDLE
      ? [ticketData[0] as string, ticketData[1] as string]
      : [];

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      setStatusMessage('Connect your wallet to lock a ticket.');
      return;
    }
    if (!CONTRACT_CONFIGURED) {
      setStatusMessage('Contract address missing. Deploy to Sepolia and refresh the page.');
      return;
    }
    if (!instance) {
      setStatusMessage('Encryption service is still initializing.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const sanitizedFirst = Math.min(Math.max(firstPick, 1), 9);
      const sanitizedSecond = Math.min(Math.max(secondPick, 1), 9);

      const encryptionBuffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      encryptionBuffer.add8(sanitizedFirst);
      encryptionBuffer.add8(sanitizedSecond);
      const encryptedInput = await encryptionBuffer.encrypt();

      const resolvedSigner = await signer;
      if (!resolvedSigner) {
        throw new Error('Wallet signer not available');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);

      const tx = await contract.buyTicket(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof,
        { value: parseEther('0.001') },
      );
      await tx.wait();

      setStatusMessage('Ticket locked in. You can now start a draw.');
      setDecodedPicks(null);
      refreshTicket?.();
      refreshScore?.();
      refreshDraw?.();
    } catch (error) {
      console.error('Failed to buy ticket', error);
      setStatusMessage(error instanceof Error ? error.message : 'Failed to buy ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const decryptTicket = async () => {
    if (!instance || !address || encryptedHandles.length === 0) {
      setStatusMessage('No encrypted ticket to decrypt yet.');
      return;
    }
    if (!CONTRACT_CONFIGURED) {
      setStatusMessage('Contract address missing. Deploy before decrypting.');
      return;
    }
    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setStatusMessage('Connect your wallet to decrypt.');
      return;
    }

    try {
      const decrypted = await userDecryptHandles(
        instance,
        resolvedSigner,
        address,
        CONTRACT_ADDRESS,
        encryptedHandles,
      );

      const first = Number(decrypted[encryptedHandles[0]] || 0);
      const second = Number(decrypted[encryptedHandles[1]] || 0);
      setDecodedPicks([first, second]);
    } catch (error) {
      console.error('Failed to decrypt ticket', error);
      setStatusMessage('Unable to decrypt ticket right now.');
    }
  };

  return (
    <section className="pc-card pc-card--glow">
      <div className="pc-card__header">
        <div>
          <p className="pc-eyebrow">Step 1 · Encrypt your picks</p>
          <h2 className="pc-card__title">Buy a ticket</h2>
        </div>
        <div className="pc-chip">0.001 ETH</div>
      </div>

      <p className="pc-card__copy">
        Choose two numbers between 1 and 9. They are encrypted locally before your transaction leaves the browser.
      </p>

      <form className="pc-form" onSubmit={handlePurchase}>
        <div className="pc-input-row">
          <div className="pc-field">
            <label className="pc-label">First number</label>
            <input
              type="number"
              min={1}
              max={9}
              value={firstPick}
              onChange={(e) => setFirstPick(parseInt(e.target.value) || 1)}
              className="pc-input"
            />
          </div>
          <div className="pc-field">
            <label className="pc-label">Second number</label>
            <input
              type="number"
              min={1}
              max={9}
              value={secondPick}
              onChange={(e) => setSecondPick(parseInt(e.target.value) || 1)}
              className="pc-input"
            />
          </div>
        </div>

        <button
          type="submit"
          className="pc-button pc-button--primary"
          disabled={isSubmitting || zamaLoading || !address || !CONTRACT_CONFIGURED}
        >
          {zamaLoading ? 'Preparing encryption...' : isSubmitting ? 'Submitting...' : 'Buy ticket'}
        </button>
      </form>

      <div className="pc-status">
        <div>
          <p className="pc-meta__label">Ticket status</p>
          <p className="pc-meta__value">{active ? 'Encrypted ticket ready' : 'No active ticket'}</p>
        </div>
        <div>
          <p className="pc-meta__label">Encryption</p>
          <p className="pc-meta__value">{zamaLoading ? 'Initializing...' : 'Ready'}</p>
        </div>
      </div>

      <div className="pc-actions">
        <button
          className="pc-button pc-button--ghost"
          onClick={decryptTicket}
          disabled={!active || encryptedHandles.length === 0 || !CONTRACT_CONFIGURED}
          type="button"
        >
          Decrypt my ticket
        </button>
        {decodedPicks ? (
          <div className="pc-pill pc-pill--success">
            {decodedPicks[0]} & {decodedPicks[1]}
          </div>
        ) : null}
      </div>

      {statusMessage && <p className="pc-hint">{statusMessage}</p>}
    </section>
  );
}
