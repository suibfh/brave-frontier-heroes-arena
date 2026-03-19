import { NextRequest, NextResponse } from 'next/server';

const OASYS_RPC     = 'https://rpc.mainnet.oasys.games';
const BFHA_CONTRACT = '0x1C37B502c1F29CdEb4D242DF0316E4dA76551d06';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// インメモリキャッシュ（24時間）
const cache = new Map<string, { data: BFHAResponse; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

const CDN_CACHE_HEADERS = {
  'Vercel-CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
};

interface NFTMeta {
  tokenId: number;
  name: string;
  image: string;
}

interface BFHAResponse {
  balance: number;
  nfts: NFTMeta[];
}

async function rpcCall(method: string, params: unknown[], id: number) {
  const res = await fetch(OASYS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
  });
  return res.json();
}

function decodeABIString(hex: string): string {
  try {
    const data = hex.startsWith('0x') ? hex.slice(2) : hex;
    const offset = parseInt(data.slice(0, 64), 16) * 2;
    const length = parseInt(data.slice(offset, offset + 64), 16) * 2;
    const bytes = data.slice(offset + 64, offset + 64 + length).match(/.{2}/g)!;
    return new TextDecoder().decode(new Uint8Array(bytes.map(b => parseInt(b, 16))));
  } catch {
    return '';
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  const cacheKey = address.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, { headers: CDN_CACHE_HEADERS });
  }

  try {
    // 1. balanceOf
    const balData = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
    const balRes = await rpcCall('eth_call', [{ to: BFHA_CONTRACT, data: balData }, 'latest'], 1);
    const balance = parseInt(balRes.result, 16);

    if (balance === 0) {
      const result: BFHAResponse = { balance: 0, nfts: [] };
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return NextResponse.json(result, { headers: CDN_CACHE_HEADERS });
    }

    // 2. eth_getLogs でトークンID取得
    const toTopic = '0x000000000000000000000000' + address.slice(2).toLowerCase();
    const logsRes = await rpcCall('eth_getLogs', [{
      address: BFHA_CONTRACT,
      topics: [TRANSFER_TOPIC, null, toTopic],
      fromBlock: '0x1',
      toBlock: 'latest',
    }], 2);

    // 最後のTransferで現在の保有IDを特定（送り出したIDを除外）
    const received = new Map<number, boolean>();
    for (const log of logsRes.result ?? []) {
      const tokenId = parseInt(log.topics[3], 16);
      const from = log.topics[1];
      const to   = log.topics[2];
      const isToMe   = to.toLowerCase().includes(address.slice(2).toLowerCase());
      const isFromMe = from.toLowerCase().includes(address.slice(2).toLowerCase());
      if (isToMe)   received.set(tokenId, true);
      if (isFromMe) received.delete(tokenId);
    }
    const tokenIds = [...received.keys()].slice(0, balance);

    // 3. tokenURI → メタデータ取得
    const nfts: NFTMeta[] = [];
    for (const tokenId of tokenIds) {
      try {
        const uriData = '0xc87b56dd' + tokenId.toString(16).padStart(64, '0');
        const uriRes  = await rpcCall('eth_call', [{ to: BFHA_CONTRACT, data: uriData }, 'latest'], 3 + tokenId);
        const uri     = decodeABIString(uriRes.result);
        if (!uri) continue;

        // メタデータ取得（サーバーサイドなのでCORSなし）
        const metaRes  = await fetch(uri);
        const meta     = await metaRes.json();

        nfts.push({
          tokenId,
          name:  meta.name  ?? `BFHA #${tokenId}`,
          image: meta.image ?? '',
        });
      } catch {
        // 個別NFTの取得失敗はスキップ
      }
    }

    const result: BFHAResponse = { balance, nfts };
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result, { headers: CDN_CACHE_HEADERS });

  } catch (err) {
    console.error('BFHA API error:', err);
    return NextResponse.json({ error: 'Failed to fetch BFHA data' }, { status: 500 });
  }
}
