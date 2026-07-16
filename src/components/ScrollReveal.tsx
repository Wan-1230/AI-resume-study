import { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: string;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  containerClassName?: string;
  textClassName?: string;
  delay?: number;
}

const ScrollReveal = ({
  children,
  enableBlur = true,
  baseOpacity = 0,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = '',
  textClassName = '',
  delay = 0
}: ScrollRevealProps) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const splitText = children.split(/(\s+)/).map((word, index) => {
    if (word.match(/^\s+$/)) return word;
    return (
      <span 
        className="inline-block transition-all duration-700"
        key={index}
        style={{ 
          transitionDelay: `${delay + index * 50}ms`,
          opacity: isVisible ? 1 : baseOpacity,
          transform: isVisible ? 'none' : `rotate(${baseRotation}deg)`,
          filter: enableBlur && !isVisible ? `blur(${blurStrength}px)` : 'none'
        }}
      >
        {word}
      </span>
    );
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100 + delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <h2 ref={containerRef} className={`scroll-reveal ${containerClassName}`}>
      <p className={`scroll-reveal-text ${textClassName}`}>{splitText}</p>
    </h2>
  );
};

export default ScrollReveal;
