import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;

export const isMicrosoftLoginConfigured = Boolean(clientId && tenantId);
export const graphScopes = ['Mail.ReadWrite'];
export const msalInstance = isMicrosoftLoginConfigured
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin + '/auth-redirect.html',
      },
      cache: { cacheLocation: 'sessionStorage' },
    })
  : null;

let initialization;
let tokenRequest;

export function getGraphAccessToken() {
  if (!msalInstance) return Promise.reject(new Error('Microsoft sign-in is not configured.'));
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    initialization ??= msalInstance.initialize();
    await initialization;

    let account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
    if (!account) {
      const login = await msalInstance.loginPopup({ scopes: graphScopes });
      account = login.account;
      msalInstance.setActiveAccount(account);
      if (login.accessToken) return login.accessToken;
    }

    try {
      const result = await msalInstance.acquireTokenSilent({ account, scopes: graphScopes });
      return result.accessToken;
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) throw error;
      const result = await msalInstance.acquireTokenPopup({ account, scopes: graphScopes });
      return result.accessToken;
    }
  })();

  return tokenRequest.finally(() => { tokenRequest = null; });
}
