import { useState, useEffect } from 'react';
import IntroSection from './IntroSection';
import FeaturedProductsHeader from './FeaturedProductsHeader';
import ProductCardICO from './ProductCardICO';
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

export default function IEOLaunchpadTab() {
  const [ieoProducts, setIeoProducts] = useState<IEOProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/finance/ieo/products?status=IN_PROGRESS');
        const data = await res.json();

        if (data.success) {
          setIeoProducts(data.products);
        }
      } catch (error) {
        console.error('Error fetching IEO products:', error);
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

      {/* IEO Products */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {ieoProducts.length > 0 ? (
            ieoProducts.map((product) => (
              <ProductCardICO
                key={product.id}
                id={product.id}
                title={product.title}
                status={product.status}
                current={product.current}
                total={product.total}
                remaining={product.remaining}
                symbol={product.symbol}
                pricePerToken={product.pricePerToken}
              />
            ))
          ) : (
            <div className="text-center py-12 px-4">
              <p className="text-gray-400 text-lg">No IEO products available at the moment</p>
              <p className="text-gray-500 text-sm mt-2">Please check back later</p>
            </div>
          )}
        </>
      )}

      <NoMoreSection />
    </div>
  );
}
