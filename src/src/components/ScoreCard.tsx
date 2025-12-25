import { useState } from 'react';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_CONFIGURED } from '../config/contracts';
import { userDecryptHandles } from '../utils/decryption';
import '../styles/Card.css';

type ScoreCardProps = {
  address?: string;
  encryptedScore: string | undefined;
  refreshScore?: () => void;
};

const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function ScoreCard({ address, encryptedScore, refreshScore }: ScoreCardProps) {
  const { instance } = useZamaInstance();
  const signer = useEthersSigner();

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const decryptScore = async () => {
    if (!instance || !address || !encryptedScore || encryptedScore === ZERO_HANDLE) {
      setStatus('No encrypted score yet. Play a round first.');
      return;
    }
    if (!CONTRACT_CONFIGURED) {
      setStatus('Contract address missing. Deploy to Sepolia to decrypt.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setStatus('Connect your wallet to decrypt.');
      return;
    }

    setIsDecrypting(true);
    setStatus(null);

    try {
      const handles = [encryptedScore];
      const decrypted = await userDecryptHandles(instance, resolvedSigner, address, CONTRACT_ADDRESS, handles);
      const clearScore = Number(decrypted[encryptedScore] || 0);
      setScore(clearScore);
      refreshScore?.();
    } catch (error) {
      console.error('Failed to decrypt score', error);
      setStatus('Unable to decrypt right now.');
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <section className="pc-card pc-card--accent">
      <div className="pc-card__header">
        <div>
          <p className="pc-eyebrow">Step 3 · Reveal privately</p>
          <h2 className="pc-card__title">Encrypted score</h2>
        </div>
        <div className="pc-chip pc-chip--outline">Zama relayer</div>
      </div>

      <p className="pc-card__copy">
        Scores never appear in plaintext on-chain. Decrypt locally with your wallet signature whenever you want to view
        your total.
      </p>

      <div className="pc-status">
        <div>
          <p className="pc-meta__label">Encrypted handle</p>
          <p className="pc-meta__value pc-handle">
            {encryptedScore && encryptedScore !== ZERO_HANDLE ? `${encryptedScore.slice(0, 12)}...` : 'Not ready'}
          </p>
        </div>
        <div>
          <p className="pc-meta__label">Current score</p>
          <p className="pc-meta__value pc-highlight__value">{score !== null ? `${score} pts` : 'Decrypt to view'}</p>
        </div>
      </div>

      <div className="pc-actions">
        <button
          className="pc-button pc-button--primary"
          onClick={decryptScore}
          disabled={isDecrypting || !CONTRACT_CONFIGURED}
        >
          {isDecrypting ? 'Decrypting...' : 'Decrypt my score'}
        </button>
      </div>

      {status && <p className="pc-hint">{status}</p>}
    </section>
  );
}
