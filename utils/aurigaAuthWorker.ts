/**
 * Auriga React Native Auth (Expo Version)
 */

import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

// --- Utilitaires de cryptographie PKCE avec Expo Crypto -----

/**
 * Buffer en Base64-URL-safe
 */
function base64UrlEncode(buffer: Buffer): string {
    const base64 = buffer.toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * verifier et challenge PKCE (S256).
 */
export async function generatePkcePair() {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const verifier = base64UrlEncode(Buffer.from(randomBytes));

    const challengeBase64 = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    // Base64 vers Base64-URL-safe
    const challenge = challengeBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return { verifier, challenge };
}

export async function generateRandomState(): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    return base64UrlEncode(Buffer.from(randomBytes));
}


/**
 * Authentification vers Auriga.
 * 
 * @param username L'identifiant utilisateur
 * @param password Le mot de passe
 * @returns Les tokens OIDC (access_token, refresh_token, etc.)
 */
export async function loginAurigaPure(username: string, password: string): Promise<any> {
    const client_id = "np-front";
    const redirect_uri = "https://my.esme.fr/";
    const base_auth_url = "https://ionisesme-auth.np-auriga.nfrance.net/auth/realms/npionisesme/protocol/openid-connect/auth";
    const token_url = "https://ionisesme-auth.np-auriga.nfrance.net/auth/realms/npionisesme/protocol/openid-connect/token";

    const { verifier: code_verifier, challenge: code_challenge } = await generatePkcePair();
    const state = await generateRandomState();
    const nonce = await generateRandomState();

    const auth_params = new URLSearchParams({
        client_id,
        redirect_uri,
        state,
        response_mode: "query",
        response_type: "code",
        scope: "openid",
        nonce,
        prompt: "login",
        code_challenge,
        code_challenge_method: "S256"
    });

    const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", // Header mobile
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
    };

    //[1] Récupération de la page de login Keycloak...
    const authUrl = `${base_auth_url}?${auth_params.toString()}`;
    const initialResponse = await fetch(authUrl, { headers });

    if (!initialResponse.ok) {
        throw new Error(`[-] Erreur HTTP ${initialResponse.status} sur la page de login.`);
    }

    const html = await initialResponse.text();

    //[2] Recherche du formulaire de login...
    const formMatch = html.match(/<form[^>]*id="kc-form-login"[^>]*>/i) || html.match(/<form[^>]*action="([^"]+)"[^>]*id="kc-form-login"/i);
    if (!formMatch) {
        throw new Error("Formulaire de login introuvable");
    }

    let actionUrl = "";
    const actionMatch = formMatch[0].match(/action="([^"]+)"/i);

    if (actionMatch) {
        actionUrl = actionMatch[1].replace(/&amp;/g, '&');
    } else {
        throw new Error("Attribut 'action' introuvable dans le formulaire de login.");
    }

    if (actionUrl.startsWith('/')) {
        const urlObj = new URL(initialResponse.url);
        actionUrl = `${urlObj.protocol}//${urlObj.host}${actionUrl}`;
    }

    //Envoi des identifiants (POST)...
    const loginData = new URLSearchParams({
        username,
        password,
        credentialId: ''
    });

    let cookieStr = "";
    const rawSetCookie = initialResponse.headers.get('set-cookie');
    if (rawSetCookie) {
        const matches = rawSetCookie.match(/(AUTH_SESSION_ID=[^;]+|KC_RESTART=[^;]+)/g);
        if (matches) {
            cookieStr = matches.join('; ');
        }
    }

    const loginResponse = await fetch(actionUrl, {
        method: "POST",
        headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookieStr
        },
        body: loginData.toString()
    });

    const finalUrl = loginResponse.url;

    if (!finalUrl.startsWith(redirect_uri)) {
        const errHtml = await loginResponse.text();
        const errMatch = errHtml.match(/<span[^>]*class="[^"]*kc-feedback-text[^"]*"[^>]*>([^<]+)<\/span>/i) ||
            errHtml.match(/<div[^>]*class="[^"]*instruction[^"]*"[^>]*>([^<]+)<\/div>/i);

        const errMsg = errMatch ? errMatch[1].trim() : "Redirection inattendue ou erreur d'identifiants";
        throw new Error(`Authentification refusée (Status: ${loginResponse.status}). Message : ${errMsg}`);
    }

    //Redirection réussie. Extraction de l'Authorization Code...
    const finalUrlObj = new URL(finalUrl);
    let authCode = finalUrlObj.searchParams.get('code');

    if (!authCode && finalUrlObj.hash) {
        const hashParams = new URLSearchParams(finalUrlObj.hash.substring(1));
        authCode = hashParams.get('code');
    }

    if (!authCode) {
        throw new Error(`'code' introuvable dans l'URL: ${finalUrl}`);
    }

    //Authorization Code récupéré.

    const tokenData = new URLSearchParams({
        client_id,
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri,
        code_verifier
    });

    const tokenResponse = await fetch(token_url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        },
        body: tokenData.toString()
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Erreur lors de l'échange du token: ${tokenResponse.status}\n${errorText}`);
    }

    const tokens = await tokenResponse.json();

    console.log("[AURIGA] Connexion réussie.");

    return tokens;
}
