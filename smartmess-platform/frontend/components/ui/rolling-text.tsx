import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type RollingLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
  /** Render a plain <a> (for static files like /login.html) instead of next/link */
  plain?: boolean;
};

/**
 * "Rolling text" hover: the label slides up and out while an identical
 * copy in the accent colour slides up into its place.
 * Pure CSS (Tailwind group-hover), no JS or extra library needed.
 */
export function RollingLink({
  href,
  children,
  className = "",
  plain = false,
  ...rest
}: RollingLinkProps) {
  const roll =
    "transition-transform duration-[450ms] ease-[cubic-bezier(0.76,0,0.24,1)]";

  const classes = `group relative inline-block overflow-hidden leading-[1.5] ${className}`;

  const content = (
    <>
      {/* Original label: slides up and out */}
      <span
        className={`block ${roll} group-hover:-translate-y-full group-focus-visible:-translate-y-full`}
      >
        {children}
      </span>

      {/* Copy in accent colour: slides up from below */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 block translate-y-full text-[#BA6017] ${roll} group-hover:translate-y-0 group-focus-visible:translate-y-0`}
      >
        {children}
      </span>
    </>
  );

  const isHash = href.startsWith("#");
  const usePlain = plain || isHash;

  return usePlain ? (
    <a href={href} className={classes} {...rest}>
      {content}
    </a>
  ) : (
    <Link href={href} className={classes} {...rest}>
      {content}
    </Link>
  );
}