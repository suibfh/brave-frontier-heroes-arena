/**
 * 環境変数の一元管理
 * デフォルト値を設定し、環境変数がない場合でも動作するようにする
 */

// API エンドポイント
export const BFH_API_BASE_URL = process.env.NEXT_PUBLIC_BFH_API_BASE_URL || 'https://api.bravefrontierheroes.com';
export const BFH_AUTH_URL = process.env.NEXT_PUBLIC_BFH_AUTH_URL || 'https://auth.bravefrontierheroes.com/oauth2/auth';
export const BFH_TOKEN_URL = process.env.NEXT_PUBLIC_BFH_TOKEN_URL || 'https://auth.bravefrontierheroes.com/oauth2/token';

// OAuth2 クライアント設定
export const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID;
export const CLIENT_SECRET = process.env.CLIENT_SECRET;
