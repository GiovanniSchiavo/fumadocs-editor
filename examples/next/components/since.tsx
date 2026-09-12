export function Since({ version }: { version: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        border: "1px solid var(--color-fd-border)",
        borderRadius: 8,
        padding: "2px 10px",
        fontSize: 12,
        color: "var(--color-fd-muted-foreground)",
      }}
    >
      Available since {version}
    </span>
  );
}
