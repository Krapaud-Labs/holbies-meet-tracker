const signInButton = document.querySelector('#sign-in-button');
const authStatus = document.querySelector('#auth-status');

function setAuthState(state, message) {
  authStatus.dataset.state = state;
  authStatus.textContent = message;
}

function setLoading(isLoading) {
  signInButton.disabled = isLoading;
  signInButton.setAttribute('aria-busy', String(isLoading));
  signInButton.querySelector('span').textContent = isLoading
    ? 'Connexion en cours…'
    : 'Se connecter avec Google';
}

function connectGoogleAccount() {
  setLoading(true);
  setAuthState('loading', 'Ouverture de la connexion Google…');

  chrome.identity.getAuthToken({ interactive: true })
    .then(({ token, grantedScopes = [] }) => {
      const requiredScopes = chrome.runtime.getManifest().oauth2.scopes;
      const hasRequiredScopes = requiredScopes.every((scope) => grantedScopes.includes(scope));

      if (!token || !hasRequiredScopes) {
        throw new Error('required-scopes-not-granted');
      }

      setLoading(false);
      setAuthState('success', 'Compte Google connecté. Vous pouvez continuer.');
    })
    .catch(() => {
      setLoading(false);
      setAuthState('error', 'Connexion impossible ou autorisations incomplètes. Réessayez depuis la popup.');
    });
}

signInButton.addEventListener('click', connectGoogleAccount);
