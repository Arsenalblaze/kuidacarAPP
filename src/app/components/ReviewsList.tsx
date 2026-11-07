import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import StarRating from './StarRating';
import { apiClient, supabase } from '../utils/api';
import { Card } from './ui/card';
import { Button } from './ui/button';

type Review = {
  id: string;
  mechanic_id: string;
  customer_id: string;
  customer_name?: string | null;
  rating: number;
  comment?: string | null;
  short_comment?: string | null;
  service_id?: string | null;
  created_at: string;
};

const getHiddenReviewStorageKey = (mechanicId: string) => `hidden_reviews_${mechanicId}`;

const readHiddenReviews = (mechanicId: string): Set<string> => {
  if (typeof window === 'undefined') return new Set();

  try {
    const raw = window.localStorage.getItem(getHiddenReviewStorageKey(mechanicId));
    if (!raw) return new Set();

    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch (error) {
    console.warn('Erro ao ler avaliações ocultas:', error);
    return new Set();
  }
};

export default function ReviewsList({ mechanicId, initialLimit = 6 }: { mechanicId: string; initialLimit?: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [hiddenReviewIds, setHiddenReviewIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const visibleReviews = reviews.filter((review) => !hiddenReviewIds.has(review.id));

  useEffect(() => {
    if (!mechanicId) return;
    setHiddenReviewIds(readHiddenReviews(mechanicId));
  }, [mechanicId]);

  const fetchPage = async (pg: number) => {
    setLoading(true);
    try {
      const offset = pg * initialLimit;
      const res: any = await apiClient.getMechanicReviewsFromKV(mechanicId, initialLimit, offset);
      if (res && res.success) {
        const currentHidden = readHiddenReviews(mechanicId);
        const fetched = (res.reviews || []).filter((review: Review) => !currentHidden.has(review.id));
        if (fetched.length < initialLimit) setHasMore(false);
        setReviews((prev) => (pg === 0 ? fetched : [...prev, ...fetched]));
      }
    } catch (err) {
      console.error('Erro ao buscar avaliações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mechanicId) return;
    setPage(0);
    setHasMore(true);
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanicId]);

  useEffect(() => {
    if (!mechanicId) return;

    const channel = supabase
      .channel(`reviews_realtime_${mechanicId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mechanic_reviews', filter: `mechanic_id=eq.${mechanicId}` },
        () => {
          setPage(0);
          setHasMore(true);
          fetchPage(0);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mechanic_reviews', filter: `mechanic_id=eq.${mechanicId}` },
        () => {
          setPage(0);
          setHasMore(true);
          fetchPage(0);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'mechanic_reviews', filter: `mechanic_id=eq.${mechanicId}` },
        () => {
          setPage(0);
          setHasMore(true);
          fetchPage(0);
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        if (typeof supabase.removeChannel === 'function') {
          supabase.removeChannel(channel);
        }
      } catch (error) {
        console.warn('Erro ao remover canal realtime de avaliações:', error);
      }
    };
  }, [mechanicId]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  const handleDismissReview = (reviewId: string) => {
    setHiddenReviewIds((prev) => {
      const next = new Set(prev);
      next.add(reviewId);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(getHiddenReviewStorageKey(mechanicId), JSON.stringify([...next]));
      }

      return next;
    });
  };

  if (!mechanicId) return null;

  if (visibleReviews.length === 0 && !loading) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Avaliações</h3>
      <div className="space-y-3">
        {visibleReviews.map((r) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <StarRating value={r.rating} readOnly size={16} />
                    <div className="text-sm font-medium">{r.rating}/5</div>
                  </div>
                  {r.customer_name && (
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Cliente: {r.customer_name}</div>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{r.comment || r.short_comment || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('pt-BR')}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => handleDismissReview(r.id)}
                  aria-label="Ocultar avaliação"
                  title="Ocultar avaliação"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {hasMore && (
          <div className="flex justify-center">
            <Button size="sm" onClick={loadMore} disabled={loading}>{loading ? 'Carregando...' : 'Carregar mais'}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
