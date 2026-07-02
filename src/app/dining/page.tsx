'use client';

import { useEffect, useState } from 'react';
import { Clock, UtensilsCrossed, ChevronDown } from 'lucide-react';

type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  preparationMinutes: number | null;
  isAvailable: boolean;
  imagePath: string | null;
};

type DiningResponse = {
  success: boolean;
  data: MenuItem[];
  grouped: Record<string, MenuItem[]>;
  categories: string[];
  total: number;
};

export default function DiningPage() {
  const [data, setData] = useState<DiningResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dining')
      .then((res) => res.json() as Promise<DiningResponse>)
      .then((result) => {
        setData(result);
        if (result.categories.length > 0) {
          setActiveCategory(result.categories[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#a1c181] border-t-transparent" />
          <p className="text-sm text-[#4a4a4a]">Loading our menu...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <UtensilsCrossed className="mx-auto h-12 w-12 text-[#6b7280]" />
          <p className="mt-4 text-lg text-[#4a4a4a]">Unable to load menu at this time.</p>
        </div>
      </div>
    );
  }

  const { grouped, categories } = data;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#a1c181] via-[#619b8a] to-[#619b8a] px-6 py-20 text-white">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-16 -translate-y-16 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-12 translate-y-12 rounded-full bg-white/5" />
        <div className="relative mx-auto max-w-6xl">
          <UtensilsCrossed className="mb-4 h-8 w-8 opacity-80" />
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Food & Beverages
          </h1>
          <p className="mt-3 max-w-xl text-lg text-white/80">
            Explore our selection of freshly prepared meals, snacks, and beverages
            available throughout your stay.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-white text-[#1f2937] shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {cat}
                <span className="ml-1.5 opacity-60">({grouped[cat].length})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e5e7eb] px-6 py-16 text-center">
            <UtensilsCrossed className="mx-auto h-12 w-12 text-[#6b7280]" />
            <p className="mt-4 text-lg text-[#4a4a4a]">No menu items available yet.</p>
          </div>
        ) : (
          categories.map((cat) => {
            const items = grouped[cat] ?? [];
            const isActive = activeCategory === cat;

            return (
              <section key={cat} id={`cat-${cat}`} className="mb-14 last:mb-0">
                <button
                  type="button"
                  onClick={() => setActiveCategory(isActive ? null : cat)}
                  className="flex w-full items-center justify-between border-b border-[#e5e7eb] pb-3 text-left"
                >
                  <h2 className="font-display text-2xl font-bold text-[#1f2937]">{cat}</h2>
                  <ChevronDown
                    className={`h-5 w-5 text-[#6b7280] transition-transform ${
                      isActive ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isActive && (
                  <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white transition-shadow hover:shadow-md"
                      >
                        <div className="relative aspect-[4/3] bg-[#f3f4f6]">
                          {item.imagePath ? (
                            <img
                              src={item.imagePath}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <UtensilsCrossed className="h-8 w-8 text-[#6b7280]" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <h3 className="font-display text-lg font-semibold text-[#1f2937]">
                              {item.name}
                            </h3>
                            <span className="shrink-0 font-display text-lg font-bold text-[#a1c181]">
                              Rs {item.price.toLocaleString('en-IN')}
                            </span>
                          </div>
                          {item.description && (
                            <p className="mb-3 text-sm leading-relaxed text-[#4a4a4a]">
                              {item.description}
                            </p>
                          )}
                          {item.preparationMinutes && (
                            <div className="mt-auto flex items-center gap-1.5 text-xs text-[#6b7280]">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                Prep time:{' '}
                                {item.preparationMinutes < 60
                                  ? `${item.preparationMinutes} min`
                                  : `${Math.floor(item.preparationMinutes / 60)} hr ${item.preparationMinutes % 60} min`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}

        {categories.length > 0 && (
          <div className="border-t border-[#e5e7eb] pt-8 text-center text-sm text-[#6b7280]">
            <p>
              {data.total} item{data.total !== 1 ? 's' : ''} available &middot; Prices in
              Mauritian Rupees
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
