import { NextRequest, NextResponse } from 'next/server';

// インメモリキャッシュ（同一実行環境が再利用された場合の補助）
const metadataCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1時間

// NFTメタデータは基本不変のため、CDN側に24時間キャッシュさせる
// Vercel-CDN-Cache-Control: Vercel CDN エッジ向け
// Cache-Control s-maxage: 他のCDN・プロキシ向け
// stale-while-revalidate: キャッシュ期限切れ後も古い値を返しつつバックグラウンドで更新
const CDN_CACHE_HEADERS = {
  'Vercel-CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  // インメモリキャッシュチェック（再利用された実行環境での補助）
  const cached = metadataCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data, { headers: CDN_CACHE_HEADERS });
  }

  try {
    const url = `https://core.bravefrontierheroes.com/metadata/units/${id}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata from BFH: ${response.statusText}`);
    }

    const data = await response.json();

    // インメモリキャッシュに保存
    metadataCache.set(id, { data, timestamp: Date.now() });

    return NextResponse.json(data, { headers: CDN_CACHE_HEADERS });
  } catch (error) {
    console.error(`Error fetching metadata for hero ${id}:`, error);
    // エラー時はキャッシュさせない
    return NextResponse.json(
      { error: 'Failed to fetch hero metadata' },
      { status: 500 }
    );
  }
}
