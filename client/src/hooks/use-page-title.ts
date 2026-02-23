import { useEffect } from "react";

const BASE_TITLE = "TenantAdvocate";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} | Recover Your Security Deposit`;
    return () => {
      document.title = `${BASE_TITLE} | Recover Your Security Deposit`;
    };
  }, [title]);
}
