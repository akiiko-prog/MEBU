
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

function base64UrlEncode(buffer: Buffer): string {
    const base64 = buffer.toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateRandomState(length: number = 16): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(length);
    return base64UrlEncode(Buffer.from(randomBytes));
}

export async function loginIntracomPure(username: string, password: string): Promise<string> {
    const client_id = "860665";
    const state = await generateRandomState();
    const nonce = await generateRandomState();

    const loginUrl = `https://cri.epita.fr/auth/login/?next=/authorize%3Fresponse_type%3Did_token%2520token%26client_id%3D${client_id}%26state%3D${state}%26redirect_uri%3Dhttps%253A%252F%252Fintracom.epita.fr%252FcriConnect%26scope%3Dopenid%2520profile%2520email%2520phone%2520birthdate%2520epita%26nonce%3D${nonce}&spnego=0`;

    console.log("[Intracom Auth] Récupération de la page CRI...");

    const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
    };

    const initialResponse = await fetch(loginUrl, { headers });
    if (!initialResponse.ok && initialResponse.status !== 401) {
        throw new Error(`Erreur réseau (${initialResponse.status}) lors de l'accès à la page de login CRI.`);
    }

    const html = await initialResponse.text();
    const csrfMatch = html.match(/name="csrfmiddlewaretoken" value="([^"]+)"/);
    if (!csrfMatch) {
        throw new Error("Impossible d'extraire le jeton CSRF de la page de login CRI.");
    }
    const csrfToken = csrfMatch[1];

    let cookieHeader = "";
    const rawSetCookie = initialResponse.headers.get('set-cookie');
    if (rawSetCookie) {
        const cookieMatches = rawSetCookie.match(/(csrftoken=[^;]+)/);
        if (cookieMatches) {
            cookieHeader = cookieMatches[1];
        }
    }

    console.log("[Intracom Auth] Soumission du formulaire (POST)...");

    const formData = new URLSearchParams({
        csrfmiddlewaretoken: csrfToken,
        username: username,
        password: password
    });

    const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookieHeader,
            "Referer": loginUrl
        },
        body: formData.toString(),
    });

    const finalUrl = loginResponse.url;

    if (!finalUrl.includes("access_token")) {

        let errorMsg = "Erreur de connexion. Veuillez vérifier votre mot de passe.";

        try {
            const errHtml = await loginResponse.text();
            if (errHtml.includes("Mot de passe incorrect") || errHtml.includes("Invalid password")) {
                errorMsg = "Mot de passe ou nom d'utilisateur incorrect.";
            } else if (errHtml.includes("id_username")) {
                errorMsg = "Authentification refusée (Identifiants invalides).";
            }
        } catch (e) { }

        throw new Error(errorMsg);
    }

    console.log("[Intracom Auth] OIDC Access Token capturé en URL.");

    const tokenMatch = finalUrl.match(/access_token=([^&]+)/);
    if (!tokenMatch) {
        throw new Error("Jeton d'accès absent de l'URL de retour.");
    }

    const criAccessToken = tokenMatch[1];

    console.log("[Intracom Auth] Échange contre le JWT Intracom...");

    const tokenResponse = await fetch("https://intracom.epita.fr/api/Users/Login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "User-Agent": headers["User-Agent"]
        },
        body: JSON.stringify({ accessToken: criAccessToken })
    });

    if (!tokenResponse.ok) {
        throw new Error(`Erreur lors de la récupération du token JWT (${tokenResponse.status}).`);
    }

    const intracomJwt = await tokenResponse.text();

    if (!intracomJwt.startsWith("ey")) {
        throw new Error("Le format du jeton JWT retourné par l'API Intracom est invalide.");
    }

    console.log("[Intracom Auth] JWT Intracom récupéré avec succès.");

    return intracomJwt;
}
