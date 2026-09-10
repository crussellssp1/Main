"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CalendarPanel from "./CalendarPanel";
import ChartPanel, { type Range } from "./ChartPanel";
import NewsWire from "./NewsWire";
import RatesPanel from "./RatesPanel";
import Tape from "./Tape";
import Watchlist from "./Watchlist";
import { QuoteProvider } from "./QuoteContext";
import { fmtClock } from "@/lib/format";
import { DEFAULT_WATCHLIST, NEWS_SOURCES, TAPE_SYMBOLS } from "@/lib/sources";
import { usePersisted } from "@/lib/useFeed";

const DEFAULT_SOURCE_IDS = NEWS_SOURCES.filter((s) => s.enabledByDefault).map((s) => s.id);

/** Bloomberg-style mnemonics accepted in the command line. */
const COMMAND_HELP = "SYMBOL · GP <SYM> · N <TEXT> · CAL · RATES · W <SYM> · HELP";

export default function Terminal() {
  const [watchlist, setWatchlist] = usePersisted<string[]>("tw:watchlist", DEFAULT_WATCHLIST);
  const [sourceIds, setSourceIds] = usePersisted<string[]>("tw:sources", DEFAULT_SOURCE_IDS);
  const [symbol, setSymbol] = usePersisted<string>("tw:symbol", "^GSPC");
  const [range, setRange] = usePersisted<Range>("tw:range", "1y");

  const [command, setCommand] = useState("");
  const [newsQuery, setNewsQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const cmdRef = useRef<HTMLInputElement>(null);

  // Clock starts client-side only, so server and client markup agree.
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const notify = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3200);
  }, []);

  const addSymbol = useCallback(
    (raw: string) => {
      const sym = raw.trim().toUpperCase();
      if (!sym) return;
      if (!watchlist.includes(sym)) setWatchlist([...watchlist, sym]);
      setSymbol(sym);
    },
    [watchlist, setWatchlist, setSymbol]
  );

  const runCommand = useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input) return;
      const [head, ...rest] = input.split(/\s+/);
      const verb = head.toUpperCase();
      const arg = rest.join(" ");

      switch (verb) {
        case "HELP":
        case "?":
          notify(COMMAND_HELP);
          break;
        case "GP":
        case "CHART":
          if (arg) {
            setSymbol(arg.toUpperCase());
            notify(`CHART → ${arg.toUpperCase()}`);
          } else notify("GP needs a symbol, e.g. GP NVDA");
          break;
        case "W":
        case "ADD":
          if (arg) {
            addSymbol(arg);
            notify(`ADDED ${arg.toUpperCase()} TO QUOTE BOARD`);
          } else notify("W needs a symbol, e.g. W BX");
          break;
        case "DEL":
        case "RM":
          if (arg) {
            const sym = arg.toUpperCase();
            setWatchlist(watchlist.filter((s) => s !== sym));
            notify(`REMOVED ${sym}`);
          }
          break;
        case "N":
        case "NEWS":
          setNewsQuery(arg);
          notify(arg ? `NEWS FILTER → "${arg}"` : "NEWS FILTER CLEARED");
          break;
        case "CAL":
        case "ECO":
          notify("ECONOMIC CALENDAR IS IN THE LOWER RIGHT PANEL");
          break;
        case "RATES":
        case "CRV":
          notify("RATES & CREDIT IS IN THE UPPER RIGHT PANEL");
          break;
        case "RESET":
          setWatchlist(DEFAULT_WATCHLIST);
          setSourceIds(DEFAULT_SOURCE_IDS);
          notify("LAYOUT AND WATCHLIST RESET TO DEFAULTS");
          break;
        default:
          // A bare token is treated as a ticker, the way <SYM> <GO> behaves.
          setSymbol(verb);
          if (!watchlist.includes(verb)) setWatchlist([...watchlist, verb]);
          notify(`LOADED ${verb}`);
      }
      setCommand("");
    },
    [addSymbol, notify, setSourceIds, setSymbol, setWatchlist, watchlist]
  );

  // Slash or Ctrl+K focuses the command line from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.key === "/" && !typing) || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        cmdRef.current?.focus();
        cmdRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Everything on screen that shows a price is served by one batched poll.
  const quoteSymbols = [...TAPE_SYMBOLS, ...watchlist, symbol];

  return (
    <QuoteProvider symbols={quoteSymbols} priority={symbol}>
    <div className="shell">
      <Tape onSelect={setSymbol} />

      <div className="cmdbar">
        <span className="brand">TERMINAL</span>
        <form
          className="cmd-input-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            runCommand(command);
          }}
        >
          <span className="cmd-caret">›</span>
          <label className="sr-only" htmlFor="cmd">
            Command line
          </label>
          <input
            id="cmd"
            ref={cmdRef}
            className="cmd-input"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={COMMAND_HELP}
            spellCheck={false}
            autoComplete="off"
          />
          <button className="cmd-go" type="submit">
            GO
          </button>
        </form>

        <span className="clocks">
          {flash ? <b style={{ color: "var(--amber-bright)" }}>{flash}</b> : null}
        </span>

        <span className="clocks">
          <span>
            NY <b>{now ? fmtClock(now, "America/New_York") : "--:--:--"}</b>
          </span>
          <span>
            LDN <b>{now ? fmtClock(now, "Europe/London") : "--:--:--"}</b>
          </span>
          <span>
            HKG <b>{now ? fmtClock(now, "Asia/Hong_Kong") : "--:--:--"}</b>
          </span>
        </span>
      </div>

      <div className="grid">
        <div className="col">
          <Watchlist
            symbols={watchlist}
            selected={symbol}
            onSelect={setSymbol}
            onAdd={addSymbol}
            onRemove={(sym) => setWatchlist(watchlist.filter((s) => s !== sym))}
          />
        </div>

        <div className="col col-center">
          <ChartPanel symbol={symbol} range={range} onRangeChange={setRange} />
          <NewsWire
            sourceIds={sourceIds}
            onSourceIdsChange={setSourceIds}
            onSymbolPick={addSymbol}
            query={newsQuery}
            onQueryChange={setNewsQuery}
          />
        </div>

        <div className="col col-right">
          <RatesPanel />
          <CalendarPanel />
        </div>
      </div>

      <div className="status">
        <span>
          <span className="fn">/</span> or <span className="fn">CTRL+K</span> COMMAND
        </span>
        <span>
          <span className="fn">J/K</span> WIRE NAV
        </span>
        <span>
          <span className="fn">ENTER</span> READ ARTICLE
        </span>
        <span>
          <span className="fn">ESC</span> CLOSE READER
        </span>
        <span>
          ACTIVE <b style={{ color: "var(--amber)" }}>{symbol}</b>
        </span>
        <span style={{ marginLeft: "auto" }}>
          DELAYED AND END-OF-DAY DATA · NOT FOR TRADING OR VALUATION USE
        </span>
      </div>
    </div>
    </QuoteProvider>
  );
}
