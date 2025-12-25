import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="pc-header">
      <div className="pc-header__brand">
        <div className="pc-badge">FHE</div>
        <div>
          <h1 className="pc-header__title">PureChance</h1>
          <p className="pc-header__subtitle">Encrypted double-number lottery on Sepolia</p>
        </div>
      </div>
      <div className="pc-header__actions">
        <ConnectButton />
      </div>
    </header>
  );
}
