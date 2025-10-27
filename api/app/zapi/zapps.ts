import { type Zapp } from "@parcnet-js/app-connector";

export function constructLoginZapp(name: string): Zapp {
  return {
    name,
    permissions: {
      READ_PUBLIC_IDENTIFIERS: {},
      SIGN_POD: {},
    },
  };
}

export function constructZapp(
  name: string,
  podCollections: string[],
  ticketCollections: string[],
): Zapp {
  return {
    name,
    permissions: {
      REQUEST_PROOF: { collections: ticketCollections },
      READ_POD: { collections: podCollections },
      INSERT_POD: { collections: podCollections },
    },
  };
}
