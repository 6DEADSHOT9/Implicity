import * as React from "react"
import tokens from "../../../contracts/looks/tokens.json" with { type: "json" }

const MOBILE_BREAKPOINT = tokens.derivedTokens.dimensions["--screen-md"]

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => typeof window !== "undefined" && window.matchMedia(`(width < ${MOBILE_BREAKPOINT})`).matches)

  React.useEffect(() => {
    const mql = window.matchMedia(`(width < ${MOBILE_BREAKPOINT})`)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
