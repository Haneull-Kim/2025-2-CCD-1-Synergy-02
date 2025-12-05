import { useEffect, useRef } from 'react';
import { AxiosRequestConfig, CancelTokenSource } from 'axios';
import axios from 'axios';

/**
 * API 요청 취소를 관리하는 커스텀 훅
 * 화면 전환 시 자동으로 요청을 취소하여 메모리 누수와 불필요한 응답 처리 방지
 * 
 * 사용 예시:
 * ```tsx
 * const { cancelToken, cancelAll } = useApiRequest();
 * 
 * const response = await api.post('/endpoint', data, {
 *   cancelToken: cancelToken.token
 * });
 * ```
 */
export const useApiRequest = () => {
  const cancelTokenSourcesRef = useRef<CancelTokenSource[]>([]);

  // 새로운 취소 토큰 생성
  const createCancelToken = (): CancelTokenSource => {
    const source = axios.CancelToken.source();
    cancelTokenSourcesRef.current.push(source);
    return source;
  };

  // 모든 요청 취소
  const cancelAll = () => {
    cancelTokenSourcesRef.current.forEach((source) => {
      try {
        source.cancel('화면 전환으로 인한 요청 취소');
      } catch (error) {
        // 이미 취소된 토큰은 무시
      }
    });
    cancelTokenSourcesRef.current = [];
  };

  // 컴포넌트 언마운트 시 모든 요청 취소
  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, []);

  return {
    createCancelToken,
    cancelAll,
    // 편의를 위한 바로 사용 가능한 cancelToken
    get cancelToken() {
      return createCancelToken();
    },
  };
};


