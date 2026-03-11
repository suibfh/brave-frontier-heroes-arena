import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('bfh_access_token');
  const refreshToken = cookieStore.get('bfh_refresh_token');

  // 注意: Next.jsのcookieStore.get()では、expires情報は取得できない場合が多い（セット時のみ）
  // そのため、アクセストークンがあるかどうか、リフレッシュトークンがあるかどうかを返す
  
  return NextResponse.json({
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    // クライアントサイドでの計算のために、Cookieの存在確認のみ行う
    // 実際の有効期限は、トークンの発行時に別途保存するか、JWTであればデコードして取得する必要があるが、
    // 今回は簡易的にCookieの有無と、リフレッシュ処理のデモを目的とする
  });
}
