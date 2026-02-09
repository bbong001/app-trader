import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import IntroSection from './IntroSection';
import FeaturedProductsHeader from './FeaturedProductsHeader';
import ProductCardICO from './ProductCardICO';
import ProductCardMining from './ProductCardMining';
import NoMoreSection from './NoMoreSection';
import LoadingSpinner from '../shared/LoadingSpinner';

interface IEOProduct {
  id: number;
  title: string;
  symbol: string;
  status: string;
  current: number;
  total: number;
  remaining: number;
  pricePerToken: number;
}

interface MiningProduct {
  id: number;
  hashRate: string;
  currency: string;
  averageDailyReturn: number;
  minimumPurchase: number;
  maximumPurchase: number | null;
  duration: number;
}

export default function AIMiningTab() {
  const [icoProducts, setIeoProducts] = useState<IEOProduct[]>([]);
  const [miningProducts, setMiningProducts] = useState<MiningProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const [ieoRes, miningRes] = await Promise.all([
          fetch('/api/finance/ieo/products?status=IN_PROGRESS'),
          fetch('/api/finance/mining/products?status=ACTIVE'),
        ]);

        const ieoData = await ieoRes.json();
        const miningData = await miningRes.json();

        if (ieoData.success) {
          setIeoProducts(ieoData.products);
        }
        if (miningData.success) {
          setMiningProducts(miningData.products);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="bg-gray-900 min-h-screen pb-20">
      <IntroSection />
      <FeaturedProductsHeader />

      {/* Products */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Mining Products */}
          {miningProducts.length > 0 && (
            <>
              {miningProducts.map((product) => (
                <ProductCardMining
                  key={product.id}
                  id={product.id}
                  hashRate={product.hashRate}
                  currency={product.currency}
                  averageDailyReturn={product.averageDailyReturn}
                  minimumPurchase={product.minimumPurchase}
                  maximumPurchase={product.maximumPurchase}
                />
              ))}
            </>
          )}

          {/* No products message */}
          {!isLoading && icoProducts.length === 0 && miningProducts.length === 0 && (
            <div className="text-center py-12 px-4">
              <p className="text-gray-400 text-lg">No products available at the moment</p>
              <p className="text-gray-500 text-sm mt-2">Please check back later</p>
            </div>
          )}
        </>
      )}

      <NoMoreSection />
    </div>
  );
}
