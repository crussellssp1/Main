import type { NewsSource } from "./types";

/**
 * Every feed below was reachable without a key or account at build time.
 * Publishers move and rate-limit these endpoints, so /api/news treats any
 * single failure as non-fatal and reports it in the panel footer.
 */
export const NEWS_SOURCES: NewsSource[] = [
  // ---- Markets wire -------------------------------------------------------
  {
    id: "wsj-markets",
    label: "WSJ MKTS",
    url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
    category: "MKT",
    enabledByDefault: true,
  },
  {
    id: "wsj-business",
    label: "WSJ BIZ",
    url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",
    category: "CO",
    enabledByDefault: true,
  },
  {
    id: "mw-bulletins",
    label: "MW FLASH",
    url: "https://feeds.marketwatch.com/marketwatch/bulletins",
    category: "WIRE",
    enabledByDefault: true,
  },
  {
    id: "mw-pulse",
    label: "MW PULSE",
    url: "https://feeds.marketwatch.com/marketwatch/marketpulse/",
    category: "MKT",
    enabledByDefault: true,
  },
  {
    id: "mw-top",
    label: "MW TOP",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
    category: "MKT",
    enabledByDefault: true,
  },
  {
    id: "cnbc-markets",
    label: "CNBC MKTS",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    category: "MKT",
    enabledByDefault: true,
  },
  {
    id: "cnbc-finance",
    label: "CNBC FIN",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000113",
    category: "MKT",
    enabledByDefault: false,
  },
  {
    id: "yahoo-finance",
    label: "YHOO FIN",
    url: "https://finance.yahoo.com/news/rssindex",
    category: "MKT",
    enabledByDefault: true,
  },
  {
    id: "ft-markets",
    label: "FT MKTS",
    url: "https://www.ft.com/markets?format=rss",
    category: "MKT",
    enabledByDefault: true,
  },
  {
    id: "ft-companies",
    label: "FT COS",
    url: "https://www.ft.com/companies?format=rss",
    category: "CO",
    enabledByDefault: false,
  },
  {
    id: "seeking-alpha",
    label: "SA CURRENTS",
    url: "https://seekingalpha.com/market_currents.xml",
    category: "MKT",
    enabledByDefault: true,
  },
  {
    id: "investing-news",
    label: "INVESTING",
    url: "https://www.investing.com/rss/news.rss",
    category: "MKT",
    enabledByDefault: false,
  },
  {
    id: "nyt-business",
    label: "NYT BIZ",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    category: "CO",
    enabledByDefault: false,
  },

  // ---- Macro and central banks -------------------------------------------
  {
    id: "fed-monetary",
    label: "FED FOMC",
    url: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    category: "MACRO",
    enabledByDefault: true,
  },
  {
    id: "fed-all",
    label: "FED ALL",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    category: "MACRO",
    enabledByDefault: false,
  },
  {
    id: "ecb-press",
    label: "ECB",
    url: "https://www.ecb.europa.eu/rss/press.html",
    category: "MACRO",
    enabledByDefault: false,
  },
  {
    id: "ft-economy",
    label: "FT ECON",
    url: "https://www.ft.com/global-economy?format=rss",
    category: "MACRO",
    enabledByDefault: true,
  },
  {
    id: "cnbc-economy",
    label: "CNBC ECON",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
    category: "MACRO",
    enabledByDefault: true,
  },
  {
    id: "economist-finecon",
    label: "ECONOMIST",
    url: "https://www.economist.com/finance-and-economics/rss.xml",
    category: "MACRO",
    enabledByDefault: false,
  },

  // ---- Credit, rates and regulatory --------------------------------------
  {
    id: "investing-bonds",
    label: "BONDS",
    url: "https://www.investing.com/rss/news_1064.rss",
    category: "CREDIT",
    enabledByDefault: true,
  },
  {
    id: "sec-press",
    label: "SEC",
    url: "https://www.sec.gov/news/pressreleases.rss",
    category: "CREDIT",
    enabledByDefault: false,
  },

  // ---- Real estate --------------------------------------------------------
  {
    id: "commercial-observer",
    label: "COMM OBS",
    url: "https://commercialobserver.com/feed/",
    category: "RE",
    enabledByDefault: true,
  },
  {
    id: "bisnow",
    label: "BISNOW",
    url: "https://www.bisnow.com/rss",
    category: "RE",
    enabledByDefault: true,
  },
  {
    id: "housingwire",
    label: "HOUSINGWIRE",
    url: "https://www.housingwire.com/feed/",
    category: "RE",
    enabledByDefault: false,
  },
  {
    id: "nareit",
    label: "NAREIT",
    url: "https://www.reit.com/rss.xml",
    category: "RE",
    enabledByDefault: false,
  },
];

export const CATEGORY_LABEL: Record<string, string> = {
  ALL: "ALL",
  WIRE: "FLASH",
  MKT: "MARKETS",
  MACRO: "MACRO",
  CREDIT: "CREDIT",
  CO: "COMPANY",
  RE: "REAL ESTATE",
};

/** Default quote board. Overridable in the UI and persisted to localStorage. */
export const DEFAULT_WATCHLIST = [
  "^GSPC",
  "^NDX",
  "^DJI",
  "^RUT",
  "^VIX",
  "^TNX",
  "DX-Y.NYB",
  "CL=F",
  "GC=F",
  "BTC-USD",
  "AAPL",
  "MSFT",
  "NVDA",
  "JPM",
  "BX",
  "SPG",
  "VNQ",
  "HYG",
  "LQD",
  "TLT",
];

/** Tape across the top of the terminal. */
export const TAPE_SYMBOLS = [
  "^GSPC",
  "^NDX",
  "^DJI",
  "^RUT",
  "^VIX",
  "^TNX",
  "^FVX",
  "^TYX",
  "DX-Y.NYB",
  "EURUSD=X",
  "USDJPY=X",
  "CL=F",
  "NG=F",
  "GC=F",
  "HG=F",
  "BTC-USD",
];

/** Symbols Yahoo returns under a name that is unhelpful on a dense board. */
export const SYMBOL_ALIASES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^NDX": "NASDAQ 100",
  "^IXIC": "NASDAQ COMP",
  "^DJI": "DOW JONES",
  "^RUT": "RUSSELL 2000",
  "^VIX": "VIX",
  "^TNX": "UST 10Y YLD",
  "^FVX": "UST 5Y YLD",
  "^TYX": "UST 30Y YLD",
  "^IRX": "UST 13W YLD",
  "DX-Y.NYB": "DOLLAR INDEX",
  "EURUSD=X": "EUR/USD",
  "USDJPY=X": "USD/JPY",
  "GBPUSD=X": "GBP/USD",
  "CL=F": "WTI CRUDE",
  "BZ=F": "BRENT CRUDE",
  "NG=F": "NAT GAS",
  "GC=F": "GOLD",
  "SI=F": "SILVER",
  "HG=F": "COPPER",
  "BTC-USD": "BITCOIN",
  "ETH-USD": "ETHEREUM",
  "ZN=F": "UST 10Y FUT",
  "ZB=F": "UST 30Y FUT",
  "ZQ=F": "FED FUNDS FUT",
  "SR3=F": "SOFR 3M FUT",
};

/** Yield-quoted symbols: Yahoo reports these in percent, not price. */
export const YIELD_SYMBOLS = new Set(["^TNX", "^FVX", "^TYX", "^IRX"]);
