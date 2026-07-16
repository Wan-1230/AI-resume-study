interface DotNavProps {
  total: number;
  current: number;
  onChange: (index: number) => void;
  labels?: string[];
}

export default function DotNav({ total, current, onChange, labels }: DotNavProps) {
  return (
    <nav className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`group relative w-3 h-3 rounded-full transition-all duration-300 ${
            i === current
              ? 'bg-primary-500 scale-125 shadow-lg shadow-primary-500/50'
              : 'bg-[#5a5a6e]/30 hover:bg-[#5a5a6e]/60'
          }`}
        >
          <span className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1a22] text-[#8b8b9a] border border-[#2a2a38]`}>
            {labels?.[i] || `第 ${i + 1} 页`}
          </span>
        </button>
      ))}
    </nav>
  );
}
