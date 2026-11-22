let accessToken = null;
let currentProfile = null;

const byId = (id) => document.getElementById(id);
const authView = byId('auth-view');
const dashboard = byId('dashboard');
const notice = byId('notice');
const signupForm = byId('signup-form');
const signinForm = byId('signin-form');
const searchResults = byId('search-results');

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle('error', isError);
  notice.hidden = !message;
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;

  const response = await fetch(path, { ...options, headers });
  let payload = null;

  if (response.status !== 204) {
    const raw = await response.text();
    if (raw) {
      try { payload = JSON.parse(raw); }
      catch { throw new Error('The server returned an unreadable response.'); }
    }
  }

  if (!response.ok) {
    const details = Array.isArray(payload?.issues) ? ' ' + payload.issues.join('; ') : '';
    throw new Error((payload?.message || 'Request failed (' + response.status + ').') + details);
  }
  return payload;
}

function setAuthMode(mode) {
  const isSignup = mode === 'signup';
  signupForm.hidden = !isSignup;
  signinForm.hidden = isSignup;
  byId('auth-title').textContent = isSignup ? 'Create a test account' : 'Sign in to your account';

  document.querySelectorAll('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  showNotice('');
}

function showDashboard(profile) {
  currentProfile = profile;
  authView.hidden = true;
  dashboard.hidden = false;

  byId('health-id').textContent = profile.healthId;
  byId('profile-name').textContent = profile.givenName + ' ' + profile.familyName;
  byId('profile-dob').textContent = profile.dateOfBirth || 'Not provided';
  byId('profile-email').textContent = profile.email || 'Not provided';
  byId('profile-mobile').textContent = profile.mobile || 'Not provided';
  byId('profile-created').textContent = profile.registeredAt
    ? new Date(profile.registeredAt).toLocaleString()
    : '—';
  byId('discoverable-toggle').checked = Boolean(profile.discoverable);
  searchResults.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = 'Search results will appear here.';
  searchResults.append(empty);
}

async function signIn(identifier, password) {
  const session = await apiRequest('/api/v1/signin', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  accessToken = session.accessToken;
  const result = await apiRequest('/api/v1/me');
  showDashboard(result.individual);
}

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => setAuthMode(button.dataset.mode));
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(signupForm).entries());
  const submitButton = signupForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Creating…';

  try {
    await apiRequest('/api/v1/signup', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    await signIn(values.email, values.password);
    signupForm.reset();
    showNotice('Health ID created. You are now signed in.');
  } catch (error) {
    accessToken = null;
    showNotice(error.message, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Create Health ID';
  }
});

signinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(signinForm).entries());
  const submitButton = signinForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Signing in…';

  try {
    await signIn(values.identifier, values.password);
    signinForm.reset();
    showNotice('Signed in successfully.');
  } catch (error) {
    accessToken = null;
    showNotice(error.message, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Sign in';
  }
});

byId('discoverable-toggle').addEventListener('change', async (event) => {
  const toggle = event.currentTarget;
  const previousValue = Boolean(currentProfile?.discoverable);
  toggle.disabled = true;

  try {
    const result = await apiRequest('/api/v1/me/discoverability', {
      method: 'PATCH',
      body: JSON.stringify({ discoverable: toggle.checked }),
    });
    currentProfile.discoverable = result.discoverable;
    showNotice(result.discoverable
      ? 'Your identity is now discoverable in the directory.'
      : 'Your identity has been hidden from directory searches.');
  } catch (error) {
    toggle.checked = previousValue;
    showNotice(error.message, true);
  } finally {
    toggle.disabled = false;
  }
});

byId('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = byId('search-query').value.trim();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (query.length < 2) {
    showNotice('Enter at least 2 characters to search.', true);
    return;
  }

  button.disabled = true;
  button.textContent = 'Searching…';
  searchResults.replaceChildren();

  try {
    const result = await apiRequest('/api/v1/individuals/search?q=' + encodeURIComponent(query));
    if (!result.individuals.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No discoverable identities found.';
      searchResults.append(empty);
    } else {
      result.individuals.forEach((individual) => {
        const item = document.createElement('article');
        item.className = 'result-item';

        const name = document.createElement('strong');
        name.textContent = individual.givenName + ' ' + individual.familyName;
        const healthId = document.createElement('span');
        healthId.textContent = individual.healthId;

        item.append(name, healthId);
        searchResults.append(item);
      });
    }
    showNotice('Search complete. Results contain only basic identity details.');
  } catch (error) {
    showNotice(error.message, true);
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Search could not be completed.';
    searchResults.append(empty);
  } finally {
    button.disabled = false;
    button.textContent = 'Search';
  }
});

byId('signout-button').addEventListener('click', async () => {
  const button = byId('signout-button');
  button.disabled = true;
  try {
    await apiRequest('/api/v1/signout', { method: 'POST' });
    accessToken = null;
    currentProfile = null;
    dashboard.hidden = true;
    authView.hidden = false;
    setAuthMode('signin');
    showNotice('You have signed out. Your session has been revoked.');
    byId('search-query').value = '';
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    button.disabled = false;
  }
});

setAuthMode('signup');