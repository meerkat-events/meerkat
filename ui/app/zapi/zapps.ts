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

export function constructTicketProofZapp(
  name: string,
  collections: string[],
): Zapp {
  return {
    name,
    permissions: {
      REQUEST_PROOF: { collections },
    },
  };
}

export function constructPODZapp(
  name: string,
  collections: string[],
): Zapp {
  return {
    name,
    permissions: {
      READ_POD: { collections },
      INSERT_POD: { collections },
      SIGN_POD: {},
    },
  };
}
