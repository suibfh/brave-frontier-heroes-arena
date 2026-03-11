import { NextRequest, NextResponse } from 'next/server';

// インメモリキャッシュ
const metadataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1時間

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  // キャッシュチェック
  const cached = metadataCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // スフィアのメタデータURL
    const url = `https://core.bravefrontierheroes.com/metadata/spheres/${id}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata from BFH: ${response.statusText}`);
    }

    const data = await response.json();

    // キャッシュに保存
    metadataCache.set(id, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching metadata for sphere ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch sphere metadata' },
      { status: 500 }
    );
  }
}
