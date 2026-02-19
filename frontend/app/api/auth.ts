import api from './client';
import type { User, AuthTokens, LoginRequest, RegisterRequest } from '@/types';

function _b64urlToBuffer(b64url: string): ArrayBuffer {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function _bufferToB64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const authAPI = {
  register: async (data: RegisterRequest): Promise<AuthTokens> => {
    const response = await api.post('/auth/register', data);
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
    }
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthTokens> => {
    const response = await api.post('/auth/login', data);
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
    }
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data: { full_name?: string; preferred_language?: string }): Promise<User> => {
    const response = await api.put('/auth/me', data);
    return response.data;
  },

  changePassword: async (data: { current_password: string; new_password: string }): Promise<{ message: string }> => {
    const response = await api.post('/auth/change-password', data);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  // WebAuthn / Biometric
  checkBiometricSupport: async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!window.PublicKeyCredential) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  },

  registerBiometric: async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Get registration options from server
      const optRes = await api.get('/auth/webauthn/register/options');
      const options = optRes.data;

      // 2. Decode challenge and user.id from base64url
      const challenge = _b64urlToBuffer(options.challenge);
      const userId = _b64urlToBuffer(options.user.id);

      // 3. Create credential via WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: options.rp,
          user: { ...options.user, id: userId },
          pubKeyCredParams: options.pubKeyCredParams,
          authenticatorSelection: options.authenticatorSelection,
          timeout: options.timeout,
          excludeCredentials: (options.excludeCredentials || []).map((c: { id: string; type: string }) => ({
            ...c,
            id: _b64urlToBuffer(c.id),
          })),
        },
      }) as PublicKeyCredential;

      if (!credential) return { success: false, error: 'Credential creation cancelled' };

      const attestation = credential.response as AuthenticatorAttestationResponse;

      // 4. Send to server for storage
      await api.post('/auth/webauthn/register/verify', {
        credential_id: _bufferToB64url(credential.rawId),
        public_key: _bufferToB64url(attestation.getPublicKey?.() || new ArrayBuffer(0)),
        sign_count: 0,
        device_name: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Device',
      });

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Biometric registration failed';
      return { success: false, error: msg };
    }
  },

  loginBiometric: async (email: string): Promise<AuthTokens> => {
    // 1. Get login options
    const optRes = await api.post('/auth/webauthn/login/options', { email });
    const options = optRes.data;

    // 2. Get assertion from authenticator
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: _b64urlToBuffer(options.challenge),
        rpId: options.rpId,
        allowCredentials: (options.allowCredentials || []).map((c: { id: string; type: string }) => ({
          ...c,
          id: _b64urlToBuffer(c.id),
        })),
        timeout: options.timeout,
        userVerification: options.userVerification,
      },
    }) as PublicKeyCredential;

    if (!assertion) throw new Error('Biometric authentication cancelled');

    const authData = assertion.response as AuthenticatorAssertionResponse;

    // 3. Verify with server
    const res = await api.post('/auth/webauthn/login/verify', {
      email,
      credential_id: _bufferToB64url(assertion.rawId),
      authenticator_data: _bufferToB64url(authData.authenticatorData),
      client_data_json: _bufferToB64url(authData.clientDataJSON),
      signature: _bufferToB64url(authData.signature),
    });

    if (res.data.access_token) {
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
    }
    return res.data;
  },
};
