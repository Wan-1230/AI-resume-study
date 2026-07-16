import { useState, useEffect, useCallback, useRef } from 'react';

interface FullPageScrollOptions {
  totalPages: number;
  animationDuration?: number;
}

export function useFullPageScroll({ totalPages, animationDuration = 800 }: FullPageScrollOptions) {
  const [currentPage, setCurrentPage] = useState(0);
  const isAnimating = useRef(false);
  const touchStartY = useRef(0);

  const goToPage = useCallback((index: number) => {
    if (index < 0 || index >= totalPages || index === currentPage || isAnimating.current) return;

    isAnimating.current = true;
    setCurrentPage(index);

    setTimeout(() => {
      isAnimating.current = false;
    }, animationDuration);
  }, [currentPage, totalPages, animationDuration]);

  const goToNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const goToPrev = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goToFirst = useCallback(() => {
    goToPage(0);
  }, [goToPage]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isAnimating.current) return;

      if (e.deltaY > 0) {
        goToNext();
      } else if (e.deltaY < 0) {
        goToPrev();
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (isAnimating.current) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          goToPrev();
          break;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isAnimating.current) return;
      
      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY.current - touchEndY;
      const minSwipe = 50;

      if (Math.abs(diff) > minSwipe) {
        if (diff > 0) {
          goToNext();
        } else {
          goToPrev();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [goToNext, goToPrev]);

  return {
    currentPage,
    goToPage,
    goToNext,
    goToPrev,
    goToFirst,
    transformStyle: {
      transform: `translate3d(0, -${currentPage * 100}vh, 0)`,
      transition: `transform ${animationDuration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
      willChange: 'transform',
      backfaceVisibility: 'hidden' as const,
      WebkitBackfaceVisibility: 'hidden' as const,
    }
  };
}
