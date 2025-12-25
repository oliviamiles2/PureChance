import { useAccount, useReadContract } from 'wagmi';
import { Header } from './Header';
import { TicketForm } from './TicketForm';
import { DrawPanel } from './DrawPanel';
import { ScoreCard } from './ScoreCard';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_CONFIGURED } from '../config/contracts';
import '../styles/AppLayout.css';

export function GameApp() {
  const { address, isConnected } = useAccount();

  const ticketQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getTicket',
    args: address ? [address] : undefined,
    query: { enabled: CONTRACT_CONFIGURED && !!address },
  });

  const scoreQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedScore',
    args: address ? [address] : undefined,
    query: { enabled: CONTRACT_CONFIGURED && !!address },
  });

  const drawQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLastDraw',
    args: address ? [address] : undefined,
    query: { enabled: CONTRACT_CONFIGURED && !!address },
  });

  const ticketData = ticketQuery.data as readonly [string, string, boolean] | undefined;
  const drawData = drawQuery.data as readonly [string, string, string, bigint] | undefined;

  return (
    <div className="pc-shell">
      <Header />
      <main className="pc-main">
        <section className="pc-hero">
          <div className="pc-hero__text">
            <div className="pc-pill">Encrypted luck · 0.001 ETH per play</div>
            <h1 className="pc-hero__title">
              Draw two numbers, match to score, <span className="pc-hero__accent">stay private</span>.
            </h1>
            <p className="pc-hero__copy">
              Your picks, draws, and points stay fully encrypted with Zama FHE. Connect, lock in two digits, and let
              the protocol handle the randomness.
            </p>
            <div className="pc-hero__meta">
              <div>
                <p className="pc-meta__label">Status</p>
                <p className="pc-meta__value">{isConnected ? 'Wallet connected' : 'Waiting for wallet'}</p>
              </div>
              <div>
                <p className="pc-meta__label">Network</p>
                <p className="pc-meta__value">Sepolia (FHE ready)</p>
              </div>
              <div>
                <p className="pc-meta__label">Ticket price</p>
                <p className="pc-meta__value">0.001 ETH</p>
              </div>
              <div>
                <p className="pc-meta__label">Contract</p>
                <p className="pc-meta__value">
                  {CONTRACT_CONFIGURED ? 'Address loaded' : 'Awaiting Sepolia deploy'}
                </p>
              </div>
            </div>
          </div>
          <div className="pc-hero__glass">
            <p className="pc-hero__tagline">Encrypted bonus rules</p>
            <ul className="pc-rules">
              <li>Pick two numbers between 1 and 9 (encrypted client-side)</li>
              <li>Start a draw to generate two encrypted random numbers</li>
              <li>1 match = 10 points · 2 matches = 100 points</li>
              <li>Decrypt your score or last draw any time via the relayer</li>
            </ul>
          </div>
        </section>

        <div className="pc-grid">
          <TicketForm
            address={address}
            ticketData={ticketData}
            refreshTicket={ticketQuery.refetch}
            refreshScore={scoreQuery.refetch}
            refreshDraw={drawQuery.refetch}
          />

          <DrawPanel
            address={address}
            ticketData={ticketData}
            drawData={drawData}
            refreshTicket={ticketQuery.refetch}
            refreshScore={scoreQuery.refetch}
            refreshDraw={drawQuery.refetch}
          />

          <ScoreCard
            address={address}
            encryptedScore={scoreQuery.data as string | undefined}
            refreshScore={scoreQuery.refetch}
          />
        </div>
      </main>
    </div>
  );
}
