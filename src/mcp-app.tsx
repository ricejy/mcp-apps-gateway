import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

interface MessageDto {
  id: string | null;
  threadId: string | null;
  category: string | null;
  district: string | null;
  municipality: string | null;
  area: string | null;
  isActive: boolean;
  text: string | null;
  createdOn: string;
  updatedOn: string;
  imageUrl: string | null;
  isEdited: boolean;
}

interface IncidentData {
  messages: MessageDto[] | null;
  totalCount: number;
}

interface NamedItem {
  id: string | number;
  name: string;
}

interface FilterOptions {
  categories: NamedItem[];
  districts: NamedItem[];
}

const CATEGORY_ICONS: Record<string, string> = {
  Trafikk: "\u{1F697}",
  Brann: "\u{1F525}",
  Savnet: "\u{1F50D}",
  Dyr: "\u{1F43E}",
  Ordensforstyrrelser: "\u{26A0}️",
  Narkotika: "\u{1F48A}",
  Vold: "\u{1F6A8}",
  Tyveri: "\u{1F513}",
  Ran: "\u{1F3AD}",
  Skadeverk: "\u{1F6E0}️",
  Sjø: "⛵",
  Melding: "\u{1F4E2}",
  default: "\u{1F4CB}",
};

function getIcon(category: string | null): string {
  if (!category) return CATEGORY_ICONS.default;
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return CATEGORY_ICONS.default;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PolitiloggenApp() {
  const [data, setData] = useState<IncidentData | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: "Politiloggen Dashboard", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.onteardown = async () => ({ });
      app.ontoolinput = async () => {};
      app.ontoolresult = async (result) => {
        if (result.structuredContent && "messages" in (result.structuredContent as object)) {
          setData(result.structuredContent as unknown as IncidentData);
          setLastRefresh(new Date());
        }
      };
      app.ontoolcancelled = () => {};
      app.onerror = console.error;
      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };
    },
  });

  useEffect(() => {
    if (app) setHostContext(app.getHostContext());
  }, [app]);

  const loadFilterOptions = useCallback(async () => {
    if (!app) return;
    try {
      const result = await app.callServerTool({
        name: "get-filter-options",
        arguments: {},
      });
      if (result.structuredContent) {
        setFilterOptions(result.structuredContent as unknown as FilterOptions);
      }
    } catch (e) {
      console.error("Failed to load filter options:", e);
    }
  }, [app]);

  const refresh = useCallback(async () => {
    if (!app) return;
    setLoading(true);
    try {
      const args: Record<string, unknown> = { take: 50 };
      if (selectedCategory) args.categories = [selectedCategory];
      if (selectedDistrict) args.districts = [selectedDistrict];
      const result = await app.callServerTool({
        name: "refresh-incidents",
        arguments: args,
      });
      if (result.structuredContent) {
        setData(result.structuredContent as unknown as IncidentData);
        setLastRefresh(new Date());
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setLoading(false);
    }
  }, [app, selectedCategory, selectedDistrict]);

  useEffect(() => {
    if (app) {
      loadFilterOptions();
      refresh();
    }
  }, [app, loadFilterOptions, refresh]);

  if (error) return <div style={styles.error}>Error: {error.message}</div>;
  if (!app) return <div style={styles.loading}>Connecting...</div>;

  const messages = data?.messages ?? [];

  return (
    <main
      style={{
        ...styles.main,
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      <Header
        totalCount={data?.totalCount ?? 0}
        shownCount={messages.length}
        lastRefresh={lastRefresh}
        loading={loading}
        onRefresh={refresh}
      />
      <Stats messages={messages} />
      <Filters
        filterOptions={filterOptions}
        selectedCategory={selectedCategory}
        selectedDistrict={selectedDistrict}
        onCategoryChange={setSelectedCategory}
        onDistrictChange={setSelectedDistrict}
      />
      <IncidentList messages={messages} loading={loading} />
    </main>
  );
}

function Header({
  totalCount,
  shownCount,
  lastRefresh,
  loading,
  onRefresh,
}: {
  totalCount: number;
  shownCount: number;
  lastRefresh: Date | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header style={styles.header}>
      <div>
        <h1 style={styles.title}>Politiloggen</h1>
        <p style={styles.subtitle}>
          {shownCount} of {totalCount} incidents
          {lastRefresh && (
            <span style={styles.refreshTime}>
              {" · "}Updated {lastRefresh.toLocaleTimeString("nb-NO")}
            </span>
          )}
        </p>
      </div>
      <button onClick={onRefresh} disabled={loading} style={styles.refreshBtn}>
        {loading ? "⏳" : "↻"} {loading ? "Loading..." : "Refresh"}
      </button>
    </header>
  );
}

function Stats({ messages }: { messages: MessageDto[] }) {
  const stats = useMemo(() => {
    const active = messages.filter((m) => m.isActive).length;
    const categories = new Set(messages.map((m) => m.category).filter(Boolean));
    const districts = new Set(messages.map((m) => m.district).filter(Boolean));
    const topCategories = Object.entries(
      messages.reduce<Record<string, number>>((acc, m) => {
        const cat = m.category ?? "Unknown";
        acc[cat] = (acc[cat] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { active, inactive: messages.length - active, categories: categories.size, districts: districts.size, topCategories };
  }, [messages]);

  return (
    <div style={styles.statsGrid}>
      <div style={{ ...styles.statCard, borderLeftColor: "var(--color-danger)" }}>
        <div style={styles.statValue}>{stats.active}</div>
        <div style={styles.statLabel}>Active</div>
      </div>
      <div style={{ ...styles.statCard, borderLeftColor: "var(--color-success)" }}>
        <div style={styles.statValue}>{stats.inactive}</div>
        <div style={styles.statLabel}>Resolved</div>
      </div>
      <div style={{ ...styles.statCard, borderLeftColor: "var(--color-accent)" }}>
        <div style={styles.statValue}>{stats.categories}</div>
        <div style={styles.statLabel}>Categories</div>
      </div>
      <div style={{ ...styles.statCard, borderLeftColor: "var(--color-warning)" }}>
        <div style={styles.statValue}>{stats.districts}</div>
        <div style={styles.statLabel}>Districts</div>
      </div>
      {stats.topCategories.length > 0 && (
        <div style={styles.topCategories}>
          {stats.topCategories.map(([cat, count]) => (
            <span key={cat} style={styles.categoryChip}>
              {getIcon(cat)} {cat} <strong>{count}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Filters({
  filterOptions,
  selectedCategory,
  selectedDistrict,
  onCategoryChange,
  onDistrictChange,
}: {
  filterOptions: FilterOptions | null;
  selectedCategory: string;
  selectedDistrict: string;
  onCategoryChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
}) {
  return (
    <div style={styles.filters}>
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        style={styles.select}
      >
        <option value="">All Categories</option>
        {filterOptions?.categories.map((c) => (
          <option key={c.name} value={c.name}>
            {getIcon(c.name)} {c.name}
          </option>
        ))}
      </select>
      <select
        value={selectedDistrict}
        onChange={(e) => onDistrictChange(e.target.value)}
        style={styles.select}
      >
        <option value="">All Districts</option>
        {filterOptions?.districts.map((d) => (
          <option key={d.name} value={d.name}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function IncidentList({
  messages,
  loading,
}: {
  messages: MessageDto[];
  loading: boolean;
}) {
  if (loading && messages.length === 0) {
    return <div style={styles.loading}>Loading incidents...</div>;
  }
  if (messages.length === 0) {
    return <div style={styles.empty}>No incidents found.</div>;
  }

  return (
    <div style={styles.list}>
      {messages.map((msg) => (
        <IncidentCard key={msg.id} message={msg} />
      ))}
    </div>
  );
}

function IncidentCard({ message }: { message: MessageDto }) {
  const icon = getIcon(message.category);

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.cardIcon}>{icon}</span>
        <div style={styles.cardMeta}>
          <span style={styles.cardCategory}>{message.category ?? "Unknown"}</span>
          <span style={styles.cardTime}>{timeAgo(message.createdOn)}</span>
        </div>
        <span
          style={{
            ...styles.statusBadge,
            backgroundColor: message.isActive
              ? "var(--color-danger)"
              : "var(--color-success)",
          }}
        >
          {message.isActive ? "Active" : "Resolved"}
        </span>
      </div>
      <p style={styles.cardText}>{message.text ?? "No description"}</p>
      <div style={styles.cardFooter}>
        {message.district && (
          <span style={styles.tag}>{message.district}</span>
        )}
        {message.municipality && (
          <span style={styles.tag}>{message.municipality}</span>
        )}
        {message.area && (
          <span style={styles.tagArea}>{message.area}</span>
        )}
        <span style={styles.timestamp}>{formatTime(message.createdOn)}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "var(--spacing-md)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--spacing-md)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "var(--spacing-md)",
    flexWrap: "wrap",
  },
  title: {
    fontSize: "var(--font-heading-xl-size)",
    lineHeight: "var(--font-heading-xl-line-height)",
    fontWeight: "var(--font-weight-bold)" as unknown as number,
    margin: 0,
  },
  subtitle: {
    fontSize: "var(--font-text-sm-size)",
    color: "var(--color-text-secondary)",
    margin: "2px 0 0",
  },
  refreshTime: {
    color: "var(--color-text-secondary)",
  },
  refreshBtn: {
    padding: "8px 16px",
    fontSize: "var(--font-text-sm-size)",
    fontWeight: "var(--font-weight-medium)" as unknown as number,
    borderRadius: "var(--border-radius-md)",
    border: "var(--border-width-regular) solid var(--color-border)",
    background: "var(--color-background-secondary)",
    color: "var(--color-text-primary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "var(--spacing-sm)",
  },
  statCard: {
    padding: "var(--spacing-sm) var(--spacing-md)",
    borderRadius: "var(--border-radius-md)",
    background: "var(--color-background-secondary)",
    borderLeft: "3px solid transparent",
  },
  statValue: {
    fontSize: "var(--font-heading-lg-size)",
    fontWeight: "var(--font-weight-bold)" as unknown as number,
  },
  statLabel: {
    fontSize: "var(--font-text-xs-size)",
    color: "var(--color-text-secondary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  topCategories: {
    gridColumn: "1 / -1",
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--spacing-xs)",
  },
  categoryChip: {
    fontSize: "var(--font-text-xs-size)",
    padding: "3px 10px",
    borderRadius: "999px",
    background: "var(--color-background-info)",
    color: "var(--color-text-info)",
    whiteSpace: "nowrap",
  },
  filters: {
    display: "flex",
    gap: "var(--spacing-sm)",
    flexWrap: "wrap",
  },
  select: {
    flex: 1,
    minWidth: 160,
    padding: "8px 12px",
    fontSize: "var(--font-text-sm-size)",
    borderRadius: "var(--border-radius-md)",
    border: "var(--border-width-regular) solid var(--color-border)",
    background: "var(--color-background-secondary)",
    color: "var(--color-text-primary)",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--spacing-sm)",
  },
  card: {
    padding: "var(--spacing-md)",
    borderRadius: "var(--border-radius-lg)",
    border: "var(--border-width-regular) solid var(--color-border)",
    background: "var(--color-background-secondary)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "var(--spacing-sm)",
    marginBottom: "var(--spacing-xs)",
  },
  cardIcon: {
    fontSize: "1.25rem",
  },
  cardMeta: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  cardCategory: {
    fontWeight: "var(--font-weight-semibold)" as unknown as number,
    fontSize: "var(--font-text-sm-size)",
  },
  cardTime: {
    fontSize: "var(--font-text-xs-size)",
    color: "var(--color-text-secondary)",
  },
  statusBadge: {
    fontSize: "var(--font-text-xs-size)",
    fontWeight: "var(--font-weight-medium)" as unknown as number,
    padding: "2px 8px",
    borderRadius: "999px",
    color: "#fff",
    whiteSpace: "nowrap",
  },
  cardText: {
    fontSize: "var(--font-text-sm-size)",
    lineHeight: "var(--font-text-sm-line-height)",
    margin: "var(--spacing-xs) 0",
  },
  cardFooter: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--spacing-xs)",
    alignItems: "center",
  },
  tag: {
    fontSize: "var(--font-text-xs-size)",
    padding: "2px 8px",
    borderRadius: "var(--border-radius-md)",
    background: "var(--color-background-info)",
    color: "var(--color-text-info)",
  },
  tagArea: {
    fontSize: "var(--font-text-xs-size)",
    color: "var(--color-text-secondary)",
    fontStyle: "italic",
  },
  timestamp: {
    marginLeft: "auto",
    fontSize: "var(--font-text-xs-size)",
    color: "var(--color-text-secondary)",
  },
  loading: {
    textAlign: "center" as const,
    padding: "var(--spacing-xl)",
    color: "var(--color-text-secondary)",
  },
  empty: {
    textAlign: "center" as const,
    padding: "var(--spacing-xl)",
    color: "var(--color-text-secondary)",
  },
  error: {
    textAlign: "center" as const,
    padding: "var(--spacing-xl)",
    color: "var(--color-danger)",
  },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PolitiloggenApp />
  </StrictMode>,
);
