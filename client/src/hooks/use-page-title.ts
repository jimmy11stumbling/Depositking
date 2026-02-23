import { useEffect } from "react";

const BASE_TITLE = "TenantAdvocate";

export function usePageTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} | AI-Powered Security Deposit Recovery for Renters`;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && description) {
      metaDesc.setAttribute("content", description);
    }

    return () => {
      document.title = `${BASE_TITLE} | AI-Powered Security Deposit Recovery for Renters`;
    };
  }, [title, description]);
}
