import type { ActivityAudience } from "../hooks/useFriends";
import "./AudienceControl.css";

const OPTIONS: Array<{ value: ActivityAudience; label: string }> = [
  { value: "friends", label: "Friends" },
  { value: "global", label: "Global" },
];

export function AudienceControl({
  value,
  onChange,
}: {
  value: ActivityAudience;
  onChange: (value: ActivityAudience) => void;
}) {
  return (
    <div className="audience-control" role="tablist" aria-label="Whose activity">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`audience-control-option${value === option.value ? " is-selected" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
