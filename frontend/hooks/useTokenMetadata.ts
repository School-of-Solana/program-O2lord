// hooks/useTokenMetadata.ts
import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';

interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export const useTokenMetadata = (mintAddress: PublicKey | string) => {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const mint = typeof mintAddress === 'string' ? new PublicKey(mintAddress) : mintAddress;
        
        // 1. Check if it's your custom devnet token
        const knownTokens: Record<string, TokenMetadata> = {
          'usDtxPjjZzy4r4TqQN6xFMHDSVwu2WZQSLtJ8fc4wut': { 
            symbol: 'USDT',
            name: 'USDT',
            decimals: 9,
            logoURI: '/tokens/usdt-logo.png' 
          },
          'uSDcct8ttQQE9P2LnKf7enzL6sS4dooJK9EsZHv7zHk': { 
            symbol: 'USDC',
            name: 'Test USD Coin',
            decimals: 9,
            logoURI: '/tokens/usdc-logo.png'
          },
    
        };

        const knownToken = knownTokens[mint.toString()];
        if (knownToken) {
          setMetadata(knownToken);
          return;
        }

        setMetadata({
          symbol: mint.toString().slice(0, 4).toUpperCase(),
          name: 'Unknown Token',
          decimals: 6 // Default to 6 decimals
        });

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch token metadata');
        setMetadata({
          symbol: 'Unknown',
          name: 'Unknown Token',
          decimals: 6
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [mintAddress]);

  return { metadata, loading, error };
};