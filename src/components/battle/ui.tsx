// ============================================================
// バトル画面専用の小UIコンポーネント
// ============================================================

// ---- フィルターボタン ----
interface FilterBtnProps {
  label: string;
  active: boolean;
  tw?: string;
  onClick: () => void;
}

export function FilterBtn({ label, active, tw, onClick }: FilterBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-black px-2 py-0.5 rounded border transition-colors ${
        active
          ? 'bg-neutral-900 text-white border-neutral-900'
          : `border-neutral-300 text-neutral-500 hover:border-neutral-500 ${tw ?? ''}`
      }`}
    >
      {label}
    </button>
  );
}
