import Axios, { AxiosRequestConfig, AxiosError } from 'axios';
import Cookies from 'js-cookie';
import { BFH_API_BASE_URL } from '@/src/config/env';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: BFH_API_BASE_URL,
});

// リクエストインターセプター: アクセストークンを自動で付与
AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = Cookies.get('bfh_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// レスポンスインターセプター: 401エラーでログインページへリダイレクト
AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // トークンが無効または期限切れの場合、Cookieを削除してログインページへ
      Cookies.remove('bfh_access_token');
      if (typeof window !== 'undefined') {
        // Next.jsのクライアントサイドナビゲーションを使用
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
  }).then(({ data }) => data);

  return promise;
};

export default customInstance;
