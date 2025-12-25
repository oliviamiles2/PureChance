import { createConfig, http } from 'wagmi';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { sepolia } from 'wagmi/chains';

const rpcUrl = sepolia.rpcUrls.default.http[0];

export const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(rpcUrl),
  },
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: 'PureChance',
      jsonRpcUrl: rpcUrl,
    }),
  ],
  ssr: false,
});
