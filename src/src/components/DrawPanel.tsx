import { useState } from 'react';
import { Contract } from 'ethers';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_CONFIGURED } from '../config/contracts';
import { userDecryptHandles } from '../utils/decryption';
import '../styles/Card.css';

type TicketData = readonly [string, string, boolean] | undefined;
type DrawData = readonly [string, string, string, bigint] | undefined;

type DrawPanelProps = {
  address?: string;
  ticketData: TicketData;
  drawData: DrawData;
  refreshTicket?: () => void;
  refreshDraw?: () => void;
  refreshScore?: () => void;
};

const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function DrawPanel({
  address,
  ticketData,
  drawData,
  refreshTicket,
  refreshDraw,
  refreshScore,
}: DrawPanelProps) {
  const { instance } = useZamaInstance();
  const signer = useEthersSigner();

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMessage, setDrawMessage] = useState<string | null>(null);
  const [decryptedResult, setDecryptedResult] = useState<{ drawA: number; drawB: number; reward: number } | null>(null);

  const ticketActive = Boolean(ticketData?.[2]);
  const blockNumber = drawData ? Number(drawData[3]) : 0;
  const hasDrawHandles =
    drawData && drawData[0] !== ZERO_HANDLE && drawData[1] !== ZERO_HANDLE && drawData[2] !== ZERO_HANDLE;

  const startDraw = async () => {
    if (!address) {
      setDrawMessage('Connect your wallet first.');
      return;
    }
    if (!CONTRACT_CONFIGURED) {
      setDrawMessage('Contract address missing. Deploy to Sepolia and refresh.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setDrawMessage('Signer unavailable. Please reconnect.');
      return;
    }

    setIsDrawing(true);
    setDrawMessage(null);
    setDecryptedResult(null);

    try {
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.startDraw();
      await tx.wait();

      refreshDraw?.();
      refreshScore?.();
      refreshTicket?.();
      setDrawMessage('Draw completed. Decrypt below to reveal the numbers and reward.');
    } catch (error) {
      console.error('Failed to start draw', error);
      setDrawMessage(error instanceof Error ? error.message : 'Draw failed');
    } finally {
      setIsDrawing(false);
    }
  };

  const decryptLastDraw = async () => {
    if (!instance || !address || !hasDrawHandles || !drawData) {
      setDrawMessage('No draw to decrypt yet.');
      return;
    }
    if (!CONTRACT_CONFIGURED) {
      setDrawMessage('Contract address missing. Deploy before decrypting.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setDrawMessage('Connect your wallet to decrypt.');
      return;
    }

    try {
      const handles = [drawData[0] as string, drawData[1] as string, drawData[2] as string];
      const decrypted = await userDecryptHandles(instance, resolvedSigner, address, CONTRACT_ADDRESS, handles);
      setDecryptedResult({
        drawA: Number(decrypted[handles[0]] || 0),
        drawB: Number(decrypted[handles[1]] || 0),
        reward: Number(decrypted[handles[2]] || 0),
      });
    } catch (error) {
      console.error('Failed to decrypt draw', error);
      setDrawMessage('Unable to decrypt draw right now.');
    }
  };

  return (
    <section className="pc-card">
      <div className="pc-card__header">
        <div>
          <p className="pc-eyebrow">Step 2 · Random reveal</p>
          <h2 className="pc-card__title">Start a draw</h2>
        </div>
        <div className="pc-chip pc-chip--outline">{ticketActive ? 'Ready' : 'Buy a ticket first'}</div>
      </div>

      <p className="pc-card__copy">
        Launch the draw to generate two encrypted random numbers on-chain. Rewards are added to your encrypted score.
      </p>

      <div className="pc-actions">
        <button
          className="pc-button pc-button--primary"
          disabled={!ticketActive || isDrawing || !CONTRACT_CONFIGURED}
          onClick={startDraw}
          type="button"
        >
          {isDrawing ? 'Drawing...' : 'Start draw'}
        </button>
        <button
          className="pc-button pc-button--ghost"
          disabled={!hasDrawHandles || !CONTRACT_CONFIGURED}
          onClick={decryptLastDraw}
          type="button"
        >
          Decrypt last draw
        </button>
      </div>

      <div className="pc-status">
        <div>
          <p className="pc-meta__label">Last draw block</p>
          <p className="pc-meta__value">{blockNumber > 0 ? blockNumber : 'Waiting for first draw'}</p>
        </div>
        <div>
          <p className="pc-meta__label">Encrypted reward</p>
          <p className="pc-meta__value">
            {hasDrawHandles ? `${(drawData?.[2] as string).slice(0, 10)}...` : 'Not available yet'}
          </p>
        </div>
      </div>

      {decryptedResult ? (
        <div className="pc-highlight">
          <p className="pc-highlight__label">Latest reveal</p>
          <p className="pc-highlight__value">
            Numbers: {decryptedResult.drawA} & {decryptedResult.drawB} · Reward: {decryptedResult.reward}
          </p>
        </div>
      ) : null}

      {drawMessage && <p className="pc-hint">{drawMessage}</p>}
    </section>
  );
}
