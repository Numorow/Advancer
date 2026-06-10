/** Re-mounts on every navigation → gives each page a gentle fade-up entrance. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
