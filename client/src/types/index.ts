export interface RouteProps {
  children: React.ReactNode;
}

export interface GuardProps extends RouteProps {
  roles?: string[];
}

export interface PageProps {
  params?: Record<string, string>;
}