interface OrderBookEntry {
  price: string;
  quantity: string;
}

interface BinanceOrderBook {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

interface TickerData {
  symbol: string;
  price: string;
  priceChangePercent: string;
}

export class BinanceAPI {
  private static baseUrl = 'https://api.binance.com/api/v3';
  private wsConnections: Map<string, WebSocket> = new Map();

  // Get order book snapshot
  async getOrderBook(symbol: string, limit: number = 20): Promise<{ bids: Array<{ price: number; quantity: number }>; asks: Array<{ price: number; quantity: number }> }> {
    try {
      const response = await fetch(`${BinanceAPI.baseUrl}/depth?symbol=${symbol}&limit=${limit}`);
      const data: BinanceOrderBook = await response.json();
      
      return {
        bids: data.bids.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
        })),
        asks: data.asks.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
        })),
      };
    } catch (error) {
      console.error('Error fetching order book:', error);
      // Return mock data on error
      return this.getMockOrderBook();
    }
  }

  // Get ticker data
  async getTicker(symbol: string): Promise<{ price: number; changePercent: number }> {
    try {
      const response = await fetch(`${BinanceAPI.baseUrl}/ticker/24hr?symbol=${symbol}`);
      const data = await response.json();

      // Binance lỗi trả về { code: number, msg: string } thay vì TickerData
      if (!response.ok || data.code != null) {
        console.warn('Binance ticker error for', symbol, data.msg ?? data);
        return { price: Number.NaN, changePercent: Number.NaN };
      }

      const price = parseFloat(data.price);
      const changePercent = parseFloat(data.priceChangePercent ?? '0');

      return {
        price: Number.isFinite(price) ? price : Number.NaN,
        changePercent: Number.isFinite(changePercent) ? changePercent : Number.NaN,
      };
    } catch (error) {
      console.error('Error fetching ticker:', error);
      return {
        price: Number.NaN,
        changePercent: Number.NaN,
      };
    }
  }

  // Subscribe to order book updates via WebSocket
  subscribeOrderBook(
    symbol: string,
    onUpdate: (bids: Array<{ price: number; quantity: number }>, asks: Array<{ price: number; quantity: number }>) => void
  ): () => void {
    const wsSymbol = symbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@depth20@100ms`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.bids && data.asks) {
          const bids = data.bids.map(([price, quantity]: [string, string]) => ({
            price: parseFloat(price),
            quantity: parseFloat(quantity),
          }));
          const asks = data.asks.map(([price, quantity]: [string, string]) => ({
            price: parseFloat(price),
            quantity: parseFloat(quantity),
          }));
          onUpdate(bids, asks);
        }
      } catch (error) {
        console.error('Error parsing WebSocket data:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.wsConnections.set(symbol, ws);

    // Return cleanup function
    return () => {
      ws.close();
      this.wsConnections.delete(symbol);
    };
  }

  // Subscribe to ticker updates
  subscribeTicker(
    symbol: string,
    onUpdate: (price: number, changePercent: number) => void
  ): () => void {
    const wsSymbol = symbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.c && data.P) {
          onUpdate(parseFloat(data.c), parseFloat(data.P));
        }
      } catch (error) {
        console.error('Error parsing ticker data:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.wsConnections.set(`${symbol}_ticker`, ws);

    return () => {
      ws.close();
      this.wsConnections.delete(`${symbol}_ticker`);
    };
  }

  // Get candlestick/klines data
  async getCandlestickData(
    symbol: string,
    interval: string,
    limit: number = 500
  ): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>> {
    try {
      const response = await fetch(
        `${BinanceAPI.baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      const data: Array<[number, string, string, string, string, string, number, string, number, string, string, string]> = await response.json();
      
      return data.map(([openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]) => ({
        time: openTime / 1000, // Convert to seconds
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: parseFloat(volume),
      }));
    } catch (error) {
      console.error('Error fetching candlestick data:', error);
      return this.getMockCandlestickData();
    }
  }

  // Get 24h statistics
  async get24hStats(symbol: string): Promise<{ high: number; low: number; volume: number }> {
    try {
      const response = await fetch(`${BinanceAPI.baseUrl}/ticker/24hr?symbol=${symbol}`);
      const data = await response.json();
      
      return {
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
      };
    } catch (error) {
      console.error('Error fetching 24h stats:', error);
      return {
        high: 89468.34,
        low: 88831.99,
        volume: 9724.2669,
      };
    }
  }

  // Subscribe to candlestick updates via WebSocket
  subscribeCandlestick(
    symbol: string,
    interval: string,
    onUpdate: (candle: { time: number; open: number; high: number; low: number; close: number; volume: number }) => void
  ): () => void {
    const wsSymbol = symbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${interval}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.k) {
          const k = data.k;
          onUpdate({
            time: k.t / 1000,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          });
        }
      } catch (error) {
        console.error('Error parsing candlestick data:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.wsConnections.set(`${symbol}_${interval}`, ws);

    return () => {
      ws.close();
      this.wsConnections.delete(`${symbol}_${interval}`);
    };
  }

  // Mock data for fallback
  private getMockOrderBook() {
    const basePrice = 88843.5;
    const bids = Array.from({ length: 5 }, (_, i) => ({
      price: basePrice - (i + 1) * 0.0001,
      quantity: Math.random() * 0.0002,
    })).reverse();
    
    const asks = Array.from({ length: 5 }, (_, i) => ({
      price: basePrice + (i + 1) * 0.0001,
      quantity: Math.random() * 0.0002,
    }));

    return { bids, asks };
  }

  private getMockCandlestickData() {
    const basePrice = 88985.29;
    const data = [];
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 100; i >= 0; i--) {
      const time = now - (i * 60); // 1 minute intervals
      const variation = (Math.random() - 0.5) * 200;
      const open = basePrice + variation;
      const close = open + (Math.random() - 0.5) * 100;
      const high = Math.max(open, close) + Math.random() * 50;
      const low = Math.min(open, close) - Math.random() * 50;
      
      data.push({
        time,
        open,
        high,
        low,
        close,
        volume: Math.random() * 100,
      });
    }
    
    return data;
  }
}

export const binanceAPI = new BinanceAPI();
