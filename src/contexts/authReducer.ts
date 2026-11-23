import type { AuthState, AuthUser } from './AuthContext';

export type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; user: AuthUser; token: string; generation: number }
  | { type: 'LOGIN_FAILURE'; error: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_START'; generation: number }
  | { type: 'REFRESH_SUCCESS'; user: AuthUser; token: string; generation: number }
  | { type: 'REFRESH_FAILURE'; error: string; generation: number }
  | { type: 'SET_USER'; user: AuthUser };

export const initialAuthState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  generation: 0,
};

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.user,
        token: action.token,
        isLoading: false,
        isRefreshing: false,
        error: null,
        generation: action.generation,
      };

    case 'LOGIN_FAILURE':
      return { ...state, isLoading: false, isRefreshing: false, error: action.error };

    case 'LOGOUT':
      // Bump the generation so any in-flight refresh response is discarded.
      return {
        ...initialAuthState,
        generation: state.generation + 1,
      };

    case 'REFRESH_START':
      // Ignore a refresh that was started against an older generation.
      if (action.generation !== state.generation) {
        return state;
      }
      return { ...state, isRefreshing: true };

    case 'REFRESH_SUCCESS':
      // Discard stale responses: logout or account switch bumped the generation.
      if (action.generation !== state.generation) {
        return state;
      }
      return {
        ...state,
        user: action.user,
        token: action.token,
        isRefreshing: false,
        error: null,
      };

    case 'REFRESH_FAILURE':
      if (action.generation !== state.generation) {
        return state;
      }
      return { ...state, isRefreshing: false, error: action.error };

    case 'SET_USER':
      return { ...state, user: action.user };

    default:
      return state;
  }
}
