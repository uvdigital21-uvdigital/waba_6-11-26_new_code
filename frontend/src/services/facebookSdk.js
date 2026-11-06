/**
 * facebookSdk.js
 * Centralized Meta / Facebook JavaScript SDK loader and WhatsApp Embedded Signup launcher.
 * Handles SDK initialization, postMessage session listeners, and FB.login() invocation.
 */

export const DEFAULT_META_APP_ID = '1479602137021825';
export const DEFAULT_META_CONFIG_ID = '964263642989620';
export const DEFAULT_GRAPH_API_VERSION = 'v23.0';
export const DEFAULT_ES_VERSION = 'v4';
export const DEFAULT_SESSION_INFO_VERSION = '3';

export const getMetaAppId = () => {
  return import.meta.env.VITE_META_APP_ID || DEFAULT_META_APP_ID;
};

export const getMetaConfigId = () => {
  return import.meta.env.VITE_META_CONFIG_ID || DEFAULT_META_CONFIG_ID;
};

let sdkLoadingPromise = null;

/**
 * Loads the Facebook JavaScript SDK script exactly once and initializes FB.
 * @returns {Promise<any>} Resolves with window.FB once ready.
 */
export function initFacebookSdk() {
  if (typeof window === 'undefined') return Promise.resolve(null);

  if (window.FB) {
    return Promise.resolve(window.FB);
  }

  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  sdkLoadingPromise = new Promise((resolve, reject) => {
    // Timeout safeguard if SDK fails to load from network
    const timeout = setTimeout(() => {
      console.warn('[FacebookSDK] SDK load timed out after 10 seconds.');
      sdkLoadingPromise = null;
      reject(new Error('Facebook SDK load timed out. Check your network or ad blocker.'));
    }, 10000);

    window.fbAsyncInit = function () {
      clearTimeout(timeout);
      try {
        window.FB.init({
          appId: getMetaAppId(),
          cookie: true,
          xfbml: true,
          version: DEFAULT_GRAPH_API_VERSION
        });
        console.log(`[FacebookSDK] Initialized with App ID ${getMetaAppId()} (Graph API ${DEFAULT_GRAPH_API_VERSION})`);
        resolve(window.FB);
      } catch (err) {
        console.error('[FacebookSDK] Initialization error:', err);
        reject(err);
      }
    };

    // If script tag already exists in DOM
    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    script.onerror = (err) => {
      clearTimeout(timeout);
      sdkLoadingPromise = null;
      console.error('[FacebookSDK] Failed to load SDK script:', err);
      reject(new Error('Failed to load Facebook SDK. Please check your internet connection or ad blocker.'));
    };

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  });

  return sdkLoadingPromise;
}

/**
 * Allowed origin domains for WhatsApp Embedded Signup postMessage events.
 */
const TRUSTED_META_ORIGINS = [
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://business.facebook.com'
];

/**
 * Launches Meta Facebook Login for Business & WhatsApp Embedded Signup v4.
 *
 * @param {Object} options
 * @param {string} [options.configId] - Embedded Signup Config ID
 * @param {Function} [options.onSessionInfo] - Callback when WA_EMBEDDED_SIGNUP postMessage fires
 * @param {Function} [options.onSuccess] - Callback when FB.login returns authorization code ({ code, sessionData })
 * @param {Function} [options.onError] - Callback when error occurs
 * @param {Function} [options.onCancel] - Callback when user cancels
 */
export function launchWhatsAppEmbeddedSignup({
  configId,
  onSessionInfo,
  onSuccess,
  onError,
  onCancel
} = {}) {
  if (typeof window === 'undefined') return;

  const targetConfigId = configId || getMetaConfigId();

  if (!window.FB) {
    const error = new Error('Facebook SDK is not ready yet. Please try again in a moment.');
    if (onError) onError(error);
    return;
  }

  let capturedSessionData = {
    phone_number_id: null,
    waba_id: null,
    current_step: null
  };

  // Safe window message listener for Meta Embedded Signup events
  const messageHandler = (event) => {
    // Validate strict Meta origins
    if (!TRUSTED_META_ORIGINS.includes(event.origin)) {
      return;
    }

    let payload = event.data;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return;
      }
    }

    if (!payload || payload.type !== 'WA_EMBEDDED_SIGNUP') {
      return;
    }

    console.log('[FacebookSDK] WhatsApp Embedded Signup message event:', payload.event, payload.data);

    if (payload.data) {
      if (payload.data.phone_number_id) {
        capturedSessionData.phone_number_id = String(payload.data.phone_number_id);
      }
      if (payload.data.waba_id) {
        capturedSessionData.waba_id = String(payload.data.waba_id);
      }
      if (payload.data.current_step) {
        capturedSessionData.current_step = payload.data.current_step;
      }
    }

    if (onSessionInfo) {
      onSessionInfo(payload, capturedSessionData);
    }
  };

  window.addEventListener('message', messageHandler);

  const cleanup = () => {
    window.removeEventListener('message', messageHandler);
  };

  try {
    // Trigger FB.login() immediately within user click call-stack to prevent popup blockers
    window.FB.login(
      (response) => {
        cleanup();

        if (!response) {
          const err = new Error('No response received from Facebook Login.');
          if (onError) onError(err);
          return;
        }

        // Response status check
        if (response.status === 'connected' && response.authResponse) {
          const code = response.authResponse.code;
          if (!code) {
            // Some configurations return accessToken directly if response_type code isn't enforced
            const accessToken = response.authResponse.accessToken;
            if (accessToken) {
              if (onSuccess) {
                onSuccess({
                  access_token: accessToken,
                  sessionData: capturedSessionData,
                  authResponse: response.authResponse
                });
              }
              return;
            }
            const err = new Error('Authorization code was not returned by Meta. Please check your Config ID settings.');
            if (onError) onError(err);
            return;
          }

          if (onSuccess) {
            onSuccess({
              code,
              sessionData: capturedSessionData,
              authResponse: response.authResponse
            });
          }
        } else if (response.status === 'not_authorized') {
          if (onCancel) onCancel('Application was not authorized by the user.');
        } else {
          // User closed popup or cancelled
          if (onCancel) onCancel('Facebook Login was cancelled or closed.');
        }
      },
      {
        config_id: targetConfigId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          version: DEFAULT_ES_VERSION,
          sessionInfoVersion: DEFAULT_SESSION_INFO_VERSION
        }
      }
    );
  } catch (err) {
    cleanup();
    console.error('[FacebookSDK] FB.login error:', err);
    if (onError) onError(err);
  }
}