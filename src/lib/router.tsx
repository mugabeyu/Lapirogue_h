'use client';

import LinkBase from 'next/link';
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
} from 'next/navigation';
import React from 'react';

type NavigateOptions = {
  replace?: boolean;
};

type LinkLikeProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'children'
> & {
  to: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  children?: React.ReactNode;
};

type NavLinkClassName = string | ((props: { isActive: boolean }) => string);

type NavLinkChildren =
  | React.ReactNode
  | ((props: { isActive: boolean }) => React.ReactNode);

type NavLinkProps = Omit<LinkLikeProps, 'children' | 'className'> & {
  end?: boolean;
  className?: NavLinkClassName;
  children?: NavLinkChildren;
};

function isPathActive(pathname: string, to: string, end = false) {
  if (to === '/') {
    return pathname === '/';
  }

  if (end) {
    return pathname === to;
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

export function useNavigate() {
  const router = useRouter();

  return (to: string, options?: NavigateOptions) => {
    if (options?.replace) {
      router.replace(to);
      return;
    }

    router.push(to);
  };
}

export function useLocation() {
  const pathname = usePathname() ?? '/';

  return {
    pathname,
    search: '',
    hash: '',
    state: null,
    key: pathname,
  };
}

export function useParams<
  TParams extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
>() {
  const params =
    useNextParams<Record<string, string | string[]>>() ?? ({} as Record<string, string | string[]>);
  const normalized = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  return normalized as TParams;
}

export function Link({ to, children, ...props }: LinkLikeProps) {
  return (
    <LinkBase href={to} {...props}>
      {children}
    </LinkBase>
  );
}

export function NavLink({
  to,
  end,
  className,
  children,
  ...props
}: NavLinkProps) {
  const pathname = usePathname() ?? '/';
  const isActive = isPathActive(pathname, to, end);

  const resolvedClassName =
    typeof className === 'function' ? className({ isActive }) : className;

  return (
    <LinkBase href={to} className={resolvedClassName} {...props}>
      {typeof children === 'function' ? children({ isActive }) : children}
    </LinkBase>
  );
}
