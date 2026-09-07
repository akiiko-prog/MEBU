import { Auth, Services } from "@/stores/account/types";

import { Capabilities, SchoolServicePlugin } from "../shared/types";

export class Intracom implements SchoolServicePlugin {
    displayName = "Intracom";
    service = Services.INTRACOM;
    capabilities = [Capabilities.REFRESH];
    authData: Auth = {};
    session: undefined;

    constructor(public id: string) { }

    async refreshAccount(credentials: Auth): Promise<Intracom> {
        this.authData = credentials;
        return this;
    }
}
