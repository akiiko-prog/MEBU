export const cachedDetails: { token: string | null } = { token: null };

export function setIntracomTokenHelper(token: string) {
    cachedDetails.token = token;
}

export function getIntracomTokenHelper() {
    return cachedDetails.token;
}
