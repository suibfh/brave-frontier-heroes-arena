import { NextRequest, NextResponse } from 'next/server';

// インメモリキャッシュ（同一実行環境が再利用された場合の補助）
const metadataCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 604800000; // 7日間

// NFTメタデータは基本不変のため、CDN側に24時間キャッシュさせる
const CDN_CACHE_HEADERS = {
  'Vercel-CDN-Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
  'Cache-Control': 's-maxage=604800, stale-while-revalidate=2592000',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  // インメモリキャッシュチェック（補助）
  const cached = metadataCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, { headers: CDN_CACHE_HEADERS });
  }

  try {
    const url = `https://core.bravefrontierheroes.com/metadata/spheres/${id}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata from BFH: ${response.statusText}`);
    }

    const data = await response.json();

    metadataCache.set(id, { data, timestamp: Date.now() });

    return NextResponse.json(data, { headers: CDN_CACHE_HEADERS });
  } catch (error) {
    console.error(`Error fetching metadata for sphere ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch sphere metadata' },
      { status: 500 }
    );
  }
}
